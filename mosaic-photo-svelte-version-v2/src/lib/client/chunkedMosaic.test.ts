import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateChunkedMosaic } from './chunkedMosaic';
import { postMosaicChunk } from './mosaicTransport';

vi.mock('./mosaicTransport', () => ({
	postMosaicChunk: vi.fn()
}));

type FakeBitmap = ImageBitmap & { close: ReturnType<typeof vi.fn> };

function makeBitmap(width: number, height: number): FakeBitmap {
	return {
		width,
		height,
		close: vi.fn()
	} as unknown as FakeBitmap;
}

type FakeCtx = {
	clearRect: ReturnType<typeof vi.fn>;
	drawImage: ReturnType<typeof vi.fn>;
};

type FakeCanvas = {
	width: number;
	height: number;
	getContext: ReturnType<typeof vi.fn>;
	toBlob: ReturnType<typeof vi.fn>;
	__ctx: FakeCtx;
};

function makeChunkCanvas(): FakeCanvas {
	const ctx: FakeCtx = {
		clearRect: vi.fn(),
		drawImage: vi.fn()
	};
	return {
		width: 0,
		height: 0,
		getContext: vi.fn((kind: string) => (kind === '2d' ? ctx : null)),
		toBlob: vi.fn((cb: (blob: Blob | null) => void, type?: string) => {
			queueMicrotask(() => cb(new Blob([], type ? { type } : undefined)));
		}),
		__ctx: ctx
	};
}

beforeEach(() => {
	vi.mocked(postMosaicChunk).mockReset();
	vi.stubGlobal('document', {
		createElement: (tag: string) => {
			if (tag !== 'canvas') throw new Error(`unexpected createElement: ${tag}`);
			return makeChunkCanvas();
		}
	});
	vi.stubGlobal(
		'createImageBitmap',
		vi.fn(async () => makeBitmap(0, 0))
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('generateChunkedMosaic', () => {
	it('reports progress monotonically from 0/N up to N/N', async () => {
		vi.mocked(postMosaicChunk).mockResolvedValue(new Blob([]));
		const progress: Array<[number, number]> = [];

		await generateChunkedMosaic({
			bitmap: makeBitmap(80, 250),
			tileSize: 10,
			signal: new AbortController().signal,
			targetChunkHeight: 100,
			onProgress: (done, total) => progress.push([done, total]),
			onChunkReady: () => { }
		});

		// `completed` is a shared counter incremented synchronously, so the
		// sequence of `done` values is deterministic even with parallel workers.
		expect(progress).toEqual([
			[0, 3],
			[1, 3],
			[2, 3],
			[3, 3]
		]);
	});

	it('closes each decoded chunk bitmap on the happy path', async () => {
		const closes: ReturnType<typeof vi.fn>[] = [];
		vi.mocked(postMosaicChunk).mockResolvedValue(new Blob([]));
		vi.stubGlobal(
			'createImageBitmap',
			vi.fn(async () => {
				const close = vi.fn();
				closes.push(close);
				return { width: 0, height: 0, close } as Pick<ImageBitmap, 'width' | 'height' | 'close'>;
			})
		);

		await generateChunkedMosaic({
			bitmap: makeBitmap(80, 250),
			tileSize: 10,
			signal: new AbortController().signal,
			targetChunkHeight: 100,
			onChunkReady: () => { }
		});

		expect(closes).toHaveLength(3);
		for (const close of closes) expect(close).toHaveBeenCalledTimes(1);
	});

	it('does not surface a chunk that is decoded after abort, and still closes it', async () => {
		vi.mocked(postMosaicChunk).mockResolvedValue(new Blob([]));

		let resolveDecode!: (b: ImageBitmap) => void;
		const decode = new Promise<ImageBitmap>((r) => {
			resolveDecode = r;
		});
		const bitmapClose = vi.fn();
		const stalePainted = vi.fn();
		let decodeStartedResolve!: () => void;
		const decodeStarted = new Promise<void>((r) => {
			decodeStartedResolve = r;
		});

		vi.stubGlobal(
			'createImageBitmap',
			vi.fn(() => {
				decodeStartedResolve();
				return decode;
			})
		);

		const controller = new AbortController();
		const promise = generateChunkedMosaic({
			bitmap: makeBitmap(80, 100),
			tileSize: 10,
			signal: controller.signal,
			targetChunkHeight: 100,
			concurrency: 1,
			onChunkReady: stalePainted
		});

		await decodeStarted;
		controller.abort();

		await expect(promise).resolves.toBeUndefined();
		expect(stalePainted).not.toHaveBeenCalled();
		expect(bitmapClose).not.toHaveBeenCalled();

		resolveDecode({ width: 0, height: 0, close: bitmapClose } as Pick<ImageBitmap, 'width' | 'height' | 'close'>);
		await Promise.resolve();

		expect(bitmapClose).toHaveBeenCalledTimes(1);
	});
});
