import { App, Modal, Setting } from 'obsidian';

interface UploadConfirmationResponse {
	shouldUpload?: boolean;
	alwaysUpload?: boolean;
}

export default class UploadConfirmationModal extends Modal {
	private resolvePromise: (value: UploadConfirmationResponse) => void;
	private response: UploadConfirmationResponse = {};

	// Initialize modal with app reference
	constructor(app: App) {
		super(app);
	}

	// Create modal content with upload confirmation options
	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Upload to Eagle?' });

		// Yes/No buttons with icons
		new Setting(contentEl)
			.setName('Upload Image')
			.setDesc('Upload the image to Eagle and insert the link')
			.addButton((button) => {
				button
					.setIcon('check')
					.setTooltip('Upload to Eagle')
					.setCta()
					.onClick(() => {
						this.response.shouldUpload = true;
						this.close();
					});
			})
			.addButton((button) => {
				button
					.setIcon('x')
					.setTooltip('Cancel')
					.onClick(() => {
						this.response.shouldUpload = false;
						this.close();
					});
			});

		// Simple don't ask again option
		new Setting(contentEl)
			.setName('Always upload without asking')
			.setDesc('Skip this confirmation dialog and automatically upload images in the future')
			.addToggle((toggle) => {
				toggle.onChange((value) => {
					this.response.alwaysUpload = value;
				});
			});
	}

	// Resolve promise with user response when modal closes
	onClose() {
		if (this.resolvePromise) {
			this.resolvePromise(this.response);
		}
	}

	// Return promise that resolves with user's choice
	getResponse(): Promise<UploadConfirmationResponse> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
		});
	}
}
