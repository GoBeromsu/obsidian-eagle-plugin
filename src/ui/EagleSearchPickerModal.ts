import { App, Modal, TextComponent } from 'obsidian'

import EagleUploader, { EagleItemSearchResult } from '../uploader/EagleUploader'

const SEARCH_DEBOUNCE_MS = 300
const SEARCH_RESULT_LIMIT = 100
const THUMBNAIL_CONCURRENCY = 6

type PickerStatus = 'idle' | 'loading' | 'error' | 'info'

export default class EagleSearchPickerModal extends Modal {
  private readonly uploader: EagleUploader
  private readonly onChoose: (item: EagleItemSearchResult) => void
  private readonly debugSearchDiagnostics: boolean

  private keywordInput: TextComponent
  private statusEl: HTMLElement
  private gridEl: HTMLElement
  private results: EagleItemSearchResult[] = []
  private readonly thumbFallbackMap = new Map<string, HTMLElement>()
  private activeSearchToken = 0
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private isThumbnailFallbackLoading = false

  constructor(
    app: App,
    uploader: EagleUploader,
    onChoose: (item: EagleItemSearchResult) => void,
    debugSearchDiagnostics: boolean,
  ) {
    super(app)
    this.uploader = uploader
    this.onChoose = onChoose
    this.debugSearchDiagnostics = debugSearchDiagnostics
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
    this.renderGrid()

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
    }, SEARCH_DEBOUNCE_MS)
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
    const rawCandidate = rawThumbnail.trim().toLowerCase()
    if (/^\/?api\//.test(rawCandidate)) {
      return 'api'
    }

    const resolvedCandidate = resolvedUrl.trim().toLowerCase()
    if (resolvedCandidate.startsWith('file://')) {
      return 'file'
    }
    if (resolvedCandidate.startsWith('http://') || resolvedCandidate.startsWith('https://')) {
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
        attr: { src: resolvedUrl, loading: 'lazy', alt: item.name || item.id },
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
    } else {
      this.enqueueThumbnailFallback(item, thumbWrapper)
      void this.loadThumbnails(token)
    }

    card.createEl('span', {
      cls: 'eagle-picker-name',
      text: item.name || item.id,
    })

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

  private enqueueThumbnailFallback(item: EagleItemSearchResult, thumbWrapper: HTMLElement): void {
    thumbWrapper.empty()
    thumbWrapper.createEl('span', {
      cls: 'eagle-picker-no-thumb',
      text: item.ext?.toUpperCase() ?? '?',
    })
    this.thumbFallbackMap.set(item.id, thumbWrapper)
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

              const thumbWrapper = this.thumbFallbackMap.get(item.id)
              if (!thumbWrapper) {
                continue
              }

              thumbWrapper.empty()
              thumbWrapper.createEl('img', {
                cls: 'eagle-picker-img',
                attr: { src: thumbnailUrl, loading: 'lazy', alt: item.name || item.id },
              })
              this.thumbFallbackMap.delete(item.id)
              this.debugLog('thumbnail:fallback:ok', {
                token,
                itemId: item.id,
                resolved: thumbnailUrl,
                urlType: this.inferThumbnailUrlType('', thumbnailUrl),
              })
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              this.debugLog('thumbnail:fallback:error', {
                token,
                itemId: item.id,
                message,
              })
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
