import type { NextFunction, Response } from 'express';
import { MosaicProcessingError } from './processor';
import { MosaicRequestError } from './request';
import { mosaicSettings } from '../settings/settings';

const MAX_BODY_DESCRIPTION = mosaicSettings.maxBodyBytes / 1024 / 1024 + ' MB';

type PayloadTooLargeError = Error & { type?: string };

export function sendMosaicError(error: unknown, res: Response, next: NextFunction): void {
	if (error instanceof MosaicRequestError || error instanceof MosaicProcessingError) {
		res.status(error.status).send(error.message);
		return;
	}

	next(error);
}

// Express's body parser surfaces oversized payloads as `entity.too.large`.
// We intercept it here so the response shape stays stable.
export function payloadTooLargeHandler(
	err: PayloadTooLargeError,
	_req: unknown,
	res: Response,
	next: NextFunction
): void {
	if (err && err.type === 'entity.too.large') {
		res.status(413).send(`Request body exceeds ${MAX_BODY_DESCRIPTION} limit.`);
		return;
	}
	next(err);
}
