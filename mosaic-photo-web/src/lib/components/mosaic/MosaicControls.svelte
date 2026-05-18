<script lang="ts">
	type Props = {
		tileSize: number;
		tileSliderMin: number;
		tileSliderMax: number;
		selectedFileName: string;
		onFileChange: (event: Event) => void | Promise<void>;
		onTileInput: () => void;
	};

	let {
		tileSize = $bindable(),
		tileSliderMin,
		tileSliderMax,
		selectedFileName,
		onFileChange,
		onTileInput
	}: Props = $props();
</script>

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
			<input type="file" accept="image/*" onchange={onFileChange} />
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
			min={tileSliderMin}
			max={tileSliderMax}
			bind:value={tileSize}
			oninput={onTileInput}
		/>
	</div>
</aside>

<style>
	.control-panel {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		border: 1px solid #dfe5ee;
		border-radius: 0.5rem;
		background: #ffffff;
		padding: clamp(1rem, 3vw, 1.5rem);
		box-shadow: 0 1.5rem 4rem rgba(23, 32, 51, 0.08);
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
	.summary {
		margin: 0;
	}

	h1 {
		max-width: 12ch;
		color: #111827;
		font-size: clamp(2rem, 5vw, 0.1rem);
		line-height: 0.98;
		letter-spacing: 0;
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

	@media (max-width: 860px) {
		h1 {
			max-width: 16ch;
		}
	}

	@media (max-width: 560px) {
		.range-header {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
