<script lang="ts">
	import { generateChunkedMosaic } from '$lib/client/chunkedMosaic';

	let mosaicCanvas: HTMLCanvasElement | undefined = $state();
	let tileSize = $state(12);
	let processing = $state(false);
	let errorMessage = $state('');
	let progressLabel = $state('');

	let currentBitmap: ImageBitmap | null = null;
	let inflightController: AbortController | null = null;
	let mosaicDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Debounce slider input so a single drag doesn't fan out into many runs.
	// toBlob() PNG encoding is not cancellable, so aborting mid-drag can't claw
	// back work that has already been queued — debouncing is the only way to
	// avoid the encode in the first place.
	const MOSAIC_DEBOUNCE_DELAY_MS = 180;

	function clearDebounce(): void {
		if (mosaicDebounceTimer !== null) {
			clearTimeout(mosaicDebounceTimer);
			mosaicDebounceTimer = null;
		}
	}

	function debounceMosaic(): void {
		clearDebounce();
		mosaicDebounceTimer = setTimeout(() => {
			mosaicDebounceTimer = null;
			void createMosaicFromServer();
		}, MOSAIC_DEBOUNCE_DELAY_MS);
	}

	async function handleFileChange(event: Event): Promise<void> {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		clearDebounce();
		inflightController?.abort();
		currentBitmap?.close();
		currentBitmap = null;
		errorMessage = '';

		try {
			currentBitmap = await createImageBitmap(file);
			await createMosaicFromServer();
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Failed to load image.';
		}
	}

	async function createMosaicFromServer(): Promise<void> {
		if (!currentBitmap) return;

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

		try {
			await generateChunkedMosaic({
				bitmap,
				tileSize,
				signal: controller.signal,
				onChunkReady: (chunkBitmap, y) => {
					// A newer run may have replaced us between when this chunk
					// was decoded and now. Don't paint stale pixels onto the
					// canvas it has already cleared.
					if (controller.signal.aborted) return;
					ctx.drawImage(chunkBitmap, 0, y);
				},
				onProgress: (done, total) => {
					if (controller.signal.aborted) return;
					progressLabel = `Processing... ${done}/${total} chunks done`;
				}
			});
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			// Only surface the error if we're still the current run. A newer
			// run that supersedes us owns the UI state.
			if (inflightController === controller) {
				errorMessage = e instanceof Error ? e.message : 'Failed to generate mosaic.';
			}
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
<input id="tileSize" type="range" min="2" max="64" bind:value={tileSize} oninput={debounceMosaic} />

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
