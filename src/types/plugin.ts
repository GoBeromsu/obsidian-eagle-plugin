export interface EaglePluginSettings {
	eagleApiUrl: string;
	vaultPath: string;
	enableUpload: boolean;
	showUploadConfirmation: boolean;
	defaultFolderId: string;
}

export const DEFAULT_SETTINGS: EaglePluginSettings = {
	eagleApiUrl: 'http://localhost:41595',
	vaultPath: '',
	enableUpload: true,
	showUploadConfirmation: true,
	defaultFolderId: '',
};
