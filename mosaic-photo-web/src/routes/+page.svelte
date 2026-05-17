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
	let hasImage = $state(false);
	let selectedFileName = $state('');

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
		hasImage = false;
		selectedFileName = '';
		errorState = null;

		try {
			currentBitmap = await createImageBitmap(file);
			hasImage = true;
			selectedFileName = file.name;
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

<section class="editor" aria-labelledby="editor-title">
	<aside class="control-panel" aria-label="Mosaic controls">
		<div class="panel-heading">
			<p class="eyebrow">Generator</p>
			<h1 id="editor-title">Turn an image into a mosaic</h1>
			<p class="summary">
				Choose a photo, then tune the tile size until the mosaic has the right texture.
			</p>
		</div>

		<div class="control-group">
			<span class="control-label">Source image</span>
			<label class="upload-button">
				<input type="file" accept="image/*" onchange={handleFileChange} />
				<span>Choose image</span>
			</label>
			<p class="file-status">{selectedFileName || 'No image selected'}</p>
		</div>

		<div class="control-group">
			<div class="range-header">
				<label class="control-label" for="tileSize">Tile size</label>
				<span class="range-value">{tileSize} px</span>
			</div>
			<input
				id="tileSize"
				class="tile-range"
				type="range"
				min={data.tileSliderMin}
				max={data.tileSliderMax}
				bind:value={tileSize}
				oninput={debounceMosaic}
			/>
		</div>
	</aside>

	<svelte:boundary>
		<div class="preview-panel">
			<div class="preview-toolbar">
				<div>
					<p class="eyebrow">Preview</p>
					<h2>Mosaic output</h2>
				</div>
				{#if processing && !errorState}
					<span class="status-pill">Processing</span>
				{:else if hasImage}
					<span class="status-pill status-pill--ready">Ready</span>
				{:else}
					<span class="status-pill">Empty</span>
				{/if}
			</div>

			<div class="mosaic-frame" class:has-image={hasImage}>
				{#if !hasImage && !processing && !errorState}
					<div class="empty-preview">
						<span class="empty-preview-icon" aria-hidden="true"></span>
						<p>Choose an image to generate a mosaic preview.</p>
					</div>
				{/if}
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
</section>

<style>
	.editor {
		display: grid;
		grid-template-columns: minmax(17rem, 24rem) minmax(0, 1fr);
		gap: clamp(1rem, 3vw, 1.75rem);
		align-items: stretch;
	}

	.control-panel,
	.preview-panel {
		border: 1px solid #dfe5ee;
		border-radius: 0.5rem;
		background: #ffffff;
		box-shadow: 0 1.5rem 4rem rgba(23, 32, 51, 0.08);
	}

	.control-panel {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: clamp(1rem, 3vw, 1.5rem);
	}

	.panel-heading {
		padding-bottom: 1rem;
		border-bottom: 1px solid #edf1f6;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		color: #2563eb;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0;
		text-transform: uppercase;
	}

	h1,
	h2,
	.summary {
		margin: 0;
	}

	h1 {
		max-width: 12ch;
		color: #111827;
		font-size: clamp(2rem, 5vw, 3.5rem);
		line-height: 0.98;
		letter-spacing: 0;
	}

	h2 {
		color: #172033;
		font-size: 1.1rem;
		line-height: 1.2;
	}

	.summary {
		margin-top: 1rem;
		color: #647086;
		line-height: 1.55;
	}

	.control-group {
		display: grid;
		gap: 0.7rem;
	}

	.control-label {
		color: #344054;
		font-size: 0.86rem;
		font-weight: 700;
	}

	.upload-button {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 3rem;
		border: 1px solid #1d4ed8;
		border-radius: 0.45rem;
		background: #2563eb;
		color: #ffffff;
		font-weight: 800;
		box-shadow: 0 0.8rem 1.8rem rgba(37, 99, 235, 0.2);
		cursor: pointer;
		transition:
			background 120ms ease,
			transform 120ms ease,
			box-shadow 120ms ease;
	}

	.upload-button:hover {
		background: #1d4ed8;
		box-shadow: 0 1rem 2rem rgba(37, 99, 235, 0.25);
		transform: translateY(-1px);
	}

	.upload-button input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
	}

	.file-status {
		min-height: 1.25rem;
		margin: 0;
		overflow: hidden;
		color: #647086;
		font-size: 0.85rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.range-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.range-value {
		border: 1px solid #d7deea;
		border-radius: 999px;
		background: #f8fafc;
		color: #172033;
		padding: 0.25rem 0.65rem;
		font-size: 0.82rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.tile-range {
		width: 100%;
		accent-color: #2563eb;
	}

	.preview-panel {
		display: grid;
		min-height: min(68vh, 46rem);
		grid-template-rows: auto minmax(18rem, 1fr);
		overflow: hidden;
	}

	.preview-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #edf1f6;
	}

	.status-pill {
		border: 1px solid #d7deea;
		border-radius: 999px;
		background: #f8fafc;
		color: #647086;
		padding: 0.3rem 0.7rem;
		font-size: 0.78rem;
		font-weight: 800;
		white-space: nowrap;
	}

	.status-pill--ready {
		border-color: #b8e3d6;
		background: #ecfdf5;
		color: #047857;
	}

	canvas {
		display: block;
		max-width: 100%;
		height: auto;
	}

	.mosaic-frame:not(.has-image) canvas {
		display: none;
	}

	.mosaic-frame {
		position: relative;
		display: grid;
		min-height: 100%;
		place-items: center;
		overflow: auto;
		background:
			linear-gradient(45deg, #eef2f7 25%, transparent 25%),
			linear-gradient(-45deg, #eef2f7 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, #eef2f7 75%),
			linear-gradient(-45deg, transparent 75%, #eef2f7 75%), #f8fafc;
		background-position:
			0 0,
			0 0.5rem,
			0.5rem -0.5rem,
			-0.5rem 0;
		background-size: 1rem 1rem;
	}

	.mosaic-frame.has-image {
		padding: clamp(0.75rem, 2vw, 1.5rem);
	}

	.empty-preview {
		display: grid;
		place-items: center;
		gap: 1rem;
		width: min(28rem, calc(100% - 2rem));
		min-height: 16rem;
		border: 1px dashed #b8c4d6;
		border-radius: 0.5rem;
		background: rgba(255, 255, 255, 0.76);
		padding: 2rem;
		color: #647086;
		text-align: center;
	}

	.empty-preview p {
		max-width: 20rem;
		margin: 0;
		line-height: 1.5;
	}

	.empty-preview-icon {
		width: 4.5rem;
		height: 4.5rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
		background:
			linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(20, 184, 166, 0.18)),
			repeating-linear-gradient(45deg, #ffffff 0 0.42rem, #e8edf5 0.42rem 0.84rem);
		box-shadow: inset 0 0 0 0.5rem rgba(255, 255, 255, 0.55);
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

	.loading-overlay p {
		margin: 0;
		font-weight: 700;
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

	.error-overlay p {
		max-width: 28rem;
		margin: 0;
		line-height: 1.5;
	}

	.error-overlay button {
		border: 1px solid #1d4ed8;
		border-radius: 0.4rem;
		background: #2563eb;
		color: #ffffff;
		padding: 0.6rem 1rem;
		font-weight: 800;
	}

	.error-overlay--fatal {
		background: rgba(255, 230, 230, 0.95);
	}

	@media (max-width: 860px) {
		.editor {
			grid-template-columns: 1fr;
		}

		h1 {
			max-width: 16ch;
		}

		.preview-panel {
			min-height: 30rem;
		}
	}

	@media (max-width: 560px) {
		.preview-toolbar,
		.range-header {
			align-items: flex-start;
			flex-direction: column;
		}

		.preview-panel {
			min-height: 26rem;
		}
	}
</style>
