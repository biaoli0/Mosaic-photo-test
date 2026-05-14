import { error } from '@sveltejs/kit';
import sharp from 'sharp';
import { applyMosaic } from '$lib/server/mosaic';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_BODY_DESCRIPTION = MAX_BODY_BYTES / 1024 / 1024 + ' MB';
const MIN_TILE_SIZE = 2;
// Server cap is intentionally looser than the client's slider max (64) so the
// UI can grow without a coordinated server change, but tight enough to reject
// obviously bad inputs before they reach sharp / applyMosaic.
const MAX_TILE_SIZE = 256;

async function readLimitedBody(request: Request, limit: number): Promise<Buffer> {
	const contentLengthHeader = request.headers.get('content-length');
	if (contentLengthHeader !== null) {
		const declared = Number.parseInt(contentLengthHeader, 10);
		if (Number.isFinite(declared) && declared > limit) {
			error(413, `Request body exceeds ${MAX_BODY_DESCRIPTION} limit.`);
		}
	}

	if (request.body === null) {
		return Buffer.alloc(0);
	}

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let received = 0;

	// Stream-enforced cap: protects against missing/forged Content-Length
	// and chunked transfer encoding, which can otherwise bypass the header check.
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (!value) continue;
		received += value.byteLength;
		if (received > limit) {
			await reader.cancel();
			error(413, `Request body exceeds ${MAX_BODY_DESCRIPTION} limit.`);
		}
		chunks.push(value);
	}

	return Buffer.concat(chunks, received);
}

export const POST: RequestHandler = async ({ request, url }) => {
	const tileSizeParam = url.searchParams.get('tileSize');
	const tileSize = Number(tileSizeParam ?? '');
	if (!Number.isInteger(tileSize) || tileSize < MIN_TILE_SIZE || tileSize > MAX_TILE_SIZE) {
		error(
			400,
			`Invalid tileSize query parameter (must be an integer in [${MIN_TILE_SIZE}, ${MAX_TILE_SIZE}]).`
		);
	}

	const inputBuffer = await readLimitedBody(request, MAX_BODY_BYTES);
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

		const body = new Uint8Array(
			pngBuffer.buffer as ArrayBuffer,
			pngBuffer.byteOffset,
			pngBuffer.byteLength
		);
		return new Response(body, {
			headers: { 'Content-Type': 'image/png' }
		});
	} catch (e) {
		error(400, `Failed to process image: ${e instanceof Error ? e.message : 'Unknown error'}`);
	}
};
