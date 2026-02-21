import { App, Modal } from 'obsidian'

import EagleUploader, { EagleItemSearchResult } from '../uploader/EagleUploader'
import { normalizeEagleApiPathToFileUrl } from '../utils/file-url'

const THUMBNAIL_CONCURRENCY = 6

export default class EagleItemPickerModal extends Modal {
  private readonly items: EagleItemSearchResult[]
  private readonly onChoose: (item: EagleItemSearchResult) => void
  private readonly uploader: EagleUploader
  private filteredItems: EagleItemSearchResult[]
  private gridEl: HTMLElement
  private readonly thumbElMap = new Map<string, HTMLElement>()

  constructor(
    app: App,
    items: EagleItemSearchResult[],
    onChoose: (item: EagleItemSearchResult) => void,
    uploader: EagleUploader,
  ) {
    super(app)
    this.items = items
    this.filteredItems = items
    this.onChoose = onChoose
    this.uploader = uploader
    this.setTitle('Insert Eagle image')
    this.open()
  }

  onOpen(): void {
    this.modalEl.addClass('eagle-picker-modal')

    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass('eagle-picker')

    const searchInput = contentEl.createEl('input', {
      type: 'text',
      placeholder: 'Filter by name or tag…',
      cls: 'eagle-picker-search',
    })
    searchInput.addEventListener('input', () => {
      this.applyFilter(searchInput.value)
    })

    this.gridEl = contentEl.createEl('div', { cls: 'eagle-picker-grid' })
    this.renderGrid()

    void this.loadThumbnails()

    searchInput.focus()
  }

  onClose(): void {
    this.thumbElMap.clear()
    this.contentEl.empty()
  }

  private applyFilter(query: string): void {
    const q = query.toLowerCase().trim()
    this.filteredItems = q
      ? this.items.filter(
          (item) =>
            (item.name || item.id).toLowerCase().includes(q) ||
            item.tags?.some((t) => t.toLowerCase().includes(q)) ||
            item.annotation?.toLowerCase().includes(q),
        )
      : this.items
    this.renderGrid()
  }

  private renderGrid(): void {
    this.gridEl.empty()

    if (this.filteredItems.length === 0) {
      this.gridEl.createEl('p', { text: 'No results.', cls: 'eagle-picker-empty' })
      return
    }

    for (const item of this.filteredItems) {
      this.renderCard(item)
    }
  }

  private renderCard(item: EagleItemSearchResult): void {
    const card = this.gridEl.createEl('div', {
      cls: 'eagle-picker-item',
      attr: { role: 'button', tabindex: '0' },
    })

    const thumbWrapper = card.createEl('div', { cls: 'eagle-picker-thumb' })

    // If filePath is present use it directly; otherwise show ext badge and
    // let loadThumbnails() replace it asynchronously.
    if (item.thumbnail) {
      const imgUrl = normalizeEagleApiPathToFileUrl(item.thumbnail)
      thumbWrapper.createEl('img', {
        cls: 'eagle-picker-img',
        attr: { src: imgUrl, loading: 'lazy', alt: item.name || item.id },
      })
    } else {
      thumbWrapper.createEl('span', {
        cls: 'eagle-picker-no-thumb',
        text: item.ext?.toUpperCase() ?? '?',
      })
      this.thumbElMap.set(item.id, thumbWrapper)
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
    card.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        choose()
      }
    })
  }

  private async loadThumbnails(): Promise<void> {
    const pending = this.items.filter((item) => !item.thumbnail && this.thumbElMap.has(item.id))
    if (pending.length === 0) return

    let cursor = 0

    const worker = async () => {
      while (cursor < pending.length) {
        const idx = cursor++
        const item = pending[idx]
        if (!item) continue

        // Stop if modal was closed
        if (!this.containerEl.isConnected) return

        try {
          const url = await this.uploader.getThumbnailFileUrl(item.id)

          if (!this.containerEl.isConnected) return

          const thumbWrapper = this.thumbElMap.get(item.id)
          if (thumbWrapper) {
            thumbWrapper.empty()
            thumbWrapper.createEl('img', {
              cls: 'eagle-picker-img',
              attr: { src: url, loading: 'lazy', alt: item.name || item.id },
            })
          }
        } catch {
          // Keep ext badge on failure
        }
      }
    }

    const workerCount = Math.min(THUMBNAIL_CONCURRENCY, pending.length)
    await Promise.all(Array.from({ length: workerCount }, worker))
  }
}
