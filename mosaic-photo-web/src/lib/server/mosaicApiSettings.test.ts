import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	loadMosaicApiSettings,
	parseMosaicApiSettings,
	resetMosaicApiSettingsCache
} from './mosaicApiSettings';

afterEach(() => {
	resetMosaicApiSettingsCache();
	vi.restoreAllMocks();
});

function mockFetchJson(body: unknown, ok = true, status = 200): typeof fetch {
	return vi.fn(async () => ({
		ok,
		status,
		json: async () => body
	})) as unknown as typeof fetch;
}

describe('parseMosaicApiSettings', () => {
	it('accepts enforced tile bounds and max body bytes', () => {
		expect(
			parseMosaicApiSettings({
				maxBodyBytes: 123,
				tileSize: { min: 2, max: 256 }
			})
		).toEqual({
			maxBodyBytes: 123,
			tileSize: { min: 2, max: 256 }
		});
	});

	it('rejects malformed settings', () => {
		expect(parseMosaicApiSettings({ maxBodyBytes: 123, tileSize: { min: 3 } })).toBeUndefined();
		expect(
			parseMosaicApiSettings({ maxBodyBytes: 123, tileSize: { min: 8, max: 2 } })
		).toBeUndefined();
		expect(
			parseMosaicApiSettings({ maxBodyBytes: '123', tileSize: { min: 2, max: 8 } })
		).toBeUndefined();
	});
});

describe('loadMosaicApiSettings', () => {
	it('updates the last-good cache after a valid response', async () => {
		const fetcher = mockFetchJson({
			maxBodyBytes: 500,
			tileSize: { min: 4, max: 40 }
		});

		await expect(loadMosaicApiSettings('http://localhost:3001', fetcher)).resolves.toEqual({
			maxBodyBytes: 500,
			tileSize: { min: 4, max: 40 }
		});
		expect(fetcher).toHaveBeenCalledWith(new URL('/settings', 'http://localhost:3001'));
	});

	it('uses cached settings when the next response is malformed', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});

		await loadMosaicApiSettings(
			'http://localhost:3001',
			mockFetchJson({ maxBodyBytes: 500, tileSize: { min: 4, max: 40 } })
		);

		await expect(
			loadMosaicApiSettings('http://localhost:3001', mockFetchJson({ maxBodyBytes: 500 }))
		).resolves.toEqual({
			maxBodyBytes: 500,
			tileSize: { min: 4, max: 40 }
		});
	});

	it('uses local fallback settings without a cached value', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});

		await expect(
			loadMosaicApiSettings('http://localhost:3001', mockFetchJson({}, false, 500))
		).resolves.toEqual({
			maxBodyBytes: 20 * 1024 * 1024,
			tileSize: { min: 2, max: 256 }
		});
	});
});
