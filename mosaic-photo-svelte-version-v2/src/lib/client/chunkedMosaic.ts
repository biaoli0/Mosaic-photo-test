import { createChunkExtractor } from './chunkExtractor';
import { planChunks } from './chunkPlanner';
import { postMosaicChunk } from './mosaicTransport';
import { runWorkerPool } from './workerPool';

export type ChunkedMosaicOptions = {
	bitmap: ImageBitmap;
	tileSize: number;
	signal: AbortSignal;
	onChunkReady: (chunkBitmap: ImageBitmap, yOffset: number) => void;
	onProgress?: (completed: number, total: number) => void;
	targetChunkHeight?: number;
	concurrency?: number;
};

const DEFAULT_TARGET_CHUNK_HEIGHT = 1024;
const DEFAULT_CONCURRENCY = 4;

export async function generateChunkedMosaic({
	bitmap,
	tileSize,
	signal,
	onChunkReady,
	onProgress,
	targetChunkHeight = DEFAULT_TARGET_CHUNK_HEIGHT,
	concurrency = DEFAULT_CONCURRENCY
}: ChunkedMosaicOptions): Promise<void> {
	const plans = planChunks(bitmap.height, tileSize, targetChunkHeight);
	const total = plans.length;
	if (total === 0) return;

	let completed = 0;
	onProgress?.(0, total);

	await runWorkerPool({
		total,
		concurrency,
		externalSignal: signal,
		runWorker: async ({ signal: poolSignal, claimNext }) => {
			const extract = createChunkExtractor(bitmap);

			while (true) {
				if (poolSignal.aborted) return;
				const i = claimNext();
				if (i >= total) return;

				const plan = plans[i];
				const chunkBlob = await extract(plan);
				const mosaicBlob = await postMosaicChunk(chunkBlob, tileSize, poolSignal);
				const mosaicBitmap = await createImageBitmap(mosaicBlob);

				// Re-check after the awaits above. The signal may have aborted
				// while we were decoding.
				if (poolSignal.aborted) {
					mosaicBitmap.close();
					return;
				}

				onChunkReady(mosaicBitmap, plan.y);
				mosaicBitmap.close();

				completed += 1;
				onProgress?.(completed, total);
			}
		}
	});
}
