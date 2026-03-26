import { App, ButtonComponent, Modal } from 'obsidian'

export default class RenameCacheModal extends Modal {
  constructor(
    app: App,
    private readonly oldFolder: string,
    private readonly newFolder: string,
    private readonly onConfirm: () => void,
  ) {
    super(app)
  }

  override onOpen() {
    const { contentEl } = this

    this.setTitle('Rename cache folder?')

    contentEl.createEl('p', {
      text: `Cache folder changed from '${this.oldFolder}' to '${this.newFolder}'.`,
    })
    contentEl.createEl('p', {
      text: 'Move existing cached files and update all wikilinks in your vault?',
    })

    const buttonsDiv = this.modalEl.createDiv('modal-button-container')

    new ButtonComponent(buttonsDiv)
      .setButtonText('Move & update')
      .setCta()
      .onClick(() => {
        this.close()
        this.onConfirm()
      })

    new ButtonComponent(buttonsDiv).setButtonText('Skip').onClick(() => {
      this.close()
    })
  }

  override onClose() {
    this.contentEl.empty()
  }
}
