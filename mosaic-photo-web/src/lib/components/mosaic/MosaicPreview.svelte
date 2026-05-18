<script lang="ts">
	type MosaicError = { message: string; retry: (() => Promise<void>) | null };

	type Props = {
		mosaicCanvas: HTMLCanvasElement | undefined;
		processing: boolean;
		errorState: MosaicError | null;
		progressLabel: string;
		hasImage: boolean;
	};

	let {
		mosaicCanvas = $bindable(),
		processing,
		errorState,
		progressLabel,
		hasImage
	}: Props = $props();
</script>

{#snippet pending(label: string)}
	<div class="loading-overlay" role="status" aria-live="polite">
		<span class="loading-spinner" aria-hidden="true"></span>
		<p>{label}</p>
	</div>
{/snippet}

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

<style>
	.preview-panel {
		display: grid;
		min-height: min(68vh, 46rem);
		grid-template-rows: auto minmax(18rem, 1fr);
		overflow: hidden;
		border: 1px solid #dfe5ee;
		border-radius: 0.5rem;
		background: #ffffff;
		box-shadow: 0 1.5rem 4rem rgba(23, 32, 51, 0.08);
	}

	.preview-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.25rem;
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

	h2 {
		margin: 0;
		color: #172033;
		font-size: 1.1rem;
		line-height: 1.2;
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
		.preview-panel {
			min-height: 30rem;
		}
	}

	@media (max-width: 560px) {
		.preview-toolbar {
			align-items: flex-start;
			flex-direction: column;
		}

		.preview-panel {
			min-height: 26rem;
		}
	}
</style>
