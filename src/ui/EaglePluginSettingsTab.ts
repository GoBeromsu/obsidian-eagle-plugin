import { App, PluginSettingTab, Setting } from 'obsidian'

import EaglePlugin from '../EaglePlugin'

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
  }

  override hide() {
    void this.plugin.saveSettings()
  }
}
