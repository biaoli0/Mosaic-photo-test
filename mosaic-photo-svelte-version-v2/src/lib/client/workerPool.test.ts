import { describe, it, expect, vi } from 'vitest';
import { runWorkerPool } from './workerPool';

async function waitForWorkersToReachAwait(): Promise<void> {
	await new Promise((r) => setTimeout(r, 0));
	await new Promise((r) => setTimeout(r, 0));
}

describe('runWorkerPool', () => {
	it('is a no-op when total is 0', async () => {
		const runWorker = vi.fn();
		await runWorkerPool({
			total: 0,
			concurrency: 4,
			externalSignal: new AbortController().signal,
			runWorker
		});
		expect(runWorker).not.toHaveBeenCalled();
	});

	it('spawns min(concurrency, total) workers and exhausts the index range', async () => {
		const claimed: number[] = [];
		await runWorkerPool({
			total: 5,
			concurrency: 10,
			externalSignal: new AbortController().signal,
			runWorker: async ({ claimNext }) => {
				while (true) {
					const i = claimNext();
					if (i >= 5) return;
					claimed.push(i);
				}
			}
		});
		expect(claimed.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
	});

	it('respects the concurrency cap', async () => {
		let inFlight = 0;
		let maxInFlight = 0;
		await runWorkerPool({
			total: 10,
			concurrency: 2,
			externalSignal: new AbortController().signal,
			runWorker: async ({ signal, claimNext }) => {
				while (true) {
					if (signal.aborted) return;
					const i = claimNext();
					if (i >= 10) return;
					inFlight += 1;
					maxInFlight = Math.max(maxInFlight, inFlight);
					await new Promise((r) => setTimeout(r, 5));
					inFlight -= 1;
				}
			}
		});
		expect(maxInFlight).toBe(2);
	});

	it('resolves silently when the external signal aborts mid-flight', async () => {
		const ctrl = new AbortController();
		const promise = runWorkerPool({
			total: 3,
			concurrency: 3,
			externalSignal: ctrl.signal,
			runWorker: async ({ signal, claimNext }) => {
				claimNext();
				await new Promise<void>((_resolve, reject) => {
					const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
					if (signal.aborted) onAbort();
					else signal.addEventListener('abort', onAbort, { once: true });
				});
			}
		});

		await waitForWorkersToReachAwait();
		ctrl.abort();
		await expect(promise).resolves.toBeUndefined();
	});

	it('rethrows the first non-abort worker error', async () => {
		await expect(
			runWorkerPool({
				total: 3,
				concurrency: 1,
				externalSignal: new AbortController().signal,
				runWorker: async ({ claimNext }) => {
					claimNext();
					throw new Error('boom');
				}
			})
		).rejects.toThrow('boom');
	});

	it('aborts sibling work when one worker fails', async () => {
		const seenSignals: AbortSignal[] = [];
		await expect(
			runWorkerPool({
				total: 3,
				concurrency: 3,
				externalSignal: new AbortController().signal,
				runWorker: async ({ signal, claimNext }) => {
					seenSignals.push(signal);
					const i = claimNext();
					if (i === 0) {
						await new Promise((r) => setTimeout(r, 5));
						throw new Error('boom');
					}
					await new Promise<void>((_resolve, reject) => {
						const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
						if (signal.aborted) onAbort();
						else signal.addEventListener('abort', onAbort, { once: true });
					});
				}
			})
		).rejects.toThrow('boom');

		expect(seenSignals.length).toBeGreaterThanOrEqual(2);
		expect(seenSignals.every((s) => s.aborted)).toBe(true);
	});

	it('suppresses non-abort errors that surface during an external abort', async () => {
		const ctrl = new AbortController();
		const promise = runWorkerPool({
			total: 1,
			concurrency: 1,
			externalSignal: ctrl.signal,
			runWorker: async ({ signal, claimNext }) => {
				claimNext();
				await new Promise<void>((_resolve, reject) => {
					signal.addEventListener('abort', () => reject(new Error('rejected during abort')), {
						once: true
					});
				});
			}
		});

		await waitForWorkersToReachAwait();
		ctrl.abort();
		await expect(promise).resolves.toBeUndefined();
	});

	it('removes the abort listener from the external signal after completion', async () => {
		const ctrl = new AbortController();
		const addSpy = vi.spyOn(ctrl.signal, 'addEventListener');
		const removeSpy = vi.spyOn(ctrl.signal, 'removeEventListener');

		await runWorkerPool({
			total: 1,
			concurrency: 1,
			externalSignal: ctrl.signal,
			runWorker: async ({ claimNext }) => {
				claimNext();
			}
		});

		const adds = addSpy.mock.calls.filter((c) => c[0] === 'abort');
		const removes = removeSpy.mock.calls.filter((c) => c[0] === 'abort');
		expect(adds).toHaveLength(1);
		expect(removes).toHaveLength(1);
		expect(adds[0][1]).toBe(removes[0][1]);
	});
});
