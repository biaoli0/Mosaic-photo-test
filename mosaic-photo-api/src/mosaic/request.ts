import type { Request } from 'express';
import type { MosaicSettings } from '../settings/settings';

export type MosaicRequest = {
	image: Buffer;
	tileSize: number;
};

export class MosaicRequestError extends Error {
	readonly status = 400;

	constructor(message: string) {
		super(message);
		this.name = 'MosaicRequestError';
	}
}

export function parseMosaicRequest(req: Request, settings: MosaicSettings): MosaicRequest {
	const tileSize = Number(req.query.tileSize ?? '');
	if (
		!Number.isInteger(tileSize) ||
		tileSize < settings.tileSize.min ||
		tileSize > settings.tileSize.max
	) {
		throw new MosaicRequestError(
			`Invalid tileSize query parameter (must be an integer in [${settings.tileSize.min}, ${settings.tileSize.max}]).`
		);
	}

	if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
		throw new MosaicRequestError('Request body must be an image blob.');
	}

	return {
		image: req.body,
		tileSize
	};
}
