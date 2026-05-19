export type MosaicSettings = {
	maxBodyBytes: number;
	tileSize: {
		min: number;
		max: number;
	};
};

function parseEnvPositiveInt(
	env: NodeJS.ProcessEnv,
	name: string,
	defaultValue: number
): number {
	const raw = env[name];
	if (raw === undefined || raw.trim() === '') return defaultValue;
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) {
		throw new Error(`Environment variable ${name} must be a positive integer, got: ${raw}`);
	}
	return n;
}

export function createMosaicSettings(env: NodeJS.ProcessEnv = process.env): MosaicSettings {
	const maxBodyBytes = parseEnvPositiveInt(env, 'MAX_BODY_BYTES', 20 * 1024 * 1024);
	const minTileSize = parseEnvPositiveInt(env, 'MIN_TILE_SIZE', 2);
	const maxTileSize = parseEnvPositiveInt(env, 'MAX_TILE_SIZE', 256);

	if (minTileSize > maxTileSize) {
		throw new Error(
			`Invalid mosaic limits: MIN_TILE_SIZE (${minTileSize}) cannot be greater than MAX_TILE_SIZE (${maxTileSize})`
		);
	}

	return {
		maxBodyBytes,
		tileSize: {
			min: minTileSize,
			max: maxTileSize
		}
	};
}

export const mosaicSettings = createMosaicSettings();
