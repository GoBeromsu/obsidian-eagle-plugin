import { App, FuzzySuggestModal, TFolder } from 'obsidian'

export default class VaultFolderSuggestModal extends FuzzySuggestModal<TFolder> {
  private readonly onChoose: (folder: TFolder) => void

  constructor(app: App, onChoose: (folder: TFolder) => void) {
    super(app)
    this.onChoose = onChoose
    this.setPlaceholder('Type to search vault folders…')
  }

  getItems(): TFolder[] {
    return this.app.vault.getAllFolders(true)
  }

  getItemText(folder: TFolder): string {
    return folder.path === '/' ? '/ (vault root)' : folder.path
  }

  onChooseItem(folder: TFolder): void {
    this.onChoose(folder)
  }
}
