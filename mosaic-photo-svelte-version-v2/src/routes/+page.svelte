<script lang="ts">
	let mosaicCanvas: HTMLCanvasElement | undefined = $state();
	let tileSize = $state(12);
	let currentFile = $state<File | null>(null);
	let currentBitmap: ImageBitmap | null = null;
	let processing = $state(false);
	let errorMessage = $state('');
	let progressLabel = $state('');
	let inflightController: AbortController | null = null;

	const CHUNK_TARGET_HEIGHT = 512;

	async function handleFileChange(event: Event): Promise<void> {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

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

		inflightController?.abort();
		const controller = new AbortController();
		inflightController = controller;

		processing = true;
		errorMessage = '';
		progressLabel = 'Preparing canvas...';

		const bitmap = currentBitmap;
		const canvas = mosaicCanvas;
		if (!canvas) return;
		canvas.width = bitmap.width;
		canvas.height = bitmap.height;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, bitmap.width, bitmap.height);

		const chunkCanvas = document.createElement('canvas');
		chunkCanvas.width = bitmap.width;
		const chunkCtx = chunkCanvas.getContext('2d', { willReadFrequently: true });
		if (!chunkCtx) return;

		// We make sure the chunk height is always a multiple of `tileSize`,
		// so tiles aren't cut off at the bottom of each chunk.
		// This prevents visible lines appearing every chunk when tileSize doesn't divide evenly into the chunk size.

		const chunkBaseHeight = Math.max(
			tileSize,
			Math.floor(CHUNK_TARGET_HEIGHT / tileSize) * tileSize
		);
		const totalChunks = Math.ceil(bitmap.height / chunkBaseHeight);

		try {
			for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
				if (controller.signal.aborted) return;
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

				progressLabel = `Processing chunk ${chunkIndex + 1}/${totalChunks}...`;
				const response = await fetch(`/api/mosaic?tileSize=${tileSize}`, {
					method: 'POST',
					headers: {
						'Content-Type': 'image/png',
						'X-Chunk-Index': String(chunkIndex),
						'X-Chunk-Offset-Y': String(y)
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
				ctx.drawImage(mosaicBitmap, 0, y);
				mosaicBitmap.close();
			}
			progressLabel = 'Done';
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
	oninput={createMosaicFromServer}
/>

{#if processing}
	<p>{progressLabel}</p>
{/if}

{#if errorMessage}
	<p>{errorMessage}</p>
{/if}

<h2>Mosaic</h2>
<canvas bind:this={mosaicCanvas}></canvas>
