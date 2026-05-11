const imageUpload = document.getElementById('imageUpload');
const originalCanvas = document.getElementById('originalCanvas');
const mosaicCanvas = document.getElementById('mosaicCanvas');
const tileSize = document.getElementById('tileSize');
const tileSizeValue = document.getElementById('tileSizeValue');

let currentImage = null;

imageUpload.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = async () => {
      currentImage = img;
      drawOriginalToCanvas(img);
      await createMosaicFromServer();
    };
    img.src = e.target.result;
  };

  reader.readAsDataURL(file);
});

tileSize.addEventListener('input', async (event) => {
  const size = Number(event.target.value);
  tileSizeValue.textContent = `${size} px`;

  if (currentImage) {
    drawOriginalToCanvas(currentImage);
    await createMosaicFromServer();
  }
});

function drawOriginalToCanvas(img) {
  const maxDimension = 800;
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  originalCanvas.width = width;
  originalCanvas.height = height;

  const ctx = originalCanvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
}

async function createMosaicFromServer() {
  const sourceCtx = originalCanvas.getContext('2d');
  const sourceImageData = sourceCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);

  const payload = {
    width: originalCanvas.width,
    height: originalCanvas.height,
    tileSize: Number(tileSize.value),
    pixels: Array.from(new Uint8Array(sourceImageData.data.buffer)),
  };

  const response = await fetch('http://localhost:3000/api/mosaic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Mosaic request failed with status ${response.status}`);
  }

  const result = await response.json();
  const mosaicPixels = new Uint8ClampedArray(Uint8Array.from(result.pixels));

  mosaicCanvas.width = result.width;
  mosaicCanvas.height = result.height;

  const mosaicCtx = mosaicCanvas.getContext('2d');
  const mosaicImageData = new ImageData(mosaicPixels, result.width, result.height);
  mosaicCtx.putImageData(mosaicImageData, 0, 0);
}
