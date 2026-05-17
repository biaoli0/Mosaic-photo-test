export type ChunkPlan = { y: number; height: number };

export function planChunks(
	bitmapHeight: number,
	tileSize: number,
	targetChunkHeight: number
): ChunkPlan[] {
	// Chunk heights align to tileSize so tiles do not straddle chunks and leave seams.
	const chunkBaseHeight = Math.max(tileSize, Math.floor(targetChunkHeight / tileSize) * tileSize);
	const totalChunks = Math.ceil(bitmapHeight / chunkBaseHeight);
	if (totalChunks === 0) return [];

	const plans: ChunkPlan[] = new Array(totalChunks);
	for (let i = 0; i < totalChunks; i++) {
		const y = i * chunkBaseHeight;
		const height = Math.min(chunkBaseHeight, bitmapHeight - y);
		plans[i] = { y, height };
	}
	return plans;
}
