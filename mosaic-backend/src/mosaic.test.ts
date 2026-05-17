import { describe, it, expect } from 'vitest';
import { applyMosaic } from './mosaic.ts';

/**
 * Creates a flat RGBA Uint8Array from a list of [R, G, B, A] values.
 *
 * Example:
 *   makePixels([
 *     [255, 0, 0, 255],
 *     [0, 255, 0, 255],
 *   ])
 *   // => Uint8Array [255, 0, 0, 255, 0, 255, 0, 255]
 *
 * @param rgbaList - Array of RGBA pixel arrays, e.g. [[R, G, B, A], ...]
 * @returns Uint8Array containing all pixel channels in row-major order
 */
function makePixels(rgbaList: number[][]): Uint8Array {
	const pixels = new Uint8Array(rgbaList.length * 4);
	for (let i = 0; i < rgbaList.length; i += 1) {
		pixels.set(rgbaList[i], i * 4);
	}
	return pixels;
}

/**
 * Get the RGBA values of the pixel at position (x, y).
 * x is the horizontal pixel coordinate (0 = left), y is the vertical coordinate (0 = top).
 */
function getPixel(pixels: Uint8Array, width: number, x: number, y: number): number[] {
	const idx = (y * width + x) * 4;
	return [pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]];
}

describe('applyMosaic', () => {
	it('averages a 2x2 image with tileSize=2 to a single color', () => {
		// Average across all 4 pixels:
		//   R: (100 + 200 + 0 + 0) / 4 = 75
		//   G: (0 + 0 + 100 + 200) / 4 = 75
		//   B: 0
		//   A: 255
		const input = makePixels([
			[100, 0, 0, 255],
			[200, 0, 0, 255],
			[0, 100, 0, 255],
			[0, 200, 0, 255]
		]);

		const output = applyMosaic(input, 2, 2, 2);

		for (let y = 0; y < 2; y += 1) {
			for (let x = 0; x < 2; x += 1) {
				expect(getPixel(output, 2, x, y)).toEqual([75, 75, 0, 255]);
			}
		}
	});

	it('leaves a uniform-colored tile unchanged', () => {
		// 4x4 image composed of four 2x2 tiles, each tile a single solid color.
		// Averaging a uniform tile yields that same color, so output === input.
		const red = [255, 0, 0, 255];
		const green = [0, 255, 0, 255];
		const blue = [0, 0, 255, 255];
		const white = [255, 255, 255, 255];

		const rows: number[][] = [];
		for (let y = 0; y < 4; y += 1) {
			for (let x = 0; x < 4; x += 1) {
				const topHalf = y < 2;
				const leftHalf = x < 2;
				if (topHalf && leftHalf) rows.push(red);
				else if (topHalf && !leftHalf) rows.push(green);
				else if (!topHalf && leftHalf) rows.push(blue);
				else rows.push(white);
			}
		}

		const input = makePixels(rows);
		const output = applyMosaic(input, 4, 4, 2);

		expect(Array.from(output)).toEqual(Array.from(input));
	});

	it('handles partial edge tiles when dimensions are not divisible by size', () => {
		// 3x1 image, tileSize=2. The first tile covers pixels 0..1, the second
		// is a partial 1-pixel-wide tile at the right edge.
		const input = makePixels([
			[10, 0, 0, 255],
			[20, 0, 0, 255],
			[90, 0, 0, 255]
		]);

		const output = applyMosaic(input, 3, 1, 2);

		// First (full) tile: avg of (10) and (20) → 15
		expect(getPixel(output, 3, 0, 0)).toEqual([15, 0, 0, 255]);
		expect(getPixel(output, 3, 1, 0)).toEqual([15, 0, 0, 255]);
		// Second (partial) tile: only the single pixel value (90) is averaged
		expect(getPixel(output, 3, 2, 0)).toEqual([90, 0, 0, 255]);
	});

	it('collapses the entire image to one color when tileSize exceeds dimensions', () => {
		// 2x2 image with size=10 → one tile covering everything.
		const input = makePixels([
			[0, 0, 0, 100],
			[100, 0, 0, 100],
			[0, 100, 0, 100],
			[0, 0, 100, 100]
		]);

		const output = applyMosaic(input, 2, 2, 10);

		// Expected averages: R=25, G=25, B=25, A=100
		for (let y = 0; y < 2; y += 1) {
			for (let x = 0; x < 2; x += 1) {
				expect(getPixel(output, 2, x, y)).toEqual([25, 25, 25, 100]);
			}
		}
	});

	it('averages the alpha channel independently', () => {
		// Single 2x1 tile with the same RGB but different alpha values.
		// Expected: alpha = (0 + 200) / 2 = 100
		const input = makePixels([
			[50, 50, 50, 0],
			[50, 50, 50, 200]
		]);

		const output = applyMosaic(input, 2, 1, 2);

		expect(getPixel(output, 2, 0, 0)).toEqual([50, 50, 50, 100]);
		expect(getPixel(output, 2, 1, 0)).toEqual([50, 50, 50, 100]);
	});

	it('does not mutate the input array', () => {
		const input = makePixels([
			[10, 20, 30, 40],
			[50, 60, 70, 80],
			[90, 100, 110, 120],
			[130, 140, 150, 160]
		]);
		const snapshot = Array.from(input);

		applyMosaic(input, 2, 2, 2);

		expect(Array.from(input)).toEqual(snapshot);
	});

	it('returns a Uint8Array with the same length as the input', () => {
		const input = makePixels([
			[1, 2, 3, 4],
			[5, 6, 7, 8],
			[9, 10, 11, 12],
			[13, 14, 15, 16]
		]);

		const output = applyMosaic(input, 2, 2, 2);

		expect(output).toBeInstanceOf(Uint8Array);
		expect(output.length).toBe(input.length);
	});

	it('rounds averages to the nearest integer', () => {
		// Avg R = (1 + 2 + 3 + 4) / 4 = 2.5 → rounds to 3.
		// Math.round(2.5) === 3 in JS (banker's rounding does NOT apply here).
		const input = makePixels([
			[1, 0, 0, 0],
			[2, 0, 0, 0],
			[3, 0, 0, 0],
			[4, 0, 0, 0]
		]);

		const output = applyMosaic(input, 2, 2, 2);

		expect(output[0]).toBe(3);
	});
});
