import { App, FuzzySuggestModal, FuzzyMatch } from 'obsidian'

import { EagleItemSearchResult } from '../uploader/EagleUploader'

export default class EagleItemPickerModal extends FuzzySuggestModal<EagleItemSearchResult> {
  private readonly items: EagleItemSearchResult[]
  private readonly onChoose: (item: EagleItemSearchResult) => void

  constructor(
    app: App,
    items: EagleItemSearchResult[],
    onChoose: (item: EagleItemSearchResult) => void,
  ) {
    super(app)
    this.items = items
    this.onChoose = onChoose
    this.setTitle('Insert Eagle image')
    this.open()
  }

  getItems(): EagleItemSearchResult[] {
    return this.items
  }

  getItemText(item: EagleItemSearchResult): string {
    return item.name || item.id
  }

  renderSuggestion(item: FuzzyMatch<EagleItemSearchResult>, el: HTMLElement): void {
    const title = item.item.name || item.item.id
    const subtitleParts = [
      item.item.ext,
      item.item.tags?.join(', '),
      item.item.annotation,
    ].filter((value): value is string => typeof value === 'string' && value.length > 0)

    el.createEl('div', { text: title })
    if (item.item.id) {
      el.createEl('small', { text: `ID: ${item.item.id}` })
    }
    if (subtitleParts.length > 0) {
      el.createEl('small', { text: subtitleParts.join(' • ') })
    }
  }

  onChooseItem(item: EagleItemSearchResult): void {
    this.close()
    this.onChoose(item)
  }
}
