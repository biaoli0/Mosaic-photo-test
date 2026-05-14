<script lang="ts">
	let mosaicCanvas: HTMLCanvasElement | undefined = $state();
	let tileSize = $state(12);
	let currentFile = $state<File | null>(null);
	let currentBitmap: ImageBitmap | null = null;
	let processing = $state(false);
	let errorMessage = $state('');
	let progressLabel = $state('');
	let inflightController: AbortController | null = null;
	let mosaicDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	const CHUNK_TARGET_HEIGHT = 512;
	// Debounce slider input so a single drag doesn't fan out into many runs.
	// toBlob() PNG encoding is not cancellable, so aborting mid-drag can't claw
	// back work that has already been queued — debouncing is the only way to
	// avoid the encode in the first place.
	const MOSAIC_DEBOUNCE_DELAY_MS = 180;

	const CHUNK_CONCURRENCY = 4;

	function debounceMosaic(): void {
		if (mosaicDebounceTimer !== null) clearTimeout(mosaicDebounceTimer);
		mosaicDebounceTimer = setTimeout(() => {
			mosaicDebounceTimer = null;
			void createMosaicFromServer();
		}, MOSAIC_DEBOUNCE_DELAY_MS);
	}

	async function handleFileChange(event: Event): Promise<void> {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		if (mosaicDebounceTimer !== null) {
			clearTimeout(mosaicDebounceTimer);
			mosaicDebounceTimer = null;
		}
		inflightController?.abort();
		currentBitmap?.close();
		currentBitmap = null;
		currentFile = file;
		errorMessage = '';

		try {
			currentBitmap = await createImageBitmap(file);
			await createMosaicFromServer();
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Failed to load image.';
		}
	}

	async function createMosaicFromServer(): Promise<void> {
		if (!currentBitmap || !currentFile) return;

		const bitmap = currentBitmap;
		const canvas = mosaicCanvas;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		inflightController?.abort();
		const controller = new AbortController();
		inflightController = controller;

		processing = true;
		errorMessage = '';
		progressLabel = 'Preparing canvas...';

		canvas.width = bitmap.width;
		canvas.height = bitmap.height;
		ctx.clearRect(0, 0, bitmap.width, bitmap.height);

		// We make sure the chunk height is always a multiple of `tileSize`,
		// so tiles aren't cut off at the bottom of each chunk.
		// This prevents visible lines appearing every chunk when tileSize doesn't divide evenly into the chunk size.
		const chunkBaseHeight = Math.max(
			tileSize,
			Math.floor(CHUNK_TARGET_HEIGHT / tileSize) * tileSize
		);
		const totalChunks = Math.ceil(bitmap.height / chunkBaseHeight);

		let nextChunkIndex = 0;
		let completedChunks = 0;

		let workerError: unknown = null;

		progressLabel = `Processing... 0/${totalChunks} chunks done`;

		// Per-worker chunkCanvas — sharing one would race on toBlob().
		// toBlob() reads the canvas asynchronously, so between drawImage and
		// the encode actually running, a sibling worker could resize or
		// repaint the canvas. The resulting blob would silently capture the
		// wrong pixels.
		const runWorker = async (): Promise<void> => {
			const chunkCanvas = document.createElement('canvas');
			chunkCanvas.width = bitmap.width;
			const chunkCtx = chunkCanvas.getContext('2d');
			if (!chunkCtx) {
				if (workerError === null) {
					workerError = new Error('Failed to acquire 2D context for chunk canvas.');
					controller.abort();
				}
				return;
			}

			while (true) {
				if (controller.signal.aborted) return;
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

					const response = await fetch(`/api/mosaic?tileSize=${tileSize}`, {
						method: 'POST',
						headers: {
							'Content-Type': 'image/png'
						},
						body: chunkBlob,
						signal: controller.signal
					});

					if (!response.ok) {
						const text = await response.text();
						throw new Error(text || `Chunk request failed with status ${response.status}`);
					}

					const mosaicBlob = await response.blob();
					const mosaicBitmap = await createImageBitmap(mosaicBlob);
					// Re-check after the awaits above. A newer run may have
					// started in the meantime and cleared the canvas, so this
					// stale bitmap must not paint over it.
					if (controller.signal.aborted) {
						mosaicBitmap.close();
						return;
					}

					ctx.drawImage(mosaicBitmap, 0, y);
					mosaicBitmap.close();

					completedChunks += 1;
					progressLabel = `Processing... ${completedChunks}/${totalChunks} chunks done`;
				} catch (e) {
					const isAbort = e instanceof DOMException && e.name === 'AbortError';
					if (!isAbort && workerError === null) {
						workerError = e;
						controller.abort();
					}
					return;
				}
			}
		};

		try {
			// No point spinning up more workers than there are chunks.
			const workerCount = Math.min(CHUNK_CONCURRENCY, totalChunks);
			await Promise.all(Array.from({ length: workerCount }, runWorker));

			if (controller.signal.aborted) {
				// Two ways we reach this branch:
				//   1. External abort — a newer run took over. 
				//   2. Self-abort — a worker hit an error and aborted everyone
				//      else. 
				if (workerError !== null && inflightController === controller) {
					throw workerError;
				}
				return;
			}

		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			errorMessage = e instanceof Error ? e.message : 'Failed to generate mosaic.';
		} finally {
			if (inflightController === controller) {
				inflightController = null;
				processing = false;
			}
		}
	}
</script>

<h1>Mosaic Photo Generator (Chunked)</h1>
<input type="file" accept="image/*" onchange={handleFileChange} />
<label for="tileSize">Tile Size: {tileSize} px</label>
<input
	id="tileSize"
	type="range"
	min="2"
	max="64"
	bind:value={tileSize}
	oninput={debounceMosaic}
/>

{#if processing}
	<p>{progressLabel}</p>
{/if}

{#if errorMessage}
	<p>{errorMessage}</p>
{/if}

<h2>Mosaic</h2>
<canvas bind:this={mosaicCanvas}></canvas>

<style>
	canvas {
		display: block;
		max-width: 100%;
		height: auto;
	}
</style>
