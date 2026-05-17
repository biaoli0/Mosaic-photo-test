import express, { Router, type Request, type Response, type NextFunction } from 'express';
import sharp from 'sharp';
import { applyMosaic } from '../mosaic';

function parseEnvPositiveInt(name: string, defaultValue: number): number {
	const raw = process.env[name];
	if (raw === undefined || raw.trim() === '') return defaultValue;
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) {
		throw new Error(`Environment variable ${name} must be a positive integer, got: ${raw}`);
	}
	return n;
}

const MAX_BODY_BYTES = parseEnvPositiveInt('MAX_BODY_BYTES', 20 * 1024 * 1024);
const MIN_TILE_SIZE = parseEnvPositiveInt('MIN_TILE_SIZE', 2);
const MAX_TILE_SIZE = parseEnvPositiveInt('MAX_TILE_SIZE', 256);

if (MIN_TILE_SIZE > MAX_TILE_SIZE) {
	throw new Error(
		`Invalid mosaic limits: MIN_TILE_SIZE (${MIN_TILE_SIZE}) cannot be greater than MAX_TILE_SIZE (${MAX_TILE_SIZE})`
	);
}

const MAX_BODY_DESCRIPTION = MAX_BODY_BYTES / 1024 / 1024 + ' MB';

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
