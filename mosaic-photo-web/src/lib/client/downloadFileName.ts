export function getDownloadFileName(selectedFileName: string): string {
	const fallbackName = 'mosaic';
	const trimmedName = selectedFileName.trim();
	if (!trimmedName) return `${fallbackName}.png`;

	const extensionIndex = trimmedName.lastIndexOf('.');
	const baseName = extensionIndex > 0 ? trimmedName.slice(0, extensionIndex).trim() : trimmedName;

	return `${baseName || fallbackName}-mosaic.png`;
}
