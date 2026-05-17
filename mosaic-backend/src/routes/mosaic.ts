import express, { Router, type Request, type Response, type NextFunction } from 'express';
import sharp from 'sharp';
import { applyMosaic } from '../mosaic.ts';

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_BODY_DESCRIPTION = MAX_BODY_BYTES / 1024 / 1024 + ' MB';
const MIN_TILE_SIZE = 2;
const MAX_TILE_SIZE = 256;

export const mosaicRouter: Router = Router();

// `express.raw` parses the body into a Buffer and enforces the size limit
const rawImage = express.raw({ type: '*/*', limit: MAX_BODY_BYTES });

mosaicRouter.post('/', rawImage, async (req: Request, res: Response): Promise<void> => {
	const tileSize = Number(req.query.tileSize ?? '');
	if (!Number.isInteger(tileSize) || tileSize < MIN_TILE_SIZE || tileSize > MAX_TILE_SIZE) {
		res
			.status(400)
			.send(
				`Invalid tileSize query parameter (must be an integer in [${MIN_TILE_SIZE}, ${MAX_TILE_SIZE}]).`
			);
		return;
	}

	const inputBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
	if (inputBuffer.length === 0) {
		res.status(400).send('Request body must be an image blob.');
		return;
	}

	const rawWidth = Number(req.query.width ?? '');
	const rawHeight = Number(req.query.height ?? '');
	const useRawInput = Number.isInteger(rawWidth) && Number.isInteger(rawHeight);

	try {
		let raw: Uint8Array;
		let width: number;
		let height: number;

		if (useRawInput) {
			if (rawWidth <= 0 || rawHeight <= 0) {
				res.status(400).send('width and height must be positive integers.');
				return;
			}

			const expectedBytes = rawWidth * rawHeight * 4;
			if (inputBuffer.length !== expectedBytes) {
				res.status(400).send(`Raw RGBA payload size mismatch: expected ${expectedBytes} bytes.`);
				return;
			}

			raw = inputBuffer;
			width = rawWidth;
			height = rawHeight;
		} else {
			const decoded = await sharp(inputBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
			raw = decoded.data;
			width = decoded.info.width;
			height = decoded.info.height;
		}

		const processed = applyMosaic(raw, width, height, tileSize);

		const pngBuffer = await sharp(Buffer.from(processed), {
			raw: { width, height, channels: 4 }
		})
			.png()
			.toBuffer();

		res.setHeader('Content-Type', 'image/png');
		res.send(pngBuffer);
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Unknown error';
		res.status(400).send(`Failed to process image: ${msg}`);
	}
});

// Express's body parser surfaces oversized payloads as `entity.too.large`.
// We intercept it here so the response shape matches the SvelteKit version
// (413 with a human-readable cap), instead of the default 500.
export function payloadTooLargeHandler(
	err: Error & { type?: string },
	_req: Request,
	res: Response,
	next: NextFunction
): void {
	if (err && err.type === 'entity.too.large') {
		res.status(413).send(`Request body exceeds ${MAX_BODY_DESCRIPTION} limit.`);
		return;
	}
	next(err);
}
