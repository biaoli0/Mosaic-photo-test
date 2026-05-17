import type { ChunkPlan } from './chunkPlanner';

export type ChunkExtractor = (plan: ChunkPlan) => Promise<Blob>;

// Each extractor owns a canvas because toBlob() reads asynchronously;
// sharing one across parallel extracts can encode the wrong pixels.
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
