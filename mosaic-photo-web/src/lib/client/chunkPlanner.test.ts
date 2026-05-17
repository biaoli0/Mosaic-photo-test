import { describe, it, expect } from 'vitest';
import { planChunks } from './chunkPlanner';

describe('planChunks', () => {
	it('produces ceil(height / chunkBaseHeight) chunks covering the bitmap', () => {
		// chunkBaseHeight = floor(100 / 10) * 10 = 100. ceil(250 / 100) = 3.
		expect(planChunks(250, 10, 100)).toEqual([
			{ y: 0, height: 100 },
			{ y: 100, height: 100 },
			{ y: 200, height: 50 }
		]);
	});

	it('makes the trailing chunk shorter when height is not a multiple of chunkBaseHeight', () => {
		const plans = planChunks(250, 10, 100);
		expect(plans).toHaveLength(3);
		expect(plans[0]).toEqual({ y: 0, height: 100 });
		expect(plans[1]).toEqual({ y: 100, height: 100 });
		expect(plans[2]).toEqual({ y: 200, height: 50 });
	});

	it('rounds chunk height down to a multiple of tileSize to avoid seams', () => {
		// chunkBaseHeight = floor(100 / 12) * 12 = 96. ceil(192 / 96) = 2.
		const plans = planChunks(192, 12, 100);
		expect(plans).toHaveLength(2);
		expect(plans[0]).toEqual({ y: 0, height: 96 });
		expect(plans[1]).toEqual({ y: 96, height: 96 });
	});

	it('falls back to tileSize when the target chunk height is smaller than the tile', () => {
		// floor(50/200)*200 = 0, so chunkBaseHeight = max(200, 0) = 200.
		const plans = planChunks(400, 200, 50);
		expect(plans).toHaveLength(2);
		expect(plans[0]).toEqual({ y: 0, height: 200 });
		expect(plans[1]).toEqual({ y: 200, height: 200 });
	});

	it('returns an empty array for a zero-height bitmap', () => {
		expect(planChunks(0, 10, 100)).toEqual([]);
	});
});
