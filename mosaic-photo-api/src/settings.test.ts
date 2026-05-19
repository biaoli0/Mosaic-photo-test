import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { createMosaicSettings } from './settings';

describe('mosaic settings', () => {
	it('uses documented defaults', () => {
		expect(createMosaicSettings({})).toEqual({
			maxBodyBytes: 20 * 1024 * 1024,
			tileSize: {
				min: 2,
				max: 256
			}
		});
	});

	it('throws on invalid positive integer env values', () => {
		expect(() => createMosaicSettings({ MAX_BODY_BYTES: 'nope' })).toThrow(
			'Environment variable MAX_BODY_BYTES must be a positive integer'
		);
		expect(() => createMosaicSettings({ MIN_TILE_SIZE: '0' })).toThrow(
			'Environment variable MIN_TILE_SIZE must be a positive integer'
		);
		expect(() => createMosaicSettings({ MAX_TILE_SIZE: '-1' })).toThrow(
			'Environment variable MAX_TILE_SIZE must be a positive integer'
		);
	});

	it('throws when tile bounds are inverted', () => {
		expect(() => createMosaicSettings({ MIN_TILE_SIZE: '20', MAX_TILE_SIZE: '10' })).toThrow(
			'MIN_TILE_SIZE (20) cannot be greater than MAX_TILE_SIZE (10)'
		);
	});

	it('exposes client-relevant enforced limits', async () => {
		await request(createApp())
			.get('/settings')
			.expect(200)
			.expect({
				maxBodyBytes: 20 * 1024 * 1024,
				tileSize: {
					min: 2,
					max: 256
				}
			});
	});
});
