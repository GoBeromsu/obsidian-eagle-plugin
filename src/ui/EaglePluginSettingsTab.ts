import { App, ButtonComponent, PluginSettingTab, Setting, TextComponent } from 'obsidian'

import EaglePlugin from '../EaglePlugin'
import { ObsidianEagleFolderMapping } from '../plugin-settings'
import { sanitizeFolderMappings } from '../utils/folder-mapping'

export default class EaglePluginSettingsTab extends PluginSettingTab {
  plugin: EaglePlugin

  constructor(app: App, plugin: EaglePlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this

    containerEl.empty()

    containerEl.createEl('h2', { text: 'Eagle Plugin Settings' })

    new Setting(containerEl)
      .setName('Eagle API Host')
      .setDesc('The host for your running Eagle instance.')
      .addText((text) =>
        text
          .setPlaceholder('localhost')
          .setValue(this.plugin.settings.eagleHost)
          .onChange((value) => {
            this.plugin.settings.eagleHost = value
          }),
      )

    new Setting(containerEl)
      .setName('Eagle API Port')
      .setDesc('The port for your running Eagle instance.')
      .addText((text) =>
        text
          .setPlaceholder('41595')
          .setValue(this.plugin.settings.eaglePort.toString())
          .onChange((value) => {
            this.plugin.settings.eaglePort = value ? Number.parseInt(value) : 41595
          }),
      )

    new Setting(containerEl)
      .setName('Eagle Folder Name')
      .setDesc(
        'The folder name in Eagle where images will be saved. Leave empty to save to the default folder.',
      )
      .addText((text) =>
        text
          .setPlaceholder('Obsidian')
          .setValue(this.plugin.settings.eagleFolderName)
          .onChange((value) => {
            this.plugin.settings.eagleFolderName = value
          }),
      )

    new Setting(containerEl)
      .setName('Fallback format for unsupported images')
      .setDesc('Convert unsupported image formats to this format before upload.')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('jpeg', 'jpeg')
          .addOption('png', 'png')
          .addOption('webp', 'webp')
          .setValue(this.plugin.settings.fallbackImageFormat)
          .onChange((value) => {
            this.plugin.settings.fallbackImageFormat = value as 'jpeg' | 'png' | 'webp'
          }),
      )

    new Setting(containerEl)
      .setName('JPEG conversion quality')
      .setDesc('Quality for JPEG conversion output (0~1).')
      .addText((text) =>
        text
          .setPlaceholder('0.9')
          .setValue(this.plugin.settings.conversionQualityForJpeg.toString())
          .onChange((value) => {
            const parsed = Number.parseFloat(value)
            if (!Number.isNaN(parsed)) {
              this.plugin.settings.conversionQualityForJpeg = Math.min(1, Math.max(0, parsed))
            }
          }),
      )

    this.renderFolderMappingsSection(containerEl)
  }

  private renderFolderMappingsSection(containerEl: HTMLElement): void {
    const mappings = this.plugin.settings.folderMappings ?? []
    this.plugin.settings.folderMappings = mappings

    containerEl.createEl('h3', { text: 'Folder Mapping (Obsidian -> Eagle)' })
    containerEl.createEl('p', {
      cls: 'eagle-folder-mapping-description',
      text: 'Route uploads by active note folder. Longest matching folder rule is applied.',
    })

    const listContainer = containerEl.createDiv({ cls: 'eagle-folder-mapping-list' })
    const renderRows = () => {
      listContainer.empty()

      if (this.plugin.settings.folderMappings.length === 0) {
        listContainer.createEl('p', {
          cls: 'eagle-folder-mapping-empty',
          text: 'No mappings yet. Add one to route specific Obsidian folders to Eagle folders.',
        })
        return
      }

      this.plugin.settings.folderMappings.forEach((mapping, index) => {
        this.renderFolderMappingRow(listContainer, mapping, index, renderRows)
      })
    }

    const actionsContainer = containerEl.createDiv({ cls: 'eagle-folder-mapping-actions' })
    new ButtonComponent(actionsContainer)
      .setButtonText('Add mapping')
      .setCta()
      .onClick(() => {
        this.plugin.settings.folderMappings.push({
          obsidianFolder: '',
          eagleFolder: '',
        })
        renderRows()
      })

    renderRows()
  }

  private renderFolderMappingRow(
    listContainer: HTMLElement,
    mapping: ObsidianEagleFolderMapping,
    index: number,
    onRemoved: () => void,
  ): void {
    const row = listContainer.createDiv({ cls: 'eagle-folder-mapping-row' })

    const obsidianFolderInput = new TextComponent(row)
      .setPlaceholder('Obsidian folder (ex: Projects/Design)')
      .setValue(mapping.obsidianFolder)
      .onChange((value) => {
        const currentMapping = this.plugin.settings.folderMappings[index]
        if (!currentMapping) {
          return
        }
        currentMapping.obsidianFolder = value
      })
    obsidianFolderInput.inputEl.addClass('eagle-folder-mapping-input')

    const eagleFolderInput = new TextComponent(row)
      .setPlaceholder('Eagle folder (ex: Design)')
      .setValue(mapping.eagleFolder)
      .onChange((value) => {
        const currentMapping = this.plugin.settings.folderMappings[index]
        if (!currentMapping) {
          return
        }
        currentMapping.eagleFolder = value
      })
    eagleFolderInput.inputEl.addClass('eagle-folder-mapping-input')

    new ButtonComponent(row)
      .setIcon('trash')
      .setTooltip('Remove mapping')
      .onClick(() => {
        this.plugin.settings.folderMappings.splice(index, 1)
        onRemoved()
      })
  }

  override hide() {
    this.plugin.settings.folderMappings = sanitizeFolderMappings(
      this.plugin.settings.folderMappings ?? [],
    )
    void this.plugin.saveSettings()
  }
}
