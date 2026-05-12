<script lang="ts">
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
			void createMosaicFromServer();
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

	async function createMosaicFromServer(): Promise<void> {
		const blob = await new Promise<Blob>((resolve, reject) => {
			originalCanvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error('Failed to encode canvas as blob.'))),
				'image/png'
			);
		});

		processing = true;
		errorMessage = '';

		try {
			const response = await fetch(`/api/mosaic?tileSize=${tileSize}`, {
				method: 'POST',
				headers: { 'Content-Type': blob.type },
				body: blob
			});

			if (!response.ok) {
				const text = await response.text();
				throw new Error(text || `Mosaic request failed with status ${response.status}`);
			}

			const mosaicBlob = await response.blob();
			const mosaicBitmap = await createImageBitmap(mosaicBlob, { resizeQuality: 'low' });

			mosaicCanvas.width = mosaicBitmap.width;
			mosaicCanvas.height = mosaicBitmap.height;

			const ctx = mosaicCanvas.getContext('2d');
			if (!ctx) return;
			ctx.clearRect(0, 0, mosaicBitmap.width, mosaicBitmap.height);
			ctx.drawImage(mosaicBitmap, 0, 0);
			mosaicBitmap.close();
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Failed to generate mosaic.';
		} finally {
			processing = false;
		}
	}
</script>

<h1>Mosaic Photo Generator</h1>
<input type="file" accept="image/*" onchange={handleFileChange} />
<label for="tileSize">Tile Size: {tileSize} px</label>
<input id="tileSize" type="range" min="4" max="64" bind:value={tileSize} oninput={queueMosaicRefresh} />

{#if errorMessage}
	<p>{errorMessage}</p>
{/if}

<h2>Original</h2>
<canvas bind:this={originalCanvas}></canvas>
<h2>Mosaic</h2>
<canvas bind:this={mosaicCanvas}></canvas>
