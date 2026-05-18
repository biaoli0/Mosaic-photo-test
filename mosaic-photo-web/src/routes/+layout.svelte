<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Mosaic Photo</title>
</svelte:head>

<div class="app-shell">
	<header class="app-header">
		<a class="brand" href="/" aria-label="Mosaic Photo home">
			<span class="brand-mark" aria-hidden="true"></span>
			<span>
				<strong>Mosaic Photo</strong>
				<small>Image mosaic editor</small>
			</span>
		</a>
	</header>

	<main class="app-main">
		{@render children()}
	</main>

	<footer class="app-footer">
		<p>Mosaic Photo Generator</p>
	</footer>
</div>

<style>
	.app-shell {
		display: grid;
		min-height: 100vh;
		grid-template-rows: auto 1fr auto;
	}

	.app-header,
	.app-footer {
		width: 100%;
		border-color: #dfe5ee;
		background: rgba(255, 255, 255, 0.82);
		backdrop-filter: blur(14px);
	}

	.app-header {
		border-bottom: 1px solid #dfe5ee;
	}

	.app-footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.5rem 1.5rem;
		border-top: 1px solid #dfe5ee;
		color: #647086;
		font-size: 0.82rem;
	}

	.app-header,
	.app-main,
	.app-footer {
		padding-right: clamp(1rem, 4vw, 2.5rem);
		padding-left: clamp(1rem, 4vw, 2.5rem);
	}

	.app-header,
	.app-footer {
		padding-top: 1rem;
		padding-bottom: 1rem;
	}

	.app-main {
		width: 100%;
		max-width: 1280px;
		margin: 0 auto;
		padding-top: clamp(1.25rem, 4vw, 2.5rem);
		padding-bottom: clamp(1.5rem, 5vw, 3rem);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		color: inherit;
		text-decoration: none;
	}

	.brand-mark {
		width: 2.25rem;
		height: 2.25rem;
		border: 1px solid #c7d2e2;
		border-radius: 0.5rem;
		background:
			linear-gradient(90deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.2)),
			repeating-linear-gradient(
				45deg,
				#2563eb 0 0.3rem,
				#14b8a6 0.3rem 0.6rem,
				#f59e0b 0.6rem 0.9rem
			);
		box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.82);
	}

	.brand strong,
	.brand small {
		display: block;
	}

	.brand strong {
		font-size: 1rem;
		line-height: 1.15;
	}

	.brand small {
		margin-top: 0.12rem;
		color: #647086;
		font-size: 0.78rem;
	}

	.app-footer p {
		margin: 0;
	}

	@media (max-width: 640px) {
		.app-footer {
			display: block;
		}
	}
</style>
