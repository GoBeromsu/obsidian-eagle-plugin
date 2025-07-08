export interface EagleApiResponse<T = any> {
	status: 'success' | 'error';
	data?: T;
	message?: string;
}
export default interface ImageUploader {
	upload(image: File): Promise<string>;
}

export interface EagleApplicationInfo {
	version: string;
	platform: string;
	buildNumber?: string;
}

export interface EagleFolder {
	id: string;
	name: string;
	description?: string;
	imageCount: number;
	children?: EagleFolder[];
}

export interface EagleAddItemRequest {
	path: string;
	name: string;
	website?: string;
	tags?: string[];
	annotation?: string;
	folderId?: string;
	star?: number;
}

export interface EagleAddItemResponse extends EagleApiResponse<string> {
	data: string;
}
