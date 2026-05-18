<script lang="ts">
	import MosaicControls from '$lib/components/mosaic/MosaicControls.svelte';
	import MosaicPreview from '$lib/components/mosaic/MosaicPreview.svelte';
	import { generateChunkedMosaic } from '$lib/client/chunkedMosaic';
	import { downloadMosaic as downloadCanvasMosaic } from '$lib/client/downloadMosaic';
	import type { PageProps } from './$types';

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
	let canDownloadMosaic = $derived(hasImage && !processing && !errorState);

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

		await processFile(file);
	}

	async function processFile(file: File): Promise<void> {
		clearDebounce();
		inflightController?.abort();
		currentBitmap?.close();
		currentBitmap = null;
		hasImage = false;
		selectedFileName = '';
		errorState = null;

		if (file.type && !file.type.startsWith('image/')) {
			errorState = {
				message: 'Choose an image file to generate a mosaic.',
				retry: null
			};
			return;
		}

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

	async function downloadMosaic(): Promise<void> {
		await downloadCanvasMosaic({
			canvas: mosaicCanvas,
			canDownloadMosaic,
			selectedFileName
		});
	}
</script>

<section class="editor" aria-labelledby="editor-title">
	<MosaicControls
		bind:tileSize
		tileSliderMin={data.tileSliderMin}
		tileSliderMax={data.tileSliderMax}
		{selectedFileName}
		onFileChange={handleFileChange}
		onTileInput={debounceMosaic}
	/>

	<MosaicPreview
		bind:mosaicCanvas
		{processing}
		{errorState}
		{progressLabel}
		{hasImage}
		{canDownloadMosaic}
		onDownload={downloadMosaic}
		onFileDrop={processFile}
	/>
</section>

<style>
	.editor {
		display: grid;
		grid-template-columns: minmax(17rem, 24rem) minmax(0, 1fr);
		gap: clamp(1rem, 3vw, 1.75rem);
		align-items: stretch;
	}

	@media (max-width: 860px) {
		.editor {
			grid-template-columns: 1fr;
		}
	}
</style>
