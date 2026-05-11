const express = require('express');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

function applyMosaic(pixels, width, height, size) {
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

app.post('/api/mosaic', (req, res) => {
  const { pixels, width, height, tileSize } = req.body ?? {};

  if (!Array.isArray(pixels) || !Number.isInteger(width) || !Number.isInteger(height) || !Number.isInteger(tileSize)) {
    res.status(400).json({ error: 'Invalid payload.' });
    return;
  }

  const expectedLength = width * height * 4;
  if (pixels.length !== expectedLength) {
    res.status(400).json({ error: 'Pixel array length does not match width/height.' });
    return;
  }

  const clampedTileSize = Math.max(1, tileSize);
  const processed = applyMosaic(Uint8Array.from(pixels), width, height, clampedTileSize);

  res.status(200).json({
    width,
    height,
    pixels: Array.from(processed),
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.listen(PORT, () => {
  console.log(`Mosaic API listening on http://localhost:${PORT}`);
});
