import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	loadMosaicApiSettings,
	parseMosaicApiSettings,
	resetMosaicApiSettingsCache
} from './mosaicApiSettings';

afterEach(() => {
	resetMosaicApiSettingsCache();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

function mockFetchJson(body: unknown, ok = true, status = 200): typeof fetch {
	return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
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
		expect(fetcher).toHaveBeenCalledWith(
			'http://localhost:3001/settings',
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
	});

	it('preserves API base URL path prefixes when fetching settings', async () => {
		const fetcher = mockFetchJson({
			maxBodyBytes: 500,
			tileSize: { min: 4, max: 40 }
		});

		await loadMosaicApiSettings('https://example.com/api/', fetcher);

		expect(fetcher).toHaveBeenCalledWith(
			'https://example.com/api/settings',
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
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

	it('uses local fallback settings when the settings request times out', async () => {
		vi.useFakeTimers();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const fetcher = vi.fn(
			(_input: RequestInfo | URL, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () =>
						reject(new DOMException('The operation was aborted.', 'AbortError'))
					);
				})
		) as unknown as typeof fetch;

		const settings = loadMosaicApiSettings('http://localhost:3001', fetcher);
		await vi.advanceTimersByTimeAsync(1500);

		await expect(settings).resolves.toEqual({
			maxBodyBytes: 20 * 1024 * 1024,
			tileSize: { min: 2, max: 256 }
		});
	});
});
