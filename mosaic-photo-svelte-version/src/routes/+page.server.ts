import { fail } from '@sveltejs/kit';
import sharp from 'sharp';
import type { Actions } from './$types';

function applyMosaic(pixels: Uint8Array, width: number, height: number, size: number): Uint8Array {
	const output = new Uint8Array(pixels);

	for (let y = 0; y < height; y += size) {
		for (let x = 0; x < width; x += size) {
			const tileWidth = Math.min(size, width - x);
			const tileHeight = Math.min(size, height - y);

			let red = 0;
			let green = 0;
			let blue = 0;
			let alpha = 0;
			let count = 0;

			for (let ty = 0; ty < tileHeight; ty += 1) {
				for (let tx = 0; tx < tileWidth; tx += 1) {
					const idx = ((y + ty) * width + (x + tx)) * 4;
					red += output[idx];
					green += output[idx + 1];
					blue += output[idx + 2];
					alpha += output[idx + 3];
					count += 1;
				}
			}

			const avgRed = Math.round(red / count);
			const avgGreen = Math.round(green / count);
			const avgBlue = Math.round(blue / count);
			const avgAlpha = Math.round(alpha / count);

			for (let ty = 0; ty < tileHeight; ty += 1) {
				for (let tx = 0; tx < tileWidth; tx += 1) {
					const idx = ((y + ty) * width + (x + tx)) * 4;
					output[idx] = avgRed;
					output[idx + 1] = avgGreen;
					output[idx + 2] = avgBlue;
					output[idx + 3] = avgAlpha;
				}
			}
		}
	}

	return output;
}

export const actions: Actions = {
	mosaic: async ({ request }) => {
		const data = await request.formData();
		const image = data.get('image');
		const tileSize = Number.parseInt(String(data.get('tileSize') ?? ''), 10);

		if (!(image instanceof File) || image.size === 0) {
			return fail(400, { error: 'Image is required.' });
		}

		if (!Number.isInteger(tileSize) || tileSize < 1) {
			return fail(400, { error: 'Invalid tile size.' });
		}

		try {
			const inputBuffer = Buffer.from(await image.arrayBuffer());
			const { data: raw, info } = await sharp(inputBuffer)
				.ensureAlpha()
				.raw()
				.toBuffer({ resolveWithObject: true });

			const processed = applyMosaic(raw, info.width, info.height, tileSize);
			const pngBuffer = await sharp(Buffer.from(processed), {
				raw: { width: info.width, height: info.height, channels: 4 }
			})
				.png()
				.toBuffer();

			return {
				mosaicDataUrl: `data:image/png;base64,${pngBuffer.toString('base64')}`
			};
		} catch (error) {
			return fail(400, { error: `Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}` });
		}
	}
};
