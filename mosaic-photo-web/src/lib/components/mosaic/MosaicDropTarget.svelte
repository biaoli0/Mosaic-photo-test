<script lang="ts">
	type Props = {
		onFileDrop: (file: File) => void | Promise<void>;
	};

	let { onFileDrop }: Props = $props();
	let draggingFile = $state(false);

	function handleDragEnter(event: DragEvent): void {
		event.preventDefault();
		if (event.dataTransfer?.types.includes('Files')) {
			draggingFile = true;
		}
	}

	function handleDragOver(event: DragEvent): void {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
		}
	}

	function handleDragLeave(event: DragEvent): void {
		event.preventDefault();
		if (event.currentTarget === event.target) {
			draggingFile = false;
		}
	}

	function handleDrop(event: DragEvent): void {
		event.preventDefault();
		draggingFile = false;

		const file = event.dataTransfer?.files[0];
		if (!file) return;

		void onFileDrop(file);
	}
</script>

<div
	class="drop-target"
	class:drop-target--active={draggingFile}
	aria-label="Drop image to generate mosaic"
	ondragenter={handleDragEnter}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role="presentation"
></div>

<style>
	.drop-target {
		position: absolute;
		inset: 0;
		z-index: 1;
		border: 2px solid transparent;
		pointer-events: auto;
		transition:
			border-color 120ms ease,
			background 120ms ease;
	}

	.drop-target--active {
		border-color: #0f766e;
		background: rgba(15, 118, 110, 0.1);
	}
</style>
