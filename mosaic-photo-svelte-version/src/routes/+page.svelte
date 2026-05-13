<script lang="ts">
	let originalCanvas: HTMLCanvasElement | undefined = $state();
	let mosaicCanvas: HTMLCanvasElement | undefined = $state();
	let tileSize = $state(12);
	let currentFile = $state<File | null>(null);
	let currentBlob: Blob | null = null;
	let processing = $state(false);
	let showOverlay = $state(false);
	let errorMessage = $state('');
	let mosaicDebounceTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let overlayTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let inflightController: AbortController | null = null;
	const mosaicDebounceDelayMs = 180;
	// Below this threshold, requests finish before the user can perceive the overlay,
	// so showing it would just be a flicker. Roughly one frame past human reaction time.
	const overlayDelayMs = 250;

	async function handleFileChange(event: Event): Promise<void> {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		currentFile = file;
		errorMessage = '';
		try {
			await drawOriginalToCanvas(file);
		} catch (e) {
			currentFile = null;
			errorMessage = e instanceof Error ? e.message : 'Failed to load image.';
			return;
		}
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
		const canvas = originalCanvas;
		if (!canvas) return;
		currentBlob = null;
		const probe = await createImageBitmap(file);
		const maxDimension = 800;
		const scale = Math.min(1, maxDimension / Math.max(probe.width, probe.height));
		const resizeWidth = Math.max(1, Math.round(probe.width * scale));
		const resizeHeight = Math.max(1, Math.round(probe.height * scale));
		probe.close();

		const bitmap = await createImageBitmap(file, { resizeWidth, resizeHeight });
		canvas.width = resizeWidth;
		canvas.height = resizeHeight;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, resizeWidth, resizeHeight);
		ctx.drawImage(bitmap, 0, 0);
		bitmap.close();

		// Cache the encoded blob so subsequent tile-size tweaks don't re-encode the same pixels.
		currentBlob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error('Failed to encode canvas as blob.'))),
				'image/png'
			);
		});
	}

	async function createMosaicFromServer(): Promise<void> {
		const blob = currentBlob;
		if (!blob) return;

		// Cancel any in-flight request so a slow older response can't overwrite a newer one.
		inflightController?.abort();
		const controller = new AbortController();
		inflightController = controller;

		processing = true;
		errorMessage = '';

		if (overlayTimeoutId) clearTimeout(overlayTimeoutId);
		overlayTimeoutId = setTimeout(() => {
			overlayTimeoutId = null;
			if (inflightController === controller) showOverlay = true;
		}, overlayDelayMs);

		try {
			const response = await fetch(`/api/mosaic?tileSize=${tileSize}`, {
				method: 'POST',
				headers: { 'Content-Type': blob.type },
				body: blob,
				signal: controller.signal
			});

			if (!response.ok) {
				const text = await response.text();
				throw new Error(text || `Mosaic request failed with status ${response.status}`);
			}

			const mosaicBlob = await response.blob();
			const mosaicBitmap = await createImageBitmap(mosaicBlob, { resizeQuality: 'low' });

			// A newer request may have superseded this one while we were decoding.
			if (controller.signal.aborted) {
				mosaicBitmap.close();
				return;
			}

			const canvas = mosaicCanvas;
			if (!canvas) {
				mosaicBitmap.close();
				return;
			}
			canvas.width = mosaicBitmap.width;
			canvas.height = mosaicBitmap.height;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				mosaicBitmap.close();
				return;
			}
			ctx.clearRect(0, 0, mosaicBitmap.width, mosaicBitmap.height);
			ctx.drawImage(mosaicBitmap, 0, 0);
			mosaicBitmap.close();
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			errorMessage = e instanceof Error ? e.message : 'Failed to generate mosaic.';
		} finally {
			// Only clear `processing` if no newer request has taken over.
			if (inflightController === controller) {
				inflightController = null;
				processing = false;
				if (overlayTimeoutId) {
					clearTimeout(overlayTimeoutId);
					overlayTimeoutId = null;
				}
				showOverlay = false;
			}
		}
	}
</script>

<h1>Mosaic Photo Generator</h1>
<input type="file" accept="image/*" onchange={handleFileChange} />
<label for="tileSize">Tile Size: {tileSize} px</label>
<input id="tileSize" type="range" min="2" max="64" bind:value={tileSize} oninput={queueMosaicRefresh} />

{#if errorMessage}
	<p>{errorMessage}</p>
{/if}

<h2>Original</h2>
<canvas bind:this={originalCanvas}></canvas>
<h2>Mosaic</h2>
<div class="mosaic-wrap" aria-busy={processing}>
	<canvas bind:this={mosaicCanvas} class:is-processing={showOverlay}></canvas>
	{#if showOverlay}
		<div class="mosaic-overlay" role="status" aria-live="polite">
			<span class="spinner" aria-hidden="true"></span>
			<span class="overlay-label">Processing…</span>
		</div>
	{/if}
</div>

<style>
	.mosaic-wrap {
		position: relative;
		display: inline-block;
	}

	canvas.is-processing {
		opacity: 0.6;
		transition: opacity 120ms ease;
	}

	.mosaic-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		pointer-events: none;
		background: rgba(255, 255, 255, 0.35);
		font: 500 0.95rem system-ui, sans-serif;
		color: #222;
	}

	.spinner {
		width: 1.25rem;
		height: 1.25rem;
		border: 2px solid rgba(0, 0, 0, 0.2);
		border-top-color: #222;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
