<script lang="ts">
	import { generateChunkedMosaic } from '$lib/client/chunkedMosaic';

	type MosaicError = { message: string; retry: (() => Promise<void>) | null };

	let mosaicCanvas: HTMLCanvasElement | undefined = $state();
	let tileSize = $state(12);
	let processing = $state(false);
	let errorState = $state<MosaicError | null>(null);
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
		errorState = null;

		try {
			currentBitmap = await createImageBitmap(file);
			await createMosaicFromServer();
		} catch (e) {
			errorState = {
				message: e instanceof Error ? e.message : 'Failed to load image.',
				retry: null
			};
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
		errorState = null;
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
				errorState = {
					message: e instanceof Error ? e.message : 'Failed to generate mosaic.',
					retry: () => createMosaicFromServer()
				};
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

<h2>Mosaic</h2>
<svelte:boundary>
	<div class="mosaic-frame">
		<canvas bind:this={mosaicCanvas}></canvas>
		{#if errorState}
			<div class="error-overlay" role="alert">
				<p>{errorState.message}</p>
				{#if errorState.retry}
					<button type="button" onclick={() => void errorState?.retry?.()}>Retry</button>
				{/if}
			</div>
		{/if}
	</div>

	{#snippet failed(err, reset)}
		<div class="error-overlay error-overlay--fatal" role="alert">
			<p>
				Something went wrong rendering the mosaic: {err instanceof Error
					? err.message
					: 'Unknown error'}
			</p>
			<button type="button" onclick={reset}>Reset</button>
		</div>
	{/snippet}
</svelte:boundary>

<style>
	canvas {
		display: block;
		max-width: 100%;
		height: auto;
	}

	.mosaic-frame {
		position: relative;
		display: inline-block;
		max-width: 100%;
	}

	.error-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		background: rgba(255, 255, 255, 0.85);
		color: #1a1a1a;
		padding: 1rem;
		text-align: center;
	}

	.error-overlay--fatal {
		background: rgba(255, 230, 230, 0.95);
	}
</style>
