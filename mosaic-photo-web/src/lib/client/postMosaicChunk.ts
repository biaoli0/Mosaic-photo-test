const BACKEND_BASE_URL = (
	import.meta.env.VITE_MOSAIC_PHOTO_API_URL ?? 'http://localhost:3001'
).replace(/\/+$/, '');

export async function postMosaicChunk(
	chunkBlob: Blob,
	tileSize: number,
	signal: AbortSignal
): Promise<Blob> {
	const response = await fetch(`${BACKEND_BASE_URL}/mosaic?tileSize=${tileSize}`, {
		method: 'POST',
		headers: { 'Content-Type': 'image/png' },
		body: chunkBlob,
		signal
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(text || `Mosaic request failed with status ${response.status}`);
	}

	return response.blob();
}
