import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { parseMosaicRequest, MosaicRequestError } from './request';
import type { MosaicSettings } from '../settings/settings';

const settings: MosaicSettings = {
	maxBodyBytes: 20 * 1024 * 1024,
	tileSize: {
		min: 2,
		max: 256
	}
};

function makeRequest(query: Request['query'], body: unknown): Request {
	return { query, body } as Request;
}

describe('parseMosaicRequest', () => {
	it('returns a mosaic request for valid HTTP input', () => {
		const image = Buffer.from([1, 2, 3]);

		expect(parseMosaicRequest(makeRequest({ tileSize: '12' }, image), settings)).toEqual({
			image,
			tileSize: 12
		});
	});

	it('rejects missing, non-integer, and out-of-range tile sizes', () => {
		for (const tileSize of [undefined, 'abc', '1', '257', '2.5']) {
			expect(() => parseMosaicRequest(makeRequest({ tileSize }, Buffer.from([1])), settings)).toThrow(
				new MosaicRequestError(
					'Invalid tileSize query parameter (must be an integer in [2, 256]).'
				)
			);
		}
	});

	it('rejects empty or non-buffer bodies', () => {
		for (const body of [undefined, '', Buffer.alloc(0)]) {
			expect(() => parseMosaicRequest(makeRequest({ tileSize: '12' }, body), settings)).toThrow(
				new MosaicRequestError('Request body must be an image blob.')
			);
		}
	});
});
