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

import { createEagleCanvasPasteHandler } from './Canvas'
import { DEFAULT_SETTINGS, EaglePluginSettings } from './plugin-settings'
import EaglePluginSettingsTab from './ui/EaglePluginSettingsTab'
import InfoModal from './ui/InfoModal'
import UpdateLinksConfirmationModal from './ui/UpdateLinksConfirmationModal'
import EagleApiError from './uploader/EagleApiError'
import EagleUploader from './uploader/EagleUploader'
import { findLocalFileUnderCursor, replaceFirstOccurrence } from './utils/editor'
import { allFilesAreImages } from './utils/FileList'
import { findMarkdownImageTokens } from './utils/markdown-image'
import { fixImageTypeIfNeeded, removeReferenceIfPresent } from './utils/misc'
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
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this._settings)
  }

  override onload() {
    void this.initPlugin()
  }

  private async initPlugin() {
    await this.loadSettings()
    this.addSettingTab(new EaglePluginSettingsTab(this.app, this))

    this.setupEagleUploader()
    this.setupEagleHandlers()
    this.addUploadLocalCommand()
    this.addUpdateEmbeddedImagePathsCommands()
  }

  setupEagleUploader(): void {
    this._eagleUploader = new EagleUploader(this.app, this._settings)

    // Fix image type if needed for better compatibility
    const originalUploadFunction = this._eagleUploader.upload.bind(this._eagleUploader)
    this._eagleUploader.upload = (image: File) => originalUploadFunction(fixImageTypeIfNeeded(image))
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

  private static eagleItemIdFromAlt(alt: string) {
    const match = /^eagle:([A-Za-z0-9]+)$/.exec(alt.trim())
    return match ? match[1] : null
  }

  private static eagleItemIdFromLink(link: string) {
    const match = /[\\/]+images[\\/]+([^\\/]+)\.info[\\/]+/i.exec(link)
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
    }

    if (candidatesByFile.size === 0) {
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
          const fileUrl = await this.eagleUploader.getFileUrlForItemId(itemId)
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

      const sorted = replacements.sort((a, b) => b.start - a.start)
      let updated = content
      for (const r of sorted) {
        updated = updated.slice(0, r.start) + r.text + updated.slice(r.end)
      }

      if (updated !== content) {
        await this.app.vault.modify(file, updated)
        updatedFilesCount += 1
        updatedLinksCount += replacements.length
      }
    }

    const summaryParts = [`Eagle: Updated ${updatedLinksCount} image link(s) in ${updatedFilesCount} file(s).`]
    if (failedItemIds.size > 0) {
      summaryParts.push(`Failed to resolve ${failedItemIds.size} item(s).`)
    }

    new Notice(summaryParts.join(' '))
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

  private async uploadFileAndEmbedEagleImage(file: File, atPos?: EditorPosition) {
    const pasteId = generatePseudoRandomId()
    this.insertTemporaryText(pasteId, atPos)

    let markdownImage: string
    try {
      const { itemId, fileUrl } = await this.eagleUploader.upload(file)
      markdownImage = EaglePlugin.markdownImageFor(itemId, fileUrl)
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

  private static markdownImageFor(itemId: string, fileUrl: string) {
    return `![eagle:${itemId}](${fileUrl})`
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
}
