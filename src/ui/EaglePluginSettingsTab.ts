import { App, ButtonComponent, Notice, PluginSettingTab, Setting, TextComponent } from 'obsidian'

import EaglePlugin from '../EaglePlugin'
import { ObsidianEagleFolderMapping } from '../plugin-settings'
import { sanitizeFolderMappings } from '../utils/folder-mapping'
import RenameCacheModal from './RenameCacheModal'

export default class EaglePluginSettingsTab extends PluginSettingTab {
  plugin: EaglePlugin
  private originalCacheFolderName = ''

  constructor(app: App, plugin: EaglePlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this

    this.originalCacheFolderName = this.plugin.settings.cacheFolderName

    containerEl.empty()

    containerEl.createEl('h2', { text: 'Eagle Plugin Settings' })

    // ── Connection ──────────────────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Connection' })

    new Setting(containerEl)
      .setName('Eagle API Host')
      .setDesc('The host for your running Eagle instance.')
      .addText((text) =>
        text
          .setPlaceholder('localhost')
          .setValue(this.plugin.settings.eagleHost)
          .onChange((value) => {
            this.plugin.settings.eagleHost = value
            void this.plugin.saveSettings()
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
            void this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Test connection')
      .setDesc('Verify that Eagle is reachable with the current host and port.')
      .addButton((btn) => {
        btn.setButtonText('Test Connection').onClick(async () => {
          btn.setDisabled(true)
          btn.setButtonText('Testing…')
          const connected = await this.plugin.eagleUploader.isConnected()
          if (connected) {
            new Notice('Connected to Eagle')
          } else {
            new Notice('Cannot reach Eagle — check host/port')
          }
          btn.setDisabled(false)
          btn.setButtonText('Test Connection')
        })
      })

    containerEl.createEl('hr')

    // ── Upload ───────────────────────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Upload' })

    const folderSetting = new Setting(containerEl)
      .setName('Eagle Folder Name')
      .setDesc(
        'The folder name in Eagle where images will be saved. Leave empty to save to the default folder.',
      )

    folderSetting.addText((text) =>
      text
        .setPlaceholder('Obsidian')
        .setValue(this.plugin.settings.eagleFolderName)
        .onChange((value) => {
          this.plugin.settings.eagleFolderName = value
          void this.plugin.saveSettings()
        }),
    )

    void this.upgradeToFolderDropdown(folderSetting)

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
            void this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('JPEG conversion quality')
      .setDesc('Quality for JPEG conversion output (0–1).')
      .addSlider((slider) =>
        slider
          .setLimits(0, 1, 0.05)
          .setValue(this.plugin.settings.conversionQualityForJpeg)
          .setDynamicTooltip()
          .onChange((value) => {
            this.plugin.settings.conversionQualityForJpeg = value
            void this.plugin.saveSettings()
          }),
      )

    containerEl.createEl('hr')

    // ── Cache ────────────────────────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Cache' })

    new Setting(containerEl)
      .setName('Cache folder name')
      .setDesc(
        "Images are cached here (supports subfolders: '80. References/07. eagle'). After renaming, confirm to move existing images.",
      )
      .addText((text) =>
        text
          .setPlaceholder('eagle-cache')
          .setValue(this.plugin.settings.cacheFolderName)
          .onChange((value) => {
            this.plugin.settings.cacheFolderName = value.trim() || 'eagle-cache'
            void this.plugin.saveSettings()
          }),
      )

    containerEl.createEl('hr')

    // ── Advanced ─────────────────────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Advanced' })

    new Setting(containerEl)
      .setName('Search diagnostics (debug)')
      .setDesc('Log search/thumbnail resolution details to the dev console.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.debugSearchDiagnostics)
          .onChange((value) => {
            this.plugin.settings.debugSearchDiagnostics = value
            void this.plugin.saveSettings()
          }),
      )

    containerEl.createEl('hr')

    this.renderFolderMappingsSection(containerEl)
  }

  private renderFolderMappingsSection(containerEl: HTMLElement): void {
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

    const addMappingInput = (
      placeholder: string,
      value: string,
      field: keyof ObsidianEagleFolderMapping,
    ) => {
      const input = new TextComponent(row)
        .setPlaceholder(placeholder)
        .setValue(value)
        .onChange((newValue) => {
          const currentMapping = this.plugin.settings.folderMappings[index]
          if (!currentMapping) return
          currentMapping[field] = newValue
          void this.plugin.saveSettings()
        })
      input.inputEl.addClass('eagle-folder-mapping-input')
    }

    addMappingInput('Obsidian folder (ex: Projects/Design)', mapping.obsidianFolder, 'obsidianFolder')
    addMappingInput('Eagle folder (ex: Design)', mapping.eagleFolder, 'eagleFolder')

    new ButtonComponent(row)
      .setIcon('trash')
      .setTooltip('Remove mapping')
      .onClick(() => {
        this.plugin.settings.folderMappings.splice(index, 1)
        onRemoved()
        void this.plugin.saveSettings()
      })
  }

  /**
   * Try to replace the plain text input with a live dropdown populated from Eagle.
   * If Eagle is unreachable, keep the text input and update the description.
   */
  private async upgradeToFolderDropdown(folderSetting: Setting): Promise<void> {
    try {
      const folders = await this.plugin.eagleUploader.listFolders()
      folderSetting.controlEl.empty()
      folderSetting.addDropdown((dropdown) => {
        dropdown.addOption('', '— default folder —')
        for (const folder of folders) {
          dropdown.addOption(folder.path, folder.path)
        }
        const currentValue = this.plugin.settings.eagleFolderName
        const exists = folders.some((f) => f.path === currentValue)
        if (currentValue && !exists) {
          dropdown.addOption(currentValue, currentValue)
        }
        dropdown.setValue(currentValue)
        dropdown.onChange((value) => {
          this.plugin.settings.eagleFolderName = value
          void this.plugin.saveSettings()
        })
      })
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('connect'))) {
        console.error('Eagle: unexpected error while loading folder list', err)
      }
      folderSetting.setDesc(
        'The folder name in Eagle where images will be saved. (Eagle not reachable — type folder name manually)',
      )
    }
  }

  override hide() {
    this.plugin.settings.folderMappings = sanitizeFolderMappings(
      this.plugin.settings.folderMappings,
    )
    void this.plugin.saveSettings()

    const newFolder = this.plugin.settings.cacheFolderName
    if (this.originalCacheFolderName && newFolder !== this.originalCacheFolderName) {
      new RenameCacheModal(
        this.plugin.app,
        this.originalCacheFolderName,
        newFolder,
        () => void this.plugin.renameCache(this.originalCacheFolderName, newFolder),
      ).open()
      this.originalCacheFolderName = newFolder
    }
  }
}
