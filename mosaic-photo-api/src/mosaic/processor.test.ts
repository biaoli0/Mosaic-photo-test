import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { processMosaicImage, MosaicProcessingError } from './processor';

async function makePng(width: number, height: number, pixels: number[][]): Promise<Buffer> {
	return sharp(Buffer.from(pixels.flat()), {
		raw: { width, height, channels: 4 }
	})
		.png()
		.toBuffer();
}

async function decodePng(buffer: Buffer): Promise<{
	pixels: Uint8Array;
	width: number;
	height: number;
}> {
	const { data, info } = await sharp(buffer)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	return {
		pixels: data,
		width: info.width,
		height: info.height
	};
}

function getPixel(pixels: Uint8Array, width: number, x: number, y: number): number[] {
	const idx = (y * width + x) * 4;
	return [pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]];
}

describe('processMosaicImage', () => {
	it('decodes an image, applies mosaic pixels, and encodes a PNG with the same dimensions', async () => {
		const image = await makePng(2, 2, [
			[100, 0, 0, 255],
			[200, 0, 0, 255],
			[0, 100, 0, 255],
			[0, 200, 0, 255]
		]);

		const output = await processMosaicImage({ image, tileSize: 2 });
		const decoded = await decodePng(output);

		expect(decoded.width).toBe(2);
		expect(decoded.height).toBe(2);
		for (let y = 0; y < 2; y += 1) {
			for (let x = 0; x < 2; x += 1) {
				expect(getPixel(decoded.pixels, decoded.width, x, y)).toEqual([75, 75, 0, 255]);
			}
		}
	});

	it('preserves alpha through the decode-transform-encode workflow', async () => {
		const image = await makePng(2, 1, [
			[50, 50, 50, 0],
			[50, 50, 50, 200]
		]);

		const output = await processMosaicImage({ image, tileSize: 2 });
		const decoded = await decodePng(output);

		expect(getPixel(decoded.pixels, decoded.width, 0, 0)).toEqual([50, 50, 50, 100]);
		expect(getPixel(decoded.pixels, decoded.width, 1, 0)).toEqual([50, 50, 50, 100]);
	});

	it('wraps invalid image buffers in a typed processing error', async () => {
		const processing = processMosaicImage({ image: Buffer.from('not an image'), tileSize: 2 });

		await expect(processing).rejects.toBeInstanceOf(MosaicProcessingError);
		await expect(processing).rejects.toThrow(/^Failed to process image:/);
	});
});
