import { postMosaicChunk } from './mosaicTransport';

export type ChunkedMosaicOptions = {
	bitmap: ImageBitmap;
	tileSize: number;
	signal: AbortSignal;
	onChunkReady: (chunkBitmap: ImageBitmap, yOffset: number) => void;
	onProgress?: (completed: number, total: number) => void;
	targetChunkHeight?: number;
	concurrency?: number;
};

const DEFAULT_TARGET_CHUNK_HEIGHT = 512;
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
	// Chunk height is forced to a multiple of `tileSize` so a tile never
	// straddles two chunks (which would produce visible seams).
	const chunkBaseHeight = Math.max(tileSize, Math.floor(targetChunkHeight / tileSize) * tileSize);
	const totalChunks = Math.ceil(bitmap.height / chunkBaseHeight);
	if (totalChunks === 0) return;

	// An internal controller lets one failing worker cancel its siblings'
	// in-flight fetches without mutating the caller's signal. External
	// aborts are forwarded into it.
	const internal = new AbortController();
	const forwardAbort = () => internal.abort(signal.reason);
	if (signal.aborted) {
		internal.abort(signal.reason);
	} else {
		signal.addEventListener('abort', forwardAbort, { once: true });
	}

	let nextChunkIndex = 0;
	let completed = 0;
	let workerError: unknown = null;

	onProgress?.(0, totalChunks);

	// Per-worker chunkCanvas — sharing one would race on toBlob().
	// toBlob() reads the canvas asynchronously, so between drawImage and the
	// encode actually running, a sibling worker could resize or repaint the
	// canvas and the resulting blob would silently capture the wrong pixels.
	const runWorker = async (): Promise<void> => {
		const chunkCanvas = document.createElement('canvas');
		chunkCanvas.width = bitmap.width;
		const chunkCtx = chunkCanvas.getContext('2d');
		if (!chunkCtx) {
			if (workerError === null) {
				workerError = new Error('Failed to acquire 2D context for chunk canvas.');
				internal.abort();
			}
			return;
		}

		while (true) {
			if (internal.signal.aborted) return;
			const chunkIndex = nextChunkIndex++;
			if (chunkIndex >= totalChunks) return;

			try {
				const y = chunkIndex * chunkBaseHeight;
				const chunkHeight = Math.min(chunkBaseHeight, bitmap.height - y);
				chunkCanvas.height = chunkHeight;

				chunkCtx.clearRect(0, 0, bitmap.width, chunkHeight);
				chunkCtx.drawImage(
					bitmap,
					0,
					y,
					bitmap.width,
					chunkHeight,
					0,
					0,
					bitmap.width,
					chunkHeight
				);

				const chunkBlob = await new Promise<Blob>((resolve, reject) => {
					chunkCanvas.toBlob(
						(blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode chunk.'))),
						'image/png'
					);
				});

				const mosaicBlob = await postMosaicChunk(chunkBlob, tileSize, internal.signal);
				const mosaicBitmap = await createImageBitmap(mosaicBlob);

				// Re-check after the awaits above. The signal may have aborted
				// while we were decoding, in which case the caller has already
				// moved on and this stale bitmap must not be surfaced.
				if (internal.signal.aborted) {
					mosaicBitmap.close();
					return;
				}

				onChunkReady(mosaicBitmap, y);
				mosaicBitmap.close();

				completed += 1;
				onProgress?.(completed, totalChunks);
			} catch (e) {
				const isAbort = e instanceof DOMException && e.name === 'AbortError';
				if (!isAbort && workerError === null) {
					workerError = e;
					internal.abort();
				}
				return;
			}
		}
	};

	try {
		const workerCount = Math.min(concurrency, totalChunks);
		await Promise.all(Array.from({ length: workerCount }, runWorker));
	} finally {
		signal.removeEventListener('abort', forwardAbort);
	}

	// Surface the first internal error (if any). External aborts resolve
	// silently — the caller asked us to stop, so there's nothing to report.
	if (workerError !== null && !signal.aborted) {
		throw workerError;
	}
}
