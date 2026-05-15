export type WorkerContext = {
	signal: AbortSignal;
	claimNext: () => number;
};

export type WorkerPoolOptions = {
	total: number;
	concurrency: number;
	externalSignal: AbortSignal;
	runWorker: (ctx: WorkerContext) => Promise<void>;
};

export async function runWorkerPool({
	total,
	concurrency,
	externalSignal,
	runWorker
}: WorkerPoolOptions): Promise<void> {
	if (total === 0) return;

	// An internal controller lets one failing worker cancel its siblings'
	// in-flight work without mutating the caller's signal. External aborts
	// are forwarded into it.
	const internal = new AbortController();
	const forwardAbort = () => internal.abort(externalSignal.reason);
	if (externalSignal.aborted) {
		internal.abort(externalSignal.reason);
	} else {
		externalSignal.addEventListener('abort', forwardAbort, { once: true });
	}

	let nextIndex = 0;
	const claimNext = (): number => nextIndex++;
	let workerError: unknown = null;

	const runOne = async (): Promise<void> => {
		try {
			await runWorker({ signal: internal.signal, claimNext });
		} catch (e) {
			const isAbort = e instanceof DOMException && e.name === 'AbortError';
			if (!isAbort && workerError === null) {
				workerError = e;
				internal.abort();
			}
		}
	};

	try {
		const workerCount = Math.min(concurrency, total);
		await Promise.all(Array.from({ length: workerCount }, runOne));
	} finally {
		externalSignal.removeEventListener('abort', forwardAbort);
	}

	// Surface the first internal error (if any). External aborts resolve
	// silently — the caller asked us to stop, so there's nothing to report.
	if (workerError !== null && !externalSignal.aborted) {
		throw workerError;
	}
}
