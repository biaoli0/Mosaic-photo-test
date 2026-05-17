export function applyMosaic(
	pixels: Uint8Array,
	width: number,
	height: number,
	size: number
): Uint8Array {
	const output = new Uint8Array(pixels);

	for (let y = 0; y < height; y += size) {
		for (let x = 0; x < width; x += size) {
			const tileWidth = Math.min(size, width - x);
			const tileHeight = Math.min(size, height - y);

			let red = 0;
			let green = 0;
			let blue = 0;
			let alpha = 0;
			let count = 0;

			for (let ty = 0; ty < tileHeight; ty += 1) {
				for (let tx = 0; tx < tileWidth; tx += 1) {
					const idx = ((y + ty) * width + (x + tx)) * 4;
					red += output[idx];
					green += output[idx + 1];
					blue += output[idx + 2];
					alpha += output[idx + 3];
					count += 1;
				}
			}

			const avgRed = Math.round(red / count);
			const avgGreen = Math.round(green / count);
			const avgBlue = Math.round(blue / count);
			const avgAlpha = Math.round(alpha / count);

			for (let ty = 0; ty < tileHeight; ty += 1) {
				for (let tx = 0; tx < tileWidth; tx += 1) {
					const idx = ((y + ty) * width + (x + tx)) * 4;
					output[idx] = avgRed;
					output[idx + 1] = avgGreen;
					output[idx + 2] = avgBlue;
					output[idx + 3] = avgAlpha;
				}
			}
		}
	}

	return output;
}
