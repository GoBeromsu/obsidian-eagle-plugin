import { requestUrl } from 'obsidian';
import { EagleAddItemRequest, EagleAddItemResponse, EagleApiResponse } from '../types/eagle';

export class EagleApiError extends Error {
	// Create custom error type for Eagle API failures
	constructor(message: string, public statusCode?: number) {
		super(message);
		this.name = 'EagleApiError';
	}
}

export default class EagleClient {
	// Initialize Eagle API client with base URL
	constructor(private readonly apiUrl: string) {}

	// Fetch Eagle application information and status
	async getApplicationInfo(): Promise<EagleApiResponse> {
		return this.makeRequest('/api/application/info', 'GET');
	}

	// Add new item to Eagle library from file path
	async addItemFromPath(request: EagleAddItemRequest): Promise<EagleAddItemResponse> {
		const response = await this.makeRequest<string>('/api/item/addFromPath', 'POST', request);
		return {
			status: response.status,
			data: response.data!,
			message: response.message,
		};
	}

	// Get thumbnail file path for specific Eagle item
	async getItemThumbnailPath(itemId: string): Promise<EagleApiResponse<string>> {
		return this.makeRequest<string>(`/api/item/thumbnail?id=${itemId}`, 'GET');
	}

	// Test connection to Eagle API and return status
	async testConnection(): Promise<{ success: boolean; message: string }> {
		try {
			const response = await this.getApplicationInfo();
			if (response.status === 'success') {
				return { success: true, message: 'Connected to Eagle successfully' };
			} else {
				return { success: false, message: 'Eagle connection failed' };
			}
		} catch (error) {
			return { success: false, message: `Eagle connection failed: ${error.message}` };
		}
	}

	// Make HTTP request to Eagle API with error handling
	private async makeRequest<T>(
		endpoint: string,
		method: 'GET' | 'POST' | 'PUT' | 'DELETE',
		data?: any
	): Promise<EagleApiResponse<T>> {
		const url = `${this.apiUrl}${endpoint}`;

		console.log(`EagleClient: Making ${method} request to ${url}`);
		if (data) {
			console.log('EagleClient: Request data:', data);
		}

		const requestOptions: any = {
			url,
			method,
			headers: {
				'Content-Type': 'application/json',
			},
		};

		if (data && method !== 'GET') {
			requestOptions.body = JSON.stringify(data);
		}

		try {
			const response = await requestUrl(requestOptions);
			console.log(`EagleClient: Response status: ${response.status}`);
			console.log('EagleClient: Response data:', response.json);

			if (response.status >= 400) {
				throw new EagleApiError(`HTTP ${response.status}`, response.status);
			}

			return response.json as EagleApiResponse<T>;
		} catch (error) {
			console.error(`EagleClient: Request failed for ${url}:`, error);
			if (error instanceof EagleApiError) {
				throw error;
			}
			throw new EagleApiError('Network error');
		}
	}
}
