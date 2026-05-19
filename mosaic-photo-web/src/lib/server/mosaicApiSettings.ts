import { DEFAULT_TILE_SLIDER_MAX, DEFAULT_TILE_SLIDER_MIN } from '$lib/mosaicChunkDefaults';

export type MosaicApiSettings = {
	maxBodyBytes: number;
	tileSize: {
		min: number;
		max: number;
	};
};

const fallbackSettings: MosaicApiSettings = {
	maxBodyBytes: 20 * 1024 * 1024,
	tileSize: {
		min: DEFAULT_TILE_SLIDER_MIN,
		max: DEFAULT_TILE_SLIDER_MAX
	}
};

let cachedSettings: MosaicApiSettings | undefined;

function isPositiveInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function parseMosaicApiSettings(value: unknown): MosaicApiSettings | undefined {
	if (typeof value !== 'object' || value === null) return undefined;

	const candidate = value as {
		maxBodyBytes?: unknown;
		tileSize?: {
			min?: unknown;
			max?: unknown;
		};
	};
	const min = candidate.tileSize?.min;
	const max = candidate.tileSize?.max;

	if (
		!isPositiveInteger(candidate.maxBodyBytes) ||
		!isPositiveInteger(min) ||
		!isPositiveInteger(max)
	) {
		return undefined;
	}
	if (min > max) return undefined;

	return {
		maxBodyBytes: candidate.maxBodyBytes,
		tileSize: { min, max }
	};
}

export function resetMosaicApiSettingsCache(): void {
	cachedSettings = undefined;
}

export async function loadMosaicApiSettings(
	apiBaseUrl: string,
	fetcher: typeof fetch = fetch
): Promise<MosaicApiSettings> {
	try {
		const response = await fetcher(new URL('/settings', apiBaseUrl));
		if (!response.ok) throw new Error(`GET /settings returned ${response.status}`);

		const parsed = parseMosaicApiSettings(await response.json());
		if (!parsed) throw new Error('GET /settings returned malformed settings');

		cachedSettings = parsed;
		return parsed;
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown settings fetch error';
		console.warn(`Using fallback mosaic settings: ${message}`);
		return cachedSettings ?? fallbackSettings;
	}
}
