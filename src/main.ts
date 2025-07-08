import { Editor, MarkdownView, Notice, Plugin } from 'obsidian';
import EagleClient from './eagle/EagleClient';
import ImageUploader from './types/eagle';
import { DEFAULT_SETTINGS, EaglePluginSettings } from './types/plugin';
import EagleSettingsTab from './ui/EagleSettingsTab';
import UploadConfirmationModal from './ui/UploadConfirmationModal';
import buildUploaderFrom from './uploader/uploaderFactory';
import { allFilesAreImages } from './utils/FileList';

export default class EaglePlugin extends Plugin {
	settings: EaglePluginSettings;
	eagleClient: EagleClient;
	private imageUploader: ImageUploader | undefined;

	// Initialize plugin components and event handlers
	async onload() {
		await this.loadSettings();
		this.initializeEagleClient();
		this.setupImageUploader();

		// Add settings tab
		this.addSettingTab(new EagleSettingsTab(this.app, this));

		// Setup paste handler
		this.setupPasteHandler();

		// Add ribbon icon for quick health check
		const ribbonIconEl = this.addRibbonIcon('image', 'Eagle Plugin Health Check', async () => {
			await this.performHealthCheck();
		});
		ribbonIconEl.addClass('eagle-plugin-ribbon-class');

		// Add command for health check
		this.addCommand({
			id: 'eagle-health-check',
			name: 'Test Eagle Connection',
			callback: async () => {
				await this.performHealthCheck();
			},
		});
	}

	// Clean up plugin resources when unloading
	onunload() {
		// Clean up if needed
	}

	// Load plugin settings from data file with default fallbacks
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	// Save current settings and reinitialize components
	async saveSettings() {
		await this.saveData(this.settings);
		this.initializeEagleClient();
		this.setupImageUploader();
	}

	// Create Eagle API client with current settings
	private initializeEagleClient() {
		this.eagleClient = new EagleClient(this.settings.eagleApiUrl);
	}

	// Initialize image uploader if upload is enabled
	private setupImageUploader() {
		this.imageUploader = buildUploaderFrom(this.app, this.eagleClient, this.settings);
	}

	// Register clipboard paste event handler for image uploads
	private setupPasteHandler() {
		this.registerEvent(this.app.workspace.on('editor-paste', this.handlePaste.bind(this)));
	}

	// Process clipboard paste events and upload images to Eagle
	private async handlePaste(evt: ClipboardEvent, editor: Editor, view: MarkdownView) {
		if (!this.imageUploader) {
			return;
		}

		const { files } = evt.clipboardData || { files: null };
		if (!files || !allFilesAreImages(files)) {
			return;
		}

		evt.preventDefault();

		// Show confirmation if enabled
		if (this.settings.showUploadConfirmation) {
			const modal = new UploadConfirmationModal(this.app);
			modal.open();

			const userResponse = await modal.getResponse();
			if (userResponse.shouldUpload !== true) {
				return;
			}

			if (userResponse.alwaysUpload) {
				this.settings.showUploadConfirmation = false;
				await this.saveSettings();
			}
		}

		// Upload images using Eagle API thumbnails
		for (const file of Array.from(files)) {
			try {
				const imageUrl = await this.imageUploader.upload(file);
				const markdownImage = `![${file.name}](${imageUrl})`;
				editor.replaceSelection(markdownImage);
			} catch (error) {
				console.error('Failed to upload image:', error);
				new Notice(`Failed to upload image: ${error.message}`);
			}
		}
	}

	// Test Eagle API connection and display status notification
	private async performHealthCheck() {
		try {
			const result = await this.eagleClient.testConnection();
			const icon = result.success ? '✅' : '❌';
			new Notice(`${icon} ${result.message}`);
		} catch (error) {
			new Notice('❌ Eagle health check failed');
		}
	}
}
