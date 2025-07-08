import { App } from 'obsidian';
import EagleClient from '../eagle/EagleClient';
import { EaglePluginSettings } from '../types/plugin';
import EagleImageUploader from './EagleImageUploader';
import ImageUploader from '../types/eagle';

// Create image uploader instance based on plugin settings
export default function buildUploaderFrom(
	app: App,
	eagleClient: EagleClient,
	settings: EaglePluginSettings
): ImageUploader | undefined {
	if (!settings.enableUpload) {
		return undefined;
	}

	return new EagleImageUploader(
		app,
		eagleClient,
		settings.defaultFolderId || undefined,
		settings.vaultPath || undefined
	);
}
