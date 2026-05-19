import express, { Router, type Request, type Response, type NextFunction } from 'express';
import sharp from 'sharp';
import { applyMosaic } from '../mosaic';
import { mosaicSettings } from '../settings';

const MAX_BODY_DESCRIPTION = mosaicSettings.maxBodyBytes / 1024 / 1024 + ' MB';

export const mosaicRouter: Router = Router();

// `express.raw` parses the body into a Buffer and enforces the size limit
const rawImage = express.raw({ type: '*/*', limit: mosaicSettings.maxBodyBytes });

mosaicRouter.post('/', rawImage, async (req: Request, res: Response): Promise<void> => {
	const tileSize = Number(req.query.tileSize ?? '');
	if (
		!Number.isInteger(tileSize) ||
		tileSize < mosaicSettings.tileSize.min ||
		tileSize > mosaicSettings.tileSize.max
	) {
		res
			.status(400)
			.send(
				`Invalid tileSize query parameter (must be an integer in [${mosaicSettings.tileSize.min}, ${mosaicSettings.tileSize.max}]).`
			);
		return;
	}

	const inputBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
	if (inputBuffer.length === 0) {
		res.status(400).send('Request body must be an image blob.');
		return;
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
