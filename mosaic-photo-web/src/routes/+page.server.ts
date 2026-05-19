import { env } from '$env/dynamic/private';
import {
	DEFAULT_CHUNK_CONCURRENCY,
	DEFAULT_CHUNK_TARGET_HEIGHT,
	DEFAULT_TILE_SIZE
} from '$lib/mosaicChunkDefaults';
import { loadMosaicApiSettings } from '$lib/server/mosaicApiSettings';
import type { PageServerLoad } from './$types';

function parseEnvPositiveInt(raw: string | undefined, fallback: number): number {
	if (raw === undefined || raw.trim() === '') return fallback;
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return fallback;
	return n;
}

export const load: PageServerLoad = async ({ fetch }) => {
	const mosaicChunkTargetHeight = parseEnvPositiveInt(
		env.MOSAIC_CHUNK_TARGET_HEIGHT,
		DEFAULT_CHUNK_TARGET_HEIGHT
	);
	const mosaicChunkConcurrency = parseEnvPositiveInt(
		env.MOSAIC_CHUNK_CONCURRENCY,
		DEFAULT_CHUNK_CONCURRENCY
	);

	const settings = await loadMosaicApiSettings(import.meta.env.VITE_MOSAIC_PHOTO_API_URL, fetch);
	const tileSliderMin = settings.tileSize.min;
	const tileSliderMax = settings.tileSize.max;
	const tileSizeDefault = Math.min(Math.max(DEFAULT_TILE_SIZE, tileSliderMin), tileSliderMax);

	return {
		mosaicChunkTargetHeight,
		mosaicChunkConcurrency,
		tileSliderMin,
		tileSliderMax,
		tileSizeDefault,
		maxBodyBytes: settings.maxBodyBytes
	};
};
