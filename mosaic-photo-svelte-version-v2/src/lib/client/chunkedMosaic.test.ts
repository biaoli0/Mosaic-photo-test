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

function deferred<T>(): {
	promise: Promise<T>;
	resolve: (v: T) => void;
	reject: (e: unknown) => void;
} {
	let resolve!: (v: T) => void;
	let reject!: (e: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

// Two macrotask hops are enough to drain pending microtasks across the
// toBlob → postMosaicChunk → createImageBitmap pipeline.
async function flushAsync(): Promise<void> {
	await new Promise((r) => setTimeout(r, 0));
	await new Promise((r) => setTimeout(r, 0));
}

let chunkCanvases: FakeCanvas[] = [];

beforeEach(() => {
	chunkCanvases = [];
	vi.mocked(postMosaicChunk).mockReset();
	vi.stubGlobal('document', {
		createElement: (tag: string) => {
			if (tag !== 'canvas') throw new Error(`unexpected createElement: ${tag}`);
			const c = makeChunkCanvas();
			chunkCanvases.push(c);
			return c;
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
	it('produces ceil(height / chunkBaseHeight) chunks and covers the bitmap end-to-end', async () => {
		vi.mocked(postMosaicChunk).mockResolvedValue(new Blob([]));

		const ready: number[] = [];
		// chunkBaseHeight = floor(100 / 10) * 10 = 100. ceil(250 / 100) = 3 chunks.
		await generateChunkedMosaic({
			bitmap: makeBitmap(80, 250),
			tileSize: 10,
			signal: new AbortController().signal,
			targetChunkHeight: 100,
			onChunkReady: (_b, y) => ready.push(y)
		});

		expect(postMosaicChunk).toHaveBeenCalledTimes(3);
		expect(ready.sort((a, b) => a - b)).toEqual([0, 100, 200]);
	});

	it('makes the trailing chunk shorter when height is not a multiple of chunkBaseHeight', async () => {
		vi.mocked(postMosaicChunk).mockResolvedValue(new Blob([]));

		await generateChunkedMosaic({
			bitmap: makeBitmap(80, 250),
			tileSize: 10,
			signal: new AbortController().signal,
			targetChunkHeight: 100,
			concurrency: 1,
			onChunkReady: () => {}
		});

		// Concurrency 1 → single per-worker canvas, so all 3 drawImage calls
		// land on the same fake ctx in order.
		const drawCalls = chunkCanvases[0].__ctx.drawImage.mock.calls;
		// drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh)
		expect(drawCalls.map((args) => args[2])).toEqual([0, 100, 200]);
		expect(drawCalls.map((args) => args[4])).toEqual([100, 100, 50]);
	});

	it('rounds chunk height down to a multiple of tileSize to avoid seams', async () => {
		vi.mocked(postMosaicChunk).mockResolvedValue(new Blob([]));

		// chunkBaseHeight = floor(100 / 12) * 12 = 96. ceil(192 / 96) = 2.
		await generateChunkedMosaic({
			bitmap: makeBitmap(80, 192),
			tileSize: 12,
			signal: new AbortController().signal,
			targetChunkHeight: 100,
			concurrency: 1,
			onChunkReady: () => {}
		});

		const drawCalls = chunkCanvases[0].__ctx.drawImage.mock.calls;
		expect(drawCalls.map((args) => args[4])).toEqual([96, 96]);
		expect(drawCalls.map((args) => args[2])).toEqual([0, 96]);
	});

	it('falls back to tileSize when the target chunk height is smaller than the tile', async () => {
		vi.mocked(postMosaicChunk).mockResolvedValue(new Blob([]));

		// floor(50/200)*200 = 0, so chunkBaseHeight = max(200, 0) = 200.
		await generateChunkedMosaic({
			bitmap: makeBitmap(80, 400),
			tileSize: 200,
			signal: new AbortController().signal,
			targetChunkHeight: 50,
			concurrency: 1,
			onChunkReady: () => {}
		});

		expect(postMosaicChunk).toHaveBeenCalledTimes(2);
		const drawCalls = chunkCanvases[0].__ctx.drawImage.mock.calls;
		expect(drawCalls.map((args) => args[4])).toEqual([200, 200]);
	});

	it('is a no-op for a zero-height bitmap', async () => {
		const onChunkReady = vi.fn();
		const onProgress = vi.fn();

		await generateChunkedMosaic({
			bitmap: makeBitmap(80, 0),
			tileSize: 10,
			signal: new AbortController().signal,
			onChunkReady,
			onProgress
		});

		expect(postMosaicChunk).not.toHaveBeenCalled();
		expect(onChunkReady).not.toHaveBeenCalled();
		expect(onProgress).not.toHaveBeenCalled();
	});

	it('reports progress monotonically from 0/N up to N/N', async () => {
		vi.mocked(postMosaicChunk).mockResolvedValue(new Blob([]));
		const progress: Array<[number, number]> = [];

		await generateChunkedMosaic({
			bitmap: makeBitmap(80, 250),
			tileSize: 10,
			signal: new AbortController().signal,
			targetChunkHeight: 100,
			onProgress: (done, total) => progress.push([done, total]),
			onChunkReady: () => {}
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
				return { width: 0, height: 0, close } as unknown as ImageBitmap;
			})
		);

		await generateChunkedMosaic({
			bitmap: makeBitmap(80, 250),
			tileSize: 10,
			signal: new AbortController().signal,
			targetChunkHeight: 100,
			onChunkReady: () => {}
		});

		expect(closes).toHaveLength(3);
		for (const close of closes) expect(close).toHaveBeenCalledTimes(1);
	});

	it('respects the concurrency cap', async () => {
		let inFlight = 0;
		let maxInFlight = 0;
		vi.mocked(postMosaicChunk).mockImplementation(async () => {
			inFlight += 1;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await new Promise((r) => setTimeout(r, 5));
			inFlight -= 1;
			return new Blob([]);
		});

		await generateChunkedMosaic({
			bitmap: makeBitmap(80, 1000),
			tileSize: 10,
			signal: new AbortController().signal,
			targetChunkHeight: 100,
			concurrency: 2,
			onChunkReady: () => {}
		});

		expect(postMosaicChunk).toHaveBeenCalledTimes(10);
		expect(maxInFlight).toBe(2);
	});

	it('resolves silently when the caller aborts mid-flight', async () => {
		vi.mocked(postMosaicChunk).mockImplementation(
			(_blob, _size, signal) =>
				new Promise<Blob>((_resolve, reject) => {
					const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
					if (signal.aborted) onAbort();
					else signal.addEventListener('abort', onAbort, { once: true });
				})
		);

		const controller = new AbortController();
		const onChunkReady = vi.fn();
		const promise = generateChunkedMosaic({
			bitmap: makeBitmap(80, 300),
			tileSize: 10,
			signal: controller.signal,
			targetChunkHeight: 100,
			concurrency: 3,
			onChunkReady
		});

		await flushAsync();
		controller.abort();

		await expect(promise).resolves.toBeUndefined();
		expect(onChunkReady).not.toHaveBeenCalled();
	});

	it('rethrows the first non-abort worker error', async () => {
		vi.mocked(postMosaicChunk).mockRejectedValue(new Error('server says no'));

		await expect(
			generateChunkedMosaic({
				bitmap: makeBitmap(80, 100),
				tileSize: 10,
				signal: new AbortController().signal,
				targetChunkHeight: 100,
				onChunkReady: () => {}
			})
		).rejects.toThrow('server says no');
	});

	it('cancels sibling fetches when one worker fails', async () => {
		const fetchSignals: AbortSignal[] = [];
		let callIndex = 0;
		vi.mocked(postMosaicChunk).mockImplementation((_blob, _size, signal) => {
			fetchSignals.push(signal);
			const myIndex = callIndex++;
			return new Promise<Blob>((_resolve, reject) => {
				const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
				if (signal.aborted) onAbort();
				else signal.addEventListener('abort', onAbort, { once: true });
				// First call fails after siblings have had a chance to start.
				if (myIndex === 0) {
					setTimeout(() => reject(new Error('boom')), 5);
				}
			});
		});

		await expect(
			generateChunkedMosaic({
				bitmap: makeBitmap(80, 300),
				tileSize: 10,
				signal: new AbortController().signal,
				targetChunkHeight: 100,
				concurrency: 3,
				onChunkReady: () => {}
			})
		).rejects.toThrow('boom');

		// All sibling fetches saw the (internal) signal abort.
		expect(fetchSignals.length).toBeGreaterThanOrEqual(2);
		expect(fetchSignals.every((s) => s.aborted)).toBe(true);
	});

	it('suppresses worker errors that happen during an external abort', async () => {
		// When the external abort fires, workers see their pending fetch reject.
		// Here the mock rejects with a non-abort error on abort, so workerError
		// is set; but `signal.aborted` is true at the end, so the function
		// resolves silently rather than rethrowing.
		vi.mocked(postMosaicChunk).mockImplementation(
			(_blob, _size, signal) =>
				new Promise<Blob>((_resolve, reject) => {
					signal.addEventListener('abort', () => reject(new Error('rejected during abort')), {
						once: true
					});
				})
		);

		const controller = new AbortController();
		const promise = generateChunkedMosaic({
			bitmap: makeBitmap(80, 100),
			tileSize: 10,
			signal: controller.signal,
			targetChunkHeight: 100,
			onChunkReady: () => {}
		});

		await flushAsync();
		controller.abort();

		await expect(promise).resolves.toBeUndefined();
	});

	it('does not surface a chunk that is decoded after abort, and still closes it', async () => {
		vi.mocked(postMosaicChunk).mockResolvedValue(new Blob([]));

		const decode = deferred<ImageBitmap>();
		const bitmapClose = vi.fn();
		const stalePainted = vi.fn();
		let decodeCalled!: () => void;
		const decodeStarted = new Promise<void>((r) => {
			decodeCalled = r;
		});

		vi.stubGlobal(
			'createImageBitmap',
			vi.fn(() => {
				decodeCalled();
				return decode.promise;
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
		decode.resolve({ width: 0, height: 0, close: bitmapClose } as unknown as ImageBitmap);

		await expect(promise).resolves.toBeUndefined();
		expect(stalePainted).not.toHaveBeenCalled();
		expect(bitmapClose).toHaveBeenCalledTimes(1);
	});

	it('removes the abort listener from the caller signal after completion', async () => {
		vi.mocked(postMosaicChunk).mockResolvedValue(new Blob([]));

		const controller = new AbortController();
		const addSpy = vi.spyOn(controller.signal, 'addEventListener');
		const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');

		await generateChunkedMosaic({
			bitmap: makeBitmap(80, 100),
			tileSize: 10,
			signal: controller.signal,
			targetChunkHeight: 100,
			onChunkReady: () => {}
		});

		const abortAdds = addSpy.mock.calls.filter((c) => c[0] === 'abort');
		const abortRemoves = removeSpy.mock.calls.filter((c) => c[0] === 'abort');
		expect(abortAdds).toHaveLength(1);
		expect(abortRemoves).toHaveLength(1);
		expect(abortAdds[0][1]).toBe(abortRemoves[0][1]);
	});
});
