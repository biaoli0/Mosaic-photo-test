import express, { Router, type Request, type Response, type NextFunction } from 'express';
import { parseMosaicRequest } from './request';
import { processMosaicImage } from './processor';
import { mosaicSettings } from '../settings/settings';
import { sendMosaicError } from './errors';

export const mosaicRouter: Router = Router();

// `express.raw` parses the body into a Buffer and enforces the size limit
export const rawImage = express.raw({ type: '*/*', limit: mosaicSettings.maxBodyBytes });

mosaicRouter.post(
	'/',
	rawImage,
	async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const mosaicRequest = parseMosaicRequest(req, mosaicSettings);
			const pngBuffer = await processMosaicImage(mosaicRequest);
			res.type('png');
			res.send(pngBuffer);
		} catch (error) {
			sendMosaicError(error, res, next);
		}
	}
);
