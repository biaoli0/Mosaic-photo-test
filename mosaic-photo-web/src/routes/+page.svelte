<script lang="ts">
	import type { PageProps } from './$types';
	import { generateChunkedMosaic } from '$lib/client/chunkedMosaic';

	let { data }: PageProps = $props();

	type MosaicError = { message: string; retry: (() => Promise<void>) | null };

	let mosaicCanvas: HTMLCanvasElement | undefined = $state();
	let tileSize = $state(12);
	let tileSizeSeededFromLoad = $state(false);
	let processing = $state(false);
	let errorState = $state<MosaicError | null>(null);
	let progressLabel = $state('');

	let currentBitmap: ImageBitmap | null = null;
	let inflightController: AbortController | null = null;
	let mosaicDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	$effect.pre(() => {
		if (tileSizeSeededFromLoad) return;
		tileSize = data.tileSizeDefault;
		tileSizeSeededFromLoad = true;
	});

	// Debouncing prevents queued canvas encodes that AbortController cannot cancel.
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
				targetChunkHeight: data.mosaicChunkTargetHeight,
				concurrency: data.mosaicChunkConcurrency,
				signal: controller.signal,
				onChunkReady: (chunkBitmap, y) => {
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

{#snippet pending(label: string)}
	<div class="loading-overlay" role="status" aria-live="polite">
		<span class="loading-spinner" aria-hidden="true"></span>
		<p>{label}</p>
	</div>
{/snippet}

<h1>Mosaic Photo Generator</h1>
<input type="file" accept="image/*" onchange={handleFileChange} />
<label for="tileSize">Tile Size: {tileSize} px</label>
<input
	id="tileSize"
	type="range"
	min={data.tileSliderMin}
	max={data.tileSliderMax}
	bind:value={tileSize}
	oninput={debounceMosaic}
/>

<svelte:boundary>
	<div class="mosaic-frame">
		<canvas bind:this={mosaicCanvas}></canvas>
		{#if processing && !errorState}
			{@render pending(progressLabel)}
		{/if}
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
		margin:10px;
	}

	.loading-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		background: rgba(255, 255, 255, 0.65);
		color: #1a1a1a;
		padding: 1rem;
		text-align: center;
		pointer-events: none;
	}

	.loading-spinner {
		width: 1.1rem;
		height: 1.1rem;
		border: 2px solid rgba(0, 0, 0, 0.2);
		border-top-color: #1a1a1a;
		border-radius: 50%;
		animation: loading-spin 0.8s linear infinite;
	}

	@keyframes loading-spin {
		to {
			transform: rotate(360deg);
		}
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
