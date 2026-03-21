import { App, Modal, TextComponent } from 'obsidian'

import EagleApiError from '../domain/EagleApiError'
import EagleUploader, { EagleItemSearchResult } from './EagleUploader'
import { fileUrlToDisplayUrl } from './file-url'

const SEARCH_RESULT_LIMIT = 100
const THUMBNAIL_CONCURRENCY = 6

type PickerStatus = 'idle' | 'loading' | 'error' | 'info'

export default class EagleSearchPickerModal extends Modal {
  private readonly uploader: EagleUploader
  private readonly onChoose: (item: EagleItemSearchResult) => void
  private readonly debugSearchDiagnostics: boolean
  private readonly debounceMs: number

  private keywordInput: TextComponent
  private statusEl: HTMLElement
  private gridEl: HTMLElement
  private results: EagleItemSearchResult[] = []
  private readonly thumbFallbackMap = new Map<string, { wrapper: HTMLElement; ext?: string }>()
  private activeSearchToken = 0
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private isThumbnailFallbackLoading = false

  constructor(
    app: App,
    uploader: EagleUploader,
    onChoose: (item: EagleItemSearchResult) => void,
    debugSearchDiagnostics: boolean,
    debounceMs = 300,
  ) {
    super(app)
    this.uploader = uploader
    this.onChoose = onChoose
    this.debugSearchDiagnostics = debugSearchDiagnostics
    this.debounceMs = debounceMs
    this.setTitle('Search Eagle library')
  }

  onOpen(): void {
    this.modalEl.addClass('eagle-picker-modal')
    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass('eagle-picker')

    this.keywordInput = new TextComponent(contentEl)
      .setPlaceholder('Type to search title / annotation / tag')
      .setValue('')
    this.keywordInput.inputEl.addClass('eagle-picker-search')
    this.keywordInput.inputEl.addEventListener('input', () => {
      this.scheduleSearch(false)
    })
    this.keywordInput.inputEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault()
        this.scheduleSearch(true)
      }
    })

    this.statusEl = contentEl.createEl('p', {
      cls: 'eagle-picker-status',
      text: 'Type a keyword to search Eagle images.',
    })

    this.gridEl = contentEl.createEl('div', { cls: 'eagle-picker-grid' })
    this.gridEl.addEventListener('keydown', (e: KeyboardEvent) => {
      this.handleGridArrowNav(e)
    })

    this.keywordInput.inputEl.focus()
  }

  onClose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    this.activeSearchToken += 1
    this.isThumbnailFallbackLoading = false
    this.thumbFallbackMap.clear()
    this.contentEl.empty()
  }

  private debugLog(...args: unknown[]): void {
    if (!this.debugSearchDiagnostics) {
      return
    }

    // eslint-disable-next-line no-console
    console.log('[EagleSearchPicker]', ...args)
  }

  private setStatus(text: string, status: PickerStatus): void {
    this.statusEl.setText(text)
    this.statusEl.removeClass(
      'eagle-picker-status-idle',
      'eagle-picker-status-loading',
      'eagle-picker-status-error',
      'eagle-picker-status-info',
    )
    this.statusEl.addClass(`eagle-picker-status-${status}`)
  }

  private scheduleSearch(immediate: boolean): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (immediate) {
      void this.runSearch()
      return
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      void this.runSearch()
    }, this.debounceMs)
  }

  private async runSearch(): Promise<void> {
    const keyword = this.keywordInput.getValue().trim()
    if (!keyword) {
      this.results = []
      this.thumbFallbackMap.clear()
      this.renderGrid()
      this.setStatus('Type a keyword to search Eagle images.', 'idle')
      return
    }

    const token = ++this.activeSearchToken
    this.setStatus('Searching…', 'loading')
    this.debugLog('search:start', { keyword, limit: SEARCH_RESULT_LIMIT, token })

    this.gridEl.empty()
    for (let i = 0; i < 6; i++) {
      this.gridEl.createEl('div', { cls: 'eagle-skeleton-card' })
    }

    try {
      const results = await this.uploader.searchItems({
        keyword,
        limit: SEARCH_RESULT_LIMIT,
        orderBy: 'time',
      })

      if (!this.isTokenActive(token)) {
        this.debugLog('search:stale', { token, keyword })
        return
      }

      this.results = results
      this.thumbFallbackMap.clear()
      this.debugLog('search:done', {
        token,
        keyword,
        count: results.length,
      })
      this.renderGrid(token)

      if (results.length === 0) {
        this.setStatus(`No results for "${keyword}".`, 'info')
      } else {
        this.setStatus(`Found ${results.length} result(s). Select one to insert.`, 'info')
      }
    } catch (error) {
      if (!this.isTokenActive(token)) {
        return
      }

      const message = error instanceof Error ? error.message : String(error)
      this.debugLog('search:error', { token, keyword, message })
      if (!(error instanceof EagleApiError)) {
        // eslint-disable-next-line no-console
        console.error('Eagle: unexpected search error', { keyword, error })
      }
      this.results = []
      this.thumbFallbackMap.clear()
      this.renderGrid()
      this.setStatus(`Search failed: ${message}`, 'error')
    }
  }

  private isTokenActive(token: number): boolean {
    return token === this.activeSearchToken && this.containerEl.isConnected
  }

  private inferThumbnailUrlType(rawThumbnail: string, resolvedUrl: string): 'api' | 'http' | 'file' | 'unknown' {
    const raw = rawThumbnail.trim().toLowerCase()
    if (raw.startsWith('api/') || raw.startsWith('/api/')) {
      return 'api'
    }

    const resolved = resolvedUrl.trim().toLowerCase()
    if (resolved.startsWith('file://')) {
      return 'file'
    }
    if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
      return 'http'
    }

    return 'unknown'
  }

  private renderGrid(token?: number): void {
    this.gridEl.empty()

    if (this.results.length === 0) {
      this.gridEl.createEl('p', {
        text: 'No results.',
        cls: 'eagle-picker-empty',
      })
      return
    }

    for (const item of this.results) {
      this.renderCard(item, token ?? this.activeSearchToken)
    }
  }

  private handleGridArrowNav(e: KeyboardEvent): void {
    const cols = Math.max(1, Math.round(this.gridEl.offsetWidth / 150))
    let delta: number
    switch (e.key) {
      case 'ArrowRight': delta = 1; break
      case 'ArrowLeft': delta = -1; break
      case 'ArrowDown': delta = cols; break
      case 'ArrowUp': delta = -cols; break
      default: return
    }

    const cards = Array.from(this.gridEl.querySelectorAll<HTMLElement>('.eagle-picker-item'))
    const idx = cards.indexOf(document.activeElement as HTMLElement)
    if (idx === -1) return

    const next = cards[idx + delta]
    if (!next) return

    e.preventDefault()
    next.focus()
  }

  private renderCard(item: EagleItemSearchResult, token: number): void {
    const card = this.gridEl.createEl('div', {
      cls: 'eagle-picker-item',
      attr: { role: 'button', tabindex: '0' },
    })

    const thumbWrapper = card.createEl('div', { cls: 'eagle-picker-thumb' })
    if (item.thumbnail) {
      const resolvedUrl = this.uploader.resolveSearchThumbnailUrl(item.thumbnail)
      this.debugLog('thumbnail:metadata', {
        token,
        itemId: item.id,
        raw: item.thumbnail,
        resolved: resolvedUrl,
        urlType: this.inferThumbnailUrlType(item.thumbnail, resolvedUrl),
      })

      const img = thumbWrapper.createEl('img', {
        cls: 'eagle-picker-img',
        attr: { src: fileUrlToDisplayUrl(resolvedUrl), loading: 'lazy', alt: item.name || item.id },
      })
      img.addEventListener('error', () => {
        this.debugLog('thumbnail:metadata:error', {
          token,
          itemId: item.id,
          resolved: resolvedUrl,
        })
        this.enqueueThumbnailFallback(item, thumbWrapper)
        void this.loadThumbnails(token)
      })
      this.appendExtBadge(thumbWrapper, item.ext)
    } else {
      this.enqueueThumbnailFallback(item, thumbWrapper)
      void this.loadThumbnails(token)
    }

    card.createEl('span', {
      cls: 'eagle-picker-name',
      text: item.name || item.id,
    })

    // Tags
    if (item.tags?.length) {
      card.createEl('span', {
        cls: 'eagle-picker-tags',
        text: item.tags.slice(0, 3).join(', ') + (item.tags.length > 3 ? ' \u2026' : ''),
      })
    }

    // Annotation (truncated)
    if (item.annotation) {
      card.createEl('span', {
        cls: 'eagle-picker-annotation',
        text: item.annotation.length > 40 ? item.annotation.slice(0, 40) + '\u2026' : item.annotation,
      })
    }

    const choose = () => {
      this.close()
      this.onChoose(item)
    }

    card.addEventListener('click', choose)
    card.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        choose()
      }
    })
  }

  private appendExtBadge(thumbWrapper: HTMLElement, ext?: string): void {
    if (ext) {
      thumbWrapper.createEl('span', {
        cls: 'eagle-picker-ext-badge',
        text: ext.toUpperCase(),
      })
    }
  }

  private enqueueThumbnailFallback(item: EagleItemSearchResult, thumbWrapper: HTMLElement): void {
    thumbWrapper.empty()
    thumbWrapper.createEl('span', {
      cls: 'eagle-picker-no-thumb',
      text: item.ext?.toUpperCase() ?? '?',
    })
    this.thumbFallbackMap.set(item.id, { wrapper: thumbWrapper, ext: item.ext })
  }

  private async loadThumbnails(token: number): Promise<void> {
    if (this.isThumbnailFallbackLoading) {
      return
    }

    this.isThumbnailFallbackLoading = true
    try {
      while (this.isTokenActive(token)) {
        const pending = this.results.filter((item) => this.thumbFallbackMap.has(item.id))
        if (pending.length === 0) {
          return
        }

        let cursor = 0
        const worker = async () => {
          while (cursor < pending.length) {
            const currentIndex = cursor
            cursor += 1
            const item = pending[currentIndex]
            if (!item || !this.isTokenActive(token)) {
              return
            }

            try {
              const thumbnailUrl = await this.uploader.getThumbnailFileUrl(item.id)
              if (!this.isTokenActive(token)) {
                return
              }

              const entry = this.thumbFallbackMap.get(item.id)
              if (!entry) {
                continue
              }

              const { wrapper: thumbWrapper, ext } = entry
              thumbWrapper.empty()
              thumbWrapper.createEl('img', {
                cls: 'eagle-picker-img',
                attr: { src: fileUrlToDisplayUrl(thumbnailUrl), loading: 'lazy', alt: item.name || item.id },
              })
              this.appendExtBadge(thumbWrapper, ext)
              this.thumbFallbackMap.delete(item.id)
              this.debugLog('thumbnail:fallback:ok', {
                token,
                itemId: item.id,
                resolved: thumbnailUrl,
                urlType: this.inferThumbnailUrlType('', thumbnailUrl),
              })
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              this.debugLog('thumbnail:fallback:error', { token, itemId: item.id, message })
              if (!(error instanceof EagleApiError)) {
                // eslint-disable-next-line no-console
              console.error('Eagle: unexpected thumbnail load failure', { itemId: item.id, error })
              }
            }
          }
        }

        const workerCount = Math.min(THUMBNAIL_CONCURRENCY, pending.length)
        await Promise.all(Array.from({ length: workerCount }, worker))
      }
    } finally {
      this.isThumbnailFallbackLoading = false
    }
  }
}
