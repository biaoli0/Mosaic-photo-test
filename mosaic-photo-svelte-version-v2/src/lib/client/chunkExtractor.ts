import type { ChunkPlan } from './chunkPlanner';

export type ChunkExtractor = (plan: ChunkPlan) => Promise<Blob>;

// Each call returns a fresh extractor that owns its own canvas. Callers
// running extractors in parallel must each get their own — sharing one
// would race on toBlob(): toBlob() reads the canvas asynchronously, so
// between drawImage and the encode actually running, a sibling could
// resize or repaint the canvas and the resulting blob would silently
// capture the wrong pixels.
export function createChunkExtractor(bitmap: ImageBitmap): ChunkExtractor {
	const canvas = document.createElement('canvas');
	canvas.width = bitmap.width;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Failed to acquire 2D context for chunk canvas.');
	}

	return async function extract({ y, height }: ChunkPlan): Promise<Blob> {
		canvas.height = height;
		ctx.clearRect(0, 0, bitmap.width, height);
		ctx.drawImage(bitmap, 0, y, bitmap.width, height, 0, 0, bitmap.width, height);

		return await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode chunk.'))),
				'image/png'
			);
		});
	};
}
