export async function postMosaicChunk(
	chunkBlob: Blob,
	tileSize: number,
	signal: AbortSignal
): Promise<Blob> {
	const response = await fetch(`/api/mosaic?tileSize=${tileSize}`, {
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
