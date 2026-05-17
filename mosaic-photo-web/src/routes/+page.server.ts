import { env } from '$env/dynamic/private';
import {
	DEFAULT_CHUNK_CONCURRENCY,
	DEFAULT_CHUNK_TARGET_HEIGHT,
	DEFAULT_TILE_SIZE,
	DEFAULT_TILE_SLIDER_MAX,
	DEFAULT_TILE_SLIDER_MIN
} from '$lib/mosaicChunkDefaults';
import type { PageServerLoad } from './$types';

function parseEnvPositiveInt(raw: string | undefined, fallback: number): number {
	if (raw === undefined || raw.trim() === '') return fallback;
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return fallback;
	return n;
}

export const load: PageServerLoad = async () => {
	const mosaicChunkTargetHeight = parseEnvPositiveInt(
		env.MOSAIC_CHUNK_TARGET_HEIGHT,
		DEFAULT_CHUNK_TARGET_HEIGHT
	);
	const mosaicChunkConcurrency = parseEnvPositiveInt(
		env.MOSAIC_CHUNK_CONCURRENCY,
		DEFAULT_CHUNK_CONCURRENCY
	);

	let tileSliderMin = parseEnvPositiveInt(
		env.MOSAIC_TILE_SLIDER_MIN,
		DEFAULT_TILE_SLIDER_MIN
	);
	let tileSliderMax = parseEnvPositiveInt(
		env.MOSAIC_TILE_SLIDER_MAX,
		DEFAULT_TILE_SLIDER_MAX
	);
	if (tileSliderMin > tileSliderMax) {
		tileSliderMin = DEFAULT_TILE_SLIDER_MIN;
		tileSliderMax = DEFAULT_TILE_SLIDER_MAX;
	}
	const tileSizeDefault = Math.min(Math.max(DEFAULT_TILE_SIZE, tileSliderMin), tileSliderMax);

	return {
		mosaicChunkTargetHeight,
		mosaicChunkConcurrency,
		tileSliderMin,
		tileSliderMax,
		tileSizeDefault
	};
};
