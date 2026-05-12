import { error } from '@sveltejs/kit';
import sharp from 'sharp';
import { applyMosaic } from '$lib/server/mosaic';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url }) => {
	const tileSize = Number.parseInt(url.searchParams.get('tileSize') ?? '', 10);
	if (!Number.isInteger(tileSize) || tileSize < 2) {
		error(400, 'Invalid tileSize query parameter (must be an integer >= 2).');
	}

	const inputBuffer = Buffer.from(await request.arrayBuffer());
	if (inputBuffer.length === 0) {
		error(400, 'Request body must be an image blob.');
	}

	try {
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

		return new Response(new Uint8Array(pngBuffer), {
			headers: { 'Content-Type': 'image/png' }
		});
	} catch (e) {
		error(400, `Failed to process image: ${e instanceof Error ? e.message : 'Unknown error'}`);
	}
};
