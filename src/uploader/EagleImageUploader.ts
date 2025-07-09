import { App } from 'obsidian';
import EagleClient from '../eagle/EagleClient';
import ImageUploader, { EagleAddItemRequest } from '../types/eagle';

export default class EagleImageUploader implements ImageUploader {
	// Initialize uploader with required dependencies and settings
	constructor(
		private readonly app: App,
		private readonly eagleClient: EagleClient,
		private readonly defaultFolderId?: string,
		private readonly vaultPath?: string
	) {}

	// Upload image file to Eagle and return file URL
	async upload(image: File): Promise<string> {
		const tempPath = await this.saveToTempLocation(image);
		const itemId = await this.uploadToEagle(image, tempPath);

		await this.delay(1000);

		const thumbnailPath = await this.getThumbnailPath(itemId);
		return thumbnailPath ? `file://${thumbnailPath}` : `file://${tempPath}`;
	}

	// Upload file to Eagle API and return item ID
	private async uploadToEagle(image: File, tempPath: string): Promise<string> {
		const request: EagleAddItemRequest = {
			path: tempPath,
			name: image.name,
			folderId: this.defaultFolderId || undefined,
		};

		const response = await this.eagleClient.addItemFromPath(request);

		if (response.status !== 'success' || !response.data) {
			throw new Error(`Eagle API returned error: ${response.status}`);
		}

		return response.data;
	}

	// Save image file to temporary location for Eagle access
	private async saveToTempLocation(image: File): Promise<string> {
		const tempDir = '.eagle-temp';
		const tempDirPath = this.getTempDirPath(tempDir);

		await this.app.vault.adapter.mkdir(tempDirPath);

		const timestamp = Date.now();
		const filename = `${timestamp}-${image.name}`;
		const tempFilePath = `${tempDirPath}/${filename}`;

		const buffer = await image.arrayBuffer();
		const uint8Array = new Uint8Array(buffer);
		await this.app.vault.adapter.writeBinary(tempFilePath, uint8Array);

		return this.getAbsolutePath(tempFilePath);
	}

	// Get Eagle thumbnail path for uploaded item
	private async getThumbnailPath(itemId: string): Promise<string | null> {
		const response = await this.eagleClient.getItemThumbnailPath(itemId);
		return response.status === 'success' && response.data ? response.data : null;
	}

	// Wait for specified number of milliseconds
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	// Get full path to temporary directory
	private getTempDirPath(tempDir: string): string {
		const vaultPath = this.vaultPath || this.app.vault.configDir.replace('/.obsidian', '');
		return `${vaultPath}/${tempDir}`;
	}

	// Convert relative path to absolute path
	private getAbsolutePath(relativePath: string): string {
		const vaultPath = this.vaultPath || this.app.vault.configDir.replace('/.obsidian', '');
		return `${vaultPath}/${relativePath}`;
	}
}
