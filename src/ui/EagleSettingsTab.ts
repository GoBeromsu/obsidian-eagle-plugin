import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import EagleClient from '../eagle/EagleClient';
import EaglePlugin from '../main';

export default class EagleSettingsTab extends PluginSettingTab {
	// Initialize settings tab with app and plugin references
	constructor(app: App, private plugin: EaglePlugin) {
		super(app, plugin);
	}

	// Render all settings sections in the tab
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Eagle Plugin Settings' });

		// Connection Test - 최상단에 위치
		this.addConnectionTest();

		// Eagle API URL
		this.addEagleApiUrlSetting();

		// Vault Path Setting
		this.addVaultPathSetting();

		// Upload Settings
		this.addUploadSettings();
	}

	// Add connection test button with live status feedback
	private addConnectionTest(): void {
		new Setting(this.containerEl)
			.setName('Test Eagle Connection')
			.setDesc('Test connection to Eagle app')
			.addButton((button) => {
				button
					.setButtonText('Test Connection')
					.setCta()
					.onClick(async () => {
						button.setDisabled(true);
						button.setButtonText('Testing...');

						try {
							const client = new EagleClient(this.plugin.settings.eagleApiUrl);
							const result = await client.testConnection();

							const icon = result.success ? '✅' : '❌';
							new Notice(`${icon} ${result.message}`);
						} catch (error) {
							new Notice('❌ Connection test failed');
						} finally {
							button.setDisabled(false);
							button.setButtonText('Test Connection');
						}
					});
			});
	}

	// Add Eagle API URL configuration setting
	private addEagleApiUrlSetting(): void {
		new Setting(this.containerEl)
			.setName('Eagle API URL')
			.setDesc('Eagle app API URL including port (default: http://localhost:41595)')
			.addText((text) => {
				text
					.setPlaceholder('http://localhost:41595')
					.setValue(this.plugin.settings.eagleApiUrl)
					.onChange(async (value) => {
						this.plugin.settings.eagleApiUrl = value;
						await this.plugin.saveSettings();
					});
			});
	}

	// Add vault path configuration setting
	private addVaultPathSetting(): void {
		new Setting(this.containerEl)
			.setName('Vault Path')
			.setDesc('Absolute path to your Obsidian vault (e.g., /Users/username/Documents/MyVault)')
			.addText((text) => {
				text
					.setPlaceholder('/Users/username/Documents/MyVault')
					.setValue(this.plugin.settings.vaultPath)
					.onChange(async (value) => {
						this.plugin.settings.vaultPath = value;
						await this.plugin.saveSettings();
					});
			});
	}

	// Add upload behavior configuration settings
	private addUploadSettings(): void {
		new Setting(this.containerEl)
			.setName('Enable image upload')
			.setDesc('Automatically upload images to Eagle when detected')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.enableUpload).onChange(async (value) => {
					this.plugin.settings.enableUpload = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(this.containerEl)
			.setName('Show upload confirmation')
			.setDesc('Show confirmation dialog before uploading images')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.showUploadConfirmation).onChange(async (value) => {
					this.plugin.settings.showUploadConfirmation = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(this.containerEl)
			.setName('Default folder ID')
			.setDesc('Eagle folder ID to upload images to (leave empty for root folder)')
			.addText((text) => {
				text
					.setPlaceholder('Enter folder ID (optional)')
					.setValue(this.plugin.settings.defaultFolderId)
					.onChange(async (value) => {
						this.plugin.settings.defaultFolderId = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
