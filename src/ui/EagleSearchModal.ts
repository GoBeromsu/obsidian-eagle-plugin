import { App, ButtonComponent, Modal, TextComponent } from 'obsidian'

export default class EagleSearchModal extends Modal {
  private readonly keywordValueChanged: (keyword: string) => void
  private readonly textInput: TextComponent

  constructor(app: App, onSubmit: (keyword: string) => void) {
    super(app)
    this.keywordValueChanged = onSubmit

    this.setTitle('Search Eagle library')
    this.contentEl.createEl('p', { text: 'Enter a keyword (title, annotation, or tags).' })

    this.textInput = new TextComponent(this.contentEl)
      .setPlaceholder('ex) landscape')
      .setValue('')

    this.textInput.inputEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault()
        this.submit()
      }
    })

    const buttonsDiv = this.modalEl.createDiv('modal-button-container')
    new ButtonComponent(buttonsDiv)
      .setButtonText('Search')
      .onClick(() => this.submit())
    new ButtonComponent(buttonsDiv)
      .setButtonText('Cancel')
      .onClick(() => this.close())
  }

  onOpen() {
    super.onOpen()
    this.textInput.inputEl.focus()
  }

  private submit() {
    const keyword = this.textInput.getValue().trim()
    if (!keyword) return

    // Blur before closing to prevent Korean IME composition from being flushed into the editor
    this.textInput.inputEl.blur()
    this.close()
    this.keywordValueChanged(keyword)
  }
}
