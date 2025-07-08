// Check if all files in the list are valid image types
export function allFilesAreImages(files: FileList | File[]): boolean {
	if (!files || files.length === 0) {
		return false;
	}

	const imageTypes = [
		'image/jpeg',
		'image/jpg',
		'image/png',
		'image/gif',
		'image/webp',
		'image/bmp',
	];

	const fileArray = Array.from(files);
	for (const file of fileArray) {
		if (!imageTypes.includes(file.type)) {
			return false;
		}
	}

	return true;
}
