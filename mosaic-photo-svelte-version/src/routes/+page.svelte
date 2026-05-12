<script lang="ts">
	import { enhance } from '$app/forms';

	let fileInput: HTMLInputElement;
	let originalCanvas: HTMLCanvasElement;
	let mosaicCanvas: HTMLCanvasElement;
	let tileSize = $state(12);
	let currentFile = $state<File | null>(null);
	let processing = $state(false);
	let errorMessage = $state('');
	let mosaicDebounceTimeoutId: ReturnType<typeof setTimeout> | null = null;
	const mosaicDebounceDelayMs = 180;

	async function handleFileChange(event: Event): Promise<void> {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		currentFile = file;
		errorMessage = '';
		await drawOriginalToCanvas(file);
		queueMosaicRefresh();
	}

	function queueMosaicRefresh(): void {
		if (!currentFile) return;
		if (mosaicDebounceTimeoutId) clearTimeout(mosaicDebounceTimeoutId);

		mosaicDebounceTimeoutId = setTimeout(() => {
			mosaicDebounceTimeoutId = null;
			fileInput.form?.requestSubmit();
		}, mosaicDebounceDelayMs);
	}

	async function drawOriginalToCanvas(file: File): Promise<void> {
		const probe = await createImageBitmap(file);
		const maxDimension = 800;
		const scale = Math.min(1, maxDimension / Math.max(probe.width, probe.height));
		const resizeWidth = Math.max(1, Math.round(probe.width * scale));
		const resizeHeight = Math.max(1, Math.round(probe.height * scale));
		probe.close();

		const bitmap = await createImageBitmap(file, { resizeWidth, resizeHeight });
		originalCanvas.width = resizeWidth;
		originalCanvas.height = resizeHeight;

		const ctx = originalCanvas.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, resizeWidth, resizeHeight);
		ctx.drawImage(bitmap, 0, 0);
		bitmap.close();
	}

	function drawMosaicDataUrl(dataUrl: string): void {
		const image = new Image();
		image.onload = () => {
			mosaicCanvas.width = image.width;
			mosaicCanvas.height = image.height;
			const ctx = mosaicCanvas.getContext('2d');
			if (!ctx) return;
			ctx.clearRect(0, 0, image.width, image.height);
			ctx.drawImage(image, 0, 0);
		};
		image.src = dataUrl;
	}
</script>

<form
	method="POST"
	action="?/mosaic"
	enctype="multipart/form-data"
	use:enhance={() => {
		processing = true;
		errorMessage = '';
		return async ({ result }) => {
			processing = false;
			if (result.type === 'failure') {
				errorMessage = String(result.data?.error ?? 'Failed to generate mosaic.');
				return;
			}
			if (result.type === 'success' && result.data?.mosaicDataUrl) {
				drawMosaicDataUrl(String(result.data.mosaicDataUrl));
			}
		};
	}}
>
	<h1>Mosaic Photo Generator</h1>
	<input bind:this={fileInput} type="file" name="image" accept="image/*" onchange={handleFileChange} required />
	<label for="tileSize">Tile Size: {tileSize} px</label>
	<input id="tileSize" type="range" name="tileSize" min="4" max="64" bind:value={tileSize} oninput={queueMosaicRefresh} />
</form>

{#if processing}
	<p>Processing mosaic...</p>
{/if}

{#if errorMessage}
	<p>{errorMessage}</p>
{/if}

<h2>Original</h2>
<canvas bind:this={originalCanvas}></canvas>
<h2>Mosaic</h2>
<canvas bind:this={mosaicCanvas}></canvas>
