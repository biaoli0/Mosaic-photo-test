import sharp from 'sharp';
import { applyMosaic } from './pixels';
import type { MosaicRequest } from './request';

export class MosaicProcessingError extends Error {
	readonly status = 400;

	constructor(cause: unknown) {
		const message = cause instanceof Error ? cause.message : 'Unknown error';
		super(`Failed to process image: ${message}`, { cause });
		this.name = 'MosaicProcessingError';
	}
}

export async function processMosaicImage({ image, tileSize }: MosaicRequest): Promise<Buffer> {
	try {
		const { data: raw, info } = await sharp(image)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		const processed = applyMosaic(raw, info.width, info.height, tileSize);

		return await sharp(Buffer.from(processed), {
			raw: { width: info.width, height: info.height, channels: 4 }
		})
			.png()
			.toBuffer();
	} catch (error) {
		throw new MosaicProcessingError(error);
	}
}
