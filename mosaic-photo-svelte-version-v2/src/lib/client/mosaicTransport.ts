const BACKEND_BASE_URL = (
	import.meta.env.VITE_MOSAIC_BACKEND_URL ?? 'http://localhost:3001'
).replace(/\/+$/, '');

export async function postMosaicChunk(
	chunkRgba: Uint8Array,
	width: number,
	height: number,
	tileSize: number,
	signal: AbortSignal
): Promise<Blob> {
	const response = await fetch(
		`${BACKEND_BASE_URL}/mosaic?tileSize=${tileSize}&width=${width}&height=${height}`,
		{
		method: 'POST',
		headers: { 'Content-Type': 'application/octet-stream' },
		body: chunkRgba,
		signal
	}
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(text || `Mosaic request failed with status ${response.status}`);
	}

	return response.blob();
}
