import {
  Editor,
  EditorPosition,
  MarkdownFileInfo,
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  ReferenceCache,
  TFile,
} from 'obsidian'

import EagleCacheManager from './cache/EagleCacheManager'
import { createEagleCanvasPasteHandler } from './Canvas'
import { DEFAULT_SETTINGS, EaglePluginSettings } from './plugin-settings'
import EaglePluginSettingsTab from './ui/EaglePluginSettingsTab'
import EagleSearchPickerModal from './ui/EagleSearchPickerModal'
import InfoModal from './ui/InfoModal'
import UpdateLinksConfirmationModal from './ui/UpdateLinksConfirmationModal'
import EagleApiError from './uploader/EagleApiError'
import EagleUploader, { type EagleItemSearchResult } from './uploader/EagleUploader'
import { findLocalFileUnderCursor, replaceFirstOccurrence } from './utils/editor'
import { filePathToFileUrl, fileUrlToDisplayUrl, fileUrlToOsPath } from './utils/file-url'
import { allFilesAreImages } from './utils/FileList'
import { resolveMappedEagleFolder, sanitizeFolderMappings } from './utils/folder-mapping'
import { extractFileExtension } from './utils/image-format'
import { applyTextReplacements, findEagleWikilinkTokens, findMarkdownImageTokens } from './utils/markdown-image'
import { normalizeImageForUpload, removeReferenceIfPresent } from './utils/misc'
import {
  filesAndLinksStatsFrom,
  getAllCachedReferencesForFile,
  replaceAllLocalReferencesWithRemoteOne,
} from './utils/obsidian-vault'
import { generatePseudoRandomId } from './utils/pseudo-random'

interface CanvasView {
  handlePaste: (e: ClipboardEvent) => Promise<void>
  getViewType(): string
}

interface LocalImageInEditor {
  image: {
    file: TFile
    start: EditorPosition
    end: EditorPosition
  }
  editor: Editor
  noteFile: TFile
}

export default class EaglePlugin extends Plugin {
  _settings: EaglePluginSettings

  get settings() {
    return this._settings
  }

  private _eagleUploader: EagleUploader

  get eagleUploader(): EagleUploader {
    return this._eagleUploader
  }

  private _cacheManager: EagleCacheManager

  private customPasteEventCallback = (e: ClipboardEvent) => {
    const { files } = e.clipboardData

    if (!allFilesAreImages(files)) {
      return
    }

    e.preventDefault()

    for (const file of files) {
      void this.uploadFileAndEmbedEagleImage(file).catch((e) => {
        console.error('Failed to upload image: ', e)
      })
    }
  }

  private customDropEventListener = (e: DragEvent) => {
    const { files } = e.dataTransfer

    if (!allFilesAreImages(files)) {
      return
    }

    e.preventDefault()

    for (const file of files) {
      void this.uploadFileAndEmbedEagleImage(file).catch((e) => {
        console.error('Failed to upload image: ', e)
      })
    }
  }

  private eaglePluginRightClickHandler = (menu: Menu, editor: Editor, view: MarkdownView) => {
    const localFile = findLocalFileUnderCursor(editor, view)
    if (!localFile) return

    menu.addItem((item) =>
      item
        .setTitle('Upload to Eagle')
        .setIcon('upload')
        .onClick(() => {
          void this.doUploadLocalImage({ image: localFile, editor, noteFile: view.file })
        }),
    )
  }

  private async doUploadLocalImage(imageInEditor: LocalImageInEditor) {
    const remoteMarkdownImage = await this.uploadLocalImageFromEditor(
      imageInEditor.editor,
      imageInEditor.image.file,
      imageInEditor.image.start,
      imageInEditor.image.end,
    )

    this.proposeToReplaceOtherLocalLinksIfAny(imageInEditor.image.file, remoteMarkdownImage, {
      path: imageInEditor.noteFile.path,
      startPosition: imageInEditor.image.start,
    })
  }

  private proposeToReplaceOtherLocalLinksIfAny(
    originalLocalFile: TFile,
    remoteMarkdownImage: string,
    originalReference: { path: string; startPosition: EditorPosition },
  ) {
    const referencesByNotes = this.getAllCachedReferencesForFile(originalLocalFile)
    this.removeReferenceToOriginalNoteIfPresent(referencesByNotes, originalReference)

    if (Object.keys(referencesByNotes).length > 0) {
      this.showLinksUpdateDialog(originalLocalFile, remoteMarkdownImage, referencesByNotes)
    }
  }

  private getAllCachedReferencesForFile = getAllCachedReferencesForFile(this.app.metadataCache)

  private removeReferenceToOriginalNoteIfPresent = (
    referencesByNote: Record<string, ReferenceCache[]>,
    originalNoteRef: { path: string; startPosition: EditorPosition },
  ) => removeReferenceIfPresent(referencesByNote, originalNoteRef)

  private showLinksUpdateDialog(
    localFile: TFile,
    remoteMarkdownImage: string,
    otherReferencesByNote: Record<string, ReferenceCache[]>,
  ) {
    const stats = filesAndLinksStatsFrom(otherReferencesByNote)
    const dialogBox = new UpdateLinksConfirmationModal(this.app, localFile.path, stats)
    dialogBox.onDoNotUpdateClick(() => dialogBox.close())
    dialogBox.onDoUpdateClick(() => {
      dialogBox.disableButtons()
      dialogBox.setContent('Working...')
      replaceAllLocalReferencesWithRemoteOne(
        this.app.vault,
        otherReferencesByNote,
        remoteMarkdownImage,
      )
        .catch((e) => {
          new InfoModal(
            this.app,
            'Error',
            'Unexpected error occurred, check Developer Tools console for details',
          ).open()
          console.error('Something bad happened during links update', e)
        })
        .finally(() => dialogBox.close())
      new Notice(`Updated ${stats.linksCount} links in ${stats.filesCount} files`)
    })
    dialogBox.open()
  }

  private async uploadLocalImageFromEditor(
    editor: Editor,
    file: TFile,
    start: EditorPosition,
    end: EditorPosition,
  ) {
    const arrayBuffer = await this.app.vault.readBinary(file)
    const fileToUpload = new File([arrayBuffer], file.name)
    editor.replaceRange('\n', end, end)
    const remoteMarkdownImage = await this.uploadFileAndEmbedEagleImage(fileToUpload, {
      ch: 0,
      line: end.line + 1,
    })
    editor.replaceRange(`<!--${editor.getRange(start, end)}-->`, start, end)
    return remoteMarkdownImage
  }

  private async loadSettings() {
    this._settings = {
      ...DEFAULT_SETTINGS,
      ...((await this.loadData()) as EaglePluginSettings),
    }

    this._settings.folderMappings = sanitizeFolderMappings(this._settings.folderMappings ?? [])
  }

  async saveSettings(): Promise<void> {
    this._settings.folderMappings = sanitizeFolderMappings(this._settings.folderMappings ?? [])
    await this.saveData(this._settings)
  }

  override onload() {
    void this.initPlugin()
  }

  private async initPlugin() {
    await this.loadSettings()
    this.addSettingTab(new EaglePluginSettingsTab(this.app, this))

    this.setupEagleUploader()
    this._cacheManager = new EagleCacheManager(this.app)
    this.setupEagleHandlers()
    this.addUploadLocalCommand()
    this.addImportFromEagleLibraryCommand()
    this.addUpdateEmbeddedImagePathsCommands()
    this.addMigrateToCacheCommand()
    this.registerEagleImageRenderer()
    void this.checkLibraryPathDrift()
    void this.lazySyncEagleCache().catch((err) => {
      console.error('Eagle: background cache sync failed unexpectedly', err)
    })
  }

  setupEagleUploader(): void {
    this._eagleUploader = new EagleUploader(this.app, this._settings)
  }

  private setupEagleHandlers() {
    this.registerEvent(this.app.workspace.on('editor-paste', this.customPasteEventCallback))
    this.registerEvent(this.app.workspace.on('editor-drop', this.customDropEventListener))
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        const { view } = leaf

        if (view.getViewType() === 'canvas') {
          this.overridePasteHandlerForCanvasView(view as unknown as CanvasView)
        }
      }),
    )

    this.registerEvent(this.app.workspace.on('editor-menu', this.eaglePluginRightClickHandler))
  }

  private overridePasteHandlerForCanvasView(view: CanvasView) {
    const originalPasteFn = view.handlePaste
    view.handlePaste = createEagleCanvasPasteHandler(this, originalPasteFn)
  }

  private addUploadLocalCommand() {
    this.addCommand({
      id: 'eagle-upload-local',
      name: 'Upload to Eagle',
      editorCheckCallback: this.editorCheckCallbackForLocalUpload,
    })
  }

  private addImportFromEagleLibraryCommand() {
    this.addCommand({
      id: 'eagle-import-from-library',
      name: 'Eagle: Insert image from Eagle (search)',
      editorCheckCallback: this.editorCheckCallbackForLibraryImport,
    })
  }

  private addUpdateEmbeddedImagePathsCommands() {
    this.addCommand({
      id: 'eagle-update-image-paths-current-note',
      name: 'Eagle: Update embedded image paths (current note)',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile()
        if (file?.extension !== 'md') return false
        if (checking) return true

        void this.updateEagleImagePathsInFiles([file])
        return true
      },
    })

    this.addCommand({
      id: 'eagle-update-image-paths-entire-vault',
      name: 'Eagle: Update embedded image paths (entire vault)',
      callback: () => {
        void this.updateEagleImagePathsInFiles(this.app.vault.getMarkdownFiles())
      },
    })
  }

  private addMigrateToCacheCommand() {
    this.addCommand({
      id: 'eagle-migrate-to-local-cache',
      name: 'Eagle: Migrate images to local cache',
      callback: () => {
        void this.migrateImagesToLocalCache()
      },
    })
  }

  private async migrateImagesToLocalCache() {
    // Phase 1: Scan all files for old-format tokens in parallel
    const itemIds = new Set<string>()
    const candidatesByFile = new Map<
      string,
      {
        file: TFile
        content: string
        candidates: { token: ReturnType<typeof findMarkdownImageTokens>[number]; itemId: string }[]
      }
    >()

    const fileResults = await Promise.all(
      this.app.vault.getMarkdownFiles().map(async (file) => {
        const content = await this.app.vault.read(file)
        const candidates = findMarkdownImageTokens(content)
          .map((token) => ({ token, itemId: EaglePlugin.eagleItemIdFromAlt(token.alt) }))
          .filter((c): c is { token: typeof c.token; itemId: string } => c.itemId !== null)
        return { file, content, candidates }
      }),
    )
    for (const { file, content, candidates } of fileResults) {
      if (candidates.length === 0) continue
      candidatesByFile.set(file.path, { file, content, candidates })
      for (const { itemId } of candidates) itemIds.add(itemId)
    }

    if (candidatesByFile.size === 0) {
      new Notice('Eagle: No old-format images found to migrate.')
      return
    }

    // Phase 2: Resolve file URLs concurrently
    const resolvedUrls = new Map<string, string>()
    const failedIds = new Set<string>()

    await Promise.allSettled(
      Array.from(itemIds).map(async (itemId) => {
        try {
          const fileUrl = await this._eagleUploader.getFileUrlForItemId(itemId)
          if (fileUrl.startsWith('file://')) {
            resolvedUrls.set(itemId, fileUrl)
          } else {
            failedIds.add(itemId)
          }
        } catch (err) {
          console.warn('Eagle: failed to resolve URL during migration', { itemId, err })
          failedIds.add(itemId)
        }
      }),
    )

    // Phase 3: Cache files concurrently (parallel), then sequentially apply token replacements to vault files.
    // itemId → ext for successfully cached items only; tokens whose itemId is absent here are left as-is.
    const successExt = new Map<string, string>()
    await Promise.allSettled(
      Array.from(resolvedUrls.entries()).map(async ([itemId, fileUrl]) => {
        const ext = extractFileExtension(fileUrl) || 'jpg'
        try {
          await this._cacheManager.cacheFromOsPath(itemId, ext, fileUrlToOsPath(fileUrl))
          successExt.set(itemId, ext)
        } catch (err) {
          console.error('Eagle: failed to cache file during migration', { itemId, fileUrl, err })
          failedIds.add(itemId)
        }
      }),
    )

    let migratedCount = 0
    for (const { file, content, candidates } of candidatesByFile.values()) {
      const replacements: { start: number; end: number; text: string }[] = []
      for (const { token, itemId } of candidates) {
        const ext = successExt.get(itemId)
        if (!ext) continue
        replacements.push({ start: token.start, end: token.end, text: `![[.eagle/${itemId}.${ext}]]` })
        migratedCount++
      }
      if (replacements.length > 0) {
        await this.app.vault.modify(file, applyTextReplacements(content, replacements))
      }
    }

    const parts = [`Eagle: Migrated ${migratedCount} image(s).`]
    if (failedIds.size > 0) {
      const sample = Array.from(failedIds).slice(0, 3).join(', ')
      const extra = failedIds.size > 3 ? ` and ${failedIds.size - 3} more` : ''
      parts.push(`Failed: ${failedIds.size} (${sample}${extra})`)
    }
    new Notice(parts.join(' '), 8000)
  }

  private async lazySyncEagleCache(): Promise<void> {
    // Phase 1: Collect unique itemId → ext across all vault files in parallel
    const seen = new Map<string, string>() // itemId → ext
    const fileContents = await Promise.all(
      this.app.vault.getMarkdownFiles().map(async (file) => {
        try {
          return await this.app.vault.read(file)
        } catch (err) {
          console.warn('Eagle: failed to read file during lazy cache sync', { path: file.path, err })
          return ''
        }
      }),
    )
    for (const content of fileContents) {
      for (const token of findEagleWikilinkTokens(content)) {
        if (!seen.has(token.itemId)) seen.set(token.itemId, token.ext)
      }
    }

    // Phase 2: Filter to uncached in parallel — allSettled so one adapter failure doesn't abort the rest
    const entries = Array.from(seen.entries())
    const cachedResults = await Promise.allSettled(entries.map(([id, ext]) => this._cacheManager.isCached(id, ext)))
    const uncached = entries
      .filter((_, i) => {
        const result = cachedResults[i]
        if (result.status === 'rejected') {
          console.warn('Eagle: isCached check failed, treating as uncached', { id: entries[i][0], err: result.reason })
          return true // attempt sync anyway
        }
        return !result.value
      })
      .map(([itemId, ext]) => ({ itemId, ext }))
    if (uncached.length === 0) return

    // Phase 3: Fetch URLs and cache all concurrently
    await Promise.allSettled(
      uncached.map(async ({ itemId, ext }) => {
        try {
          const fileUrl = await this._eagleUploader.getFileUrlForItemId(itemId)
          if (!fileUrl.startsWith('file://')) return
          await this._cacheManager.cacheFromOsPath(itemId, ext, fileUrlToOsPath(fileUrl))
        } catch (err) {
          if (err instanceof EagleApiError) return // Eagle not running or item missing — expected
          console.error('Eagle: unexpected error during lazy cache sync', { itemId, ext, err })
        }
      }),
    )
  }

  private static eagleItemIdFromAlt(alt: string) {
    // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
    const match = alt.trim().match(/^eagle:([A-Za-z0-9]+)$/)
    return match ? match[1] : null
  }

  private static eagleItemIdFromLink(link: string) {
    // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
    const match = link.match(/[\\/]+images[\\/]+([^\\/]+)\.info[\\/]+/i)
    return match ? match[1] : null
  }

  private async updateEagleImagePathsInFiles(files: TFile[]) {
    const itemIds = new Set<string>()
    const candidatesByFile = new Map<
      string,
      {
        file: TFile
        content: string
        candidates: { token: ReturnType<typeof findMarkdownImageTokens>[number]; itemId: string }[]
      }
    >()
    // Map by itemId to deduplicate wikilink candidates across files
    const wikilinkMap = new Map<string, { itemId: string; ext: string }>()

    for (const file of files) {
      const content = await this.app.vault.read(file)
      const tokens = findMarkdownImageTokens(content)

      const candidates: { token: (typeof tokens)[number]; itemId: string }[] = []
      for (const token of tokens) {
        const altItemId = EaglePlugin.eagleItemIdFromAlt(token.alt)
        const linkItemId = EaglePlugin.eagleItemIdFromLink(token.link)
        const itemId = altItemId ?? linkItemId

        if (!itemId) continue

        const isEagleImage =
          altItemId !== null ||
          (token.link.toLowerCase().startsWith('file://') && linkItemId !== null)

        if (!isEagleImage) continue

        candidates.push({ token, itemId })
        itemIds.add(itemId)
      }

      if (candidates.length > 0) {
        candidatesByFile.set(file.path, { file, content, candidates })
      }

      // Collect wikilink tokens for re-caching (deduplicated by itemId)
      for (const wt of findEagleWikilinkTokens(content)) {
        if (!wikilinkMap.has(wt.itemId)) {
          wikilinkMap.set(wt.itemId, { itemId: wt.itemId, ext: wt.ext })
        }
        itemIds.add(wt.itemId)
      }
    }

    if (candidatesByFile.size === 0 && wikilinkMap.size === 0) {
      new Notice('Eagle: No embedded images found to update.')
      return
    }

    const resolvedUrls = new Map<string, string>()
    const failedItemIds = new Set<string>()

    const allItemIds = Array.from(itemIds)
    const concurrency = 8
    let cursor = 0

    const workers = Array.from({ length: Math.min(concurrency, allItemIds.length) }).map(async () => {
      while (cursor < allItemIds.length) {
        const idx = cursor
        cursor += 1
        const itemId = allItemIds[idx]

        try {
          const fileUrl = await this._eagleUploader.getFileUrlForItemId(itemId)
          if (fileUrl.startsWith('file://')) {
            resolvedUrls.set(itemId, fileUrl)
          } else {
            failedItemIds.add(itemId)
          }
        } catch {
          failedItemIds.add(itemId)
        }
      }
    })

    await Promise.all(workers)

    let updatedFilesCount = 0
    let updatedLinksCount = 0

    for (const { file, content, candidates } of candidatesByFile.values()) {
      const replacements: { start: number; end: number; text: string }[] = []

      for (const { token, itemId } of candidates) {
        const newUrl = resolvedUrls.get(itemId)
        if (!newUrl) continue

        const altTrimmed = token.alt.trim()
        const altItemId = EaglePlugin.eagleItemIdFromAlt(altTrimmed)

        const nextAlt =
          altTrimmed === ''
            ? `eagle:${itemId}`
            : altItemId !== null && altItemId !== itemId
              ? `eagle:${itemId}`
              : token.alt

        replacements.push({
          start: token.start,
          end: token.end,
          text: `![${nextAlt}](${newUrl})`,
        })
      }

      if (replacements.length === 0) continue

      const updated = applyTextReplacements(content, replacements)
      if (updated !== content) {
        await this.app.vault.modify(file, updated)
        updatedFilesCount += 1
        updatedLinksCount += replacements.length
      }
    }

    // Re-cache wikilink embeds concurrently
    const recacheResults = await Promise.all(
      Array.from(wikilinkMap.values()).map(async ({ itemId, ext }) => {
        const fileUrl = resolvedUrls.get(itemId)
        if (!fileUrl) return false
        try {
          await this._cacheManager.cacheFromOsPath(itemId, ext, fileUrlToOsPath(fileUrl))
          return true
        } catch {
          return false
        }
      }),
    )
    const recachedCount = recacheResults.filter(Boolean).length

    const summaryParts = [`Eagle: Updated ${updatedLinksCount} image link(s) in ${updatedFilesCount} file(s).`]
    if (recachedCount > 0) {
      summaryParts.push(`Re-cached ${recachedCount} wikilink image(s).`)
    }
    if (failedItemIds.size > 0) {
      summaryParts.push(`Failed to resolve ${failedItemIds.size} item(s).`)
    }

    new Notice(summaryParts.join(' '))
  }

  private processEagleWikilinkEmbed(embed: HTMLElement): void {
    const existingImg = embed.querySelector<HTMLImageElement>('img')
    if (existingImg && existingImg.complete && existingImg.naturalWidth > 0) return

    const src = embed.getAttribute('src') ?? ''
    // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
    const match = src.match(/^\.eagle\/([^.]+)\.(.+)$/)
    if (!match) return
    const [, itemId, ext] = match

    const adapter = this.app.vault.adapter as any
    const basePath: string = adapter.getBasePath?.() ?? ''
    if (!basePath) {
      console.warn('Eagle: vault adapter has no getBasePath — cannot serve cached image directly', { itemId, ext })
    }

    this._cacheManager.isCached(itemId, ext).then((cached) => {
      if (cached && basePath) {
        // Obsidian does not index dotfolders (.eagle/), so vault.getResourcePath() is unavailable.
        // Construct the OS path manually and serve via app:// using fileUrlToDisplayUrl.
        const osPath = `${basePath}/${this._cacheManager.cachedVaultPath(itemId, ext)}`
        embed.empty()
        const img = embed.createEl('img')
        img.src = fileUrlToDisplayUrl(filePathToFileUrl(osPath))
      } else {
        // Cache miss — fall back to Eagle API (requires Eagle running)
        this._eagleUploader.getFileUrlForItemId(itemId).then((url) => {
          if (!url.startsWith('file://')) return
          embed.empty()
          const img = embed.createEl('img')
          img.src = fileUrlToDisplayUrl(url)
        }).catch((err) => {
          console.debug('Eagle: could not resolve embed via API', { itemId, ext, err })
        })
      }
    }).catch((err) => {
      console.error('Eagle: isCached check failed unexpectedly', { itemId, ext, err })
    })
  }

  private registerEagleImageRenderer(): void {
    this.registerMarkdownPostProcessor((el) => {
      // Backward-compat: recover old-format ![eagle:ID](...) images
      el.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
        const itemId =
          EaglePlugin.eagleItemIdFromAlt(img.alt) ??
          EaglePlugin.eagleItemIdFromLink(img.getAttribute('src') ?? '')
        if (!itemId) return

        const recoverImage = () => {
          this._eagleUploader.getFileUrlForItemId(itemId).then((url) => {
            if (url.startsWith('file://')) img.src = fileUrlToDisplayUrl(url)
          }).catch((err) => {
            if (!(err instanceof EagleApiError)) {
              console.error('Eagle: unexpected error during image recovery', { itemId, err })
            }
          })
        }

        // Image already failed before this handler was registered
        if (img.complete && img.naturalWidth === 0 && img.src) {
          recoverImage()
          return
        }

        img.addEventListener('error', recoverImage, { once: true })
      })

      // Reading mode only — post-processor fires for rendered output.
      // Live preview is covered by the MutationObserver below.
      el.querySelectorAll<HTMLElement>('.internal-embed[src^=".eagle/"]').forEach((embed) => {
        this.processEagleWikilinkEmbed(embed)
      })
    })

    // Live preview (CM6 editor) doesn't run markdown post-processors.
    // A MutationObserver on the workspace catches embeds as they're added to the DOM,
    // covering real-time edits. We also scan on plugin load and on leaf/layout changes
    // to handle notes that were already open or newly opened.
    const scanEl = (root: HTMLElement) => {
      root.querySelectorAll<HTMLElement>('.internal-embed[src^=".eagle/"]').forEach((embed) => {
        this.processEagleWikilinkEmbed(embed)
      })
    }

    // The MutationObserver also fires in reading mode; double-processing is prevented
    // by the early-exit guard in processEagleWikilinkEmbed (checks img.complete + naturalWidth).
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue
          try {
            if (node.matches('.internal-embed[src^=".eagle/"]')) {
              this.processEagleWikilinkEmbed(node)
            } else {
              scanEl(node)
            }
          } catch (err) {
            console.error('Eagle: error processing mutation node', { node, err })
          }
        }
      }
    })
    observer.observe(this.app.workspace.containerEl, { childList: true, subtree: true })
    this.register(() => observer.disconnect())

    // Scan already-visible embeds on load and whenever the active leaf changes
    this.app.workspace.onLayoutReady(() => scanEl(this.app.workspace.containerEl))
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => scanEl(this.app.workspace.containerEl)),
    )
  }

  private async checkLibraryPathDrift(): Promise<void> {
    try {
      const currentRoot = await this._eagleUploader.getLibraryRootPath()
      if (!currentRoot) return

      const knownRoot = this.settings.knownLibraryPath
      if (!knownRoot) {
        this.settings.knownLibraryPath = currentRoot
        await this.saveSettings()
        return
      }

      if (knownRoot !== currentRoot) {
        this.settings.knownLibraryPath = currentRoot
        await this.saveSettings()
        new Notice('Eagle: Library path changed. Updating embedded image paths…', 5000)
        await this.updateEagleImagePathsInFiles(this.app.vault.getMarkdownFiles())
      }
    } catch (err) {
      if (err instanceof EagleApiError) return // Eagle not running — expected
      console.error('Eagle: checkLibraryPathDrift failed unexpectedly', err)
    }
  }

  private editorCheckCallbackForLocalUpload = (
    checking: boolean,
    editor: Editor,
    ctx: MarkdownFileInfo,
  ) => {
    const localFile = findLocalFileUnderCursor(editor, ctx)
    if (!localFile) return false
    if (checking) return true

    void this.doUploadLocalImage({ image: localFile, editor, noteFile: ctx.file })
  }

  private editorCheckCallbackForLibraryImport = (checking: boolean, editor: Editor) => {
    if (checking) return true

    void this.importFromLibrary(editor)
    return true
  }

  private importFromLibrary(editor: Editor) {
    new EagleSearchPickerModal(
      this.app,
      this._eagleUploader,
      (item) => {
        void this.insertSelectedSearchItem(editor, item)
      },
      this._settings.debugSearchDiagnostics,
    ).open()
  }

  private async insertSelectedSearchItem(editor: Editor, item: EagleItemSearchResult): Promise<void> {
    try {
      const fileUrl = await this._eagleUploader.resolveFileUrl(item)
      const ext = item.ext || extractFileExtension(fileUrl) || 'jpg'
      if (fileUrl.startsWith('file://')) {
        await this._cacheManager.cacheFromOsPath(item.id, ext, fileUrlToOsPath(fileUrl)).catch((e) => {
          console.debug('Eagle: cache write failed (non-critical)', e)
        })
      }
      const markdownImage = EaglePlugin.markdownImageFor(item.id, ext)
      editor.replaceRange(markdownImage, editor.getCursor())
    } catch (error) {
      if (error instanceof EagleApiError) {
        new Notice(`Failed to import from Eagle: ${error.message}`)
      } else {
        console.error('Unexpected error while importing Eagle image:', error)
        new Notice('Failed to insert Eagle image.')
      }
    }
  }

  private async uploadFileAndEmbedEagleImage(file: File, atPos?: EditorPosition) {
    const pasteId = generatePseudoRandomId()
    this.insertTemporaryText(pasteId, atPos)

    let markdownImage: string
    try {
      const folderName = this.resolveTargetEagleFolderForActiveFile()
      const normalizedFile = await normalizeImageForUpload(file, this._settings)
      const { itemId, fileUrl, ext } = await this._eagleUploader.upload(normalizedFile, { folderName })
      if (fileUrl.startsWith('file://')) {
        await this._cacheManager.cacheFromOsPath(itemId, ext, fileUrlToOsPath(fileUrl)).catch((e) => {
          console.debug('Eagle: cache write failed (non-critical)', e)
        })
      }
      markdownImage = EaglePlugin.markdownImageFor(itemId, ext)
    } catch (e) {
      if (e instanceof EagleApiError) {
        this.handleFailedUpload(pasteId, `Eagle upload failed, API returned an error: ${e.message}`)
      } else {
        console.error('Failed upload request: ', e)
        this.handleFailedUpload(pasteId, '⚠️Eagle upload failed, check dev console')
      }
      throw e
    }
    this.embedMarkDownImage(pasteId, markdownImage)
    return markdownImage
  }

  private insertTemporaryText(pasteId: string, atPos?: EditorPosition) {
    const progressText = EaglePlugin.progressTextFor(pasteId)
    const replacement = `${progressText}\n`
    const editor = this.activeEditor
    if (atPos) {
      editor.replaceRange(replacement, atPos, atPos)
    } else {
      editor.replaceSelection(replacement)
    }
  }

  private static progressTextFor(id: string) {
    return `![Uploading to Eagle...${id}]()`
  }

  private static markdownImageFor(itemId: string, ext: string) {
    return `![[.eagle/${itemId}.${ext}]]`
  }

  private embedMarkDownImage(pasteId: string, markdownImage: string) {
    const progressText = EaglePlugin.progressTextFor(pasteId)

    replaceFirstOccurrence(this.activeEditor, progressText, markdownImage)
  }

  private handleFailedUpload(pasteId: string, message: string) {
    const progressText = EaglePlugin.progressTextFor(pasteId)
    replaceFirstOccurrence(this.activeEditor, progressText, `<!--${message}-->`)
  }

  private get activeEditor(): Editor {
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView)
    return mdView.editor
  }

  getTargetEagleFolderForActiveFile(): string | undefined {
    return this.resolveTargetEagleFolderForActiveFile()
  }

  private resolveTargetEagleFolderForActiveFile(): string | undefined {
    const activeFilePath = this.app.workspace.getActiveFile()?.path ?? null
    const mappedFolderName = resolveMappedEagleFolder(activeFilePath, this._settings.folderMappings)
    if (mappedFolderName) {
      return mappedFolderName
    }

    const fallbackFolderName = this._settings.eagleFolderName.trim()
    return fallbackFolderName || undefined
  }
}
