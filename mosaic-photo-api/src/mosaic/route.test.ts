import sharp from 'sharp';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';

async function makePng(): Promise<Buffer> {
	return sharp(Buffer.from([255, 0, 0, 255]), {
		raw: { width: 1, height: 1, channels: 4 }
	})
		.png()
		.toBuffer();
}

describe('POST /mosaic', () => {
	it('returns 400 for invalid tile sizes', async () => {
		await request(createApp())
			.post('/mosaic?tileSize=257')
			.set('Content-Type', 'image/png')
			.send(await makePng())
			.expect(400)
			.expect('Invalid tileSize query parameter (must be an integer in [2, 256]).');
	});

	it('returns 400 for empty bodies', async () => {
		await request(createApp())
			.post('/mosaic?tileSize=2')
			.set('Content-Type', 'image/png')
			.send(Buffer.alloc(0))
			.expect(400)
			.expect('Request body must be an image blob.');
	});

	it('returns 400 for invalid image bodies', async () => {
		const response = await request(createApp())
			.post('/mosaic?tileSize=2')
			.set('Content-Type', 'image/png')
			.send(Buffer.from('not an image'))
			.expect(400);

		expect(response.text).toMatch(/^Failed to process image:/);
	});

	it('returns a PNG for valid image bodies', async () => {
		await request(createApp())
			.post('/mosaic?tileSize=2')
			.set('Content-Type', 'image/png')
			.send(await makePng())
			.expect(200)
			.expect('Content-Type', /image\/png/);
	});
});
