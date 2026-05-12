const imageUpload = document.getElementById('imageUpload');
const originalCanvas = document.getElementById('originalCanvas');
const mosaicCanvas = document.getElementById('mosaicCanvas');
const tileSize = document.getElementById('tileSize');
const tileSizeValue = document.getElementById('tileSizeValue');

let currentFile = null;
let mosaicDebounceTimeoutId = null;
const mosaicDebounceDelayMs = 180;

imageUpload.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  currentFile = file;
  await drawOriginalToCanvas(file);
  await createMosaicFromServer();
});

tileSize.addEventListener('input', async (event) => {
  const size = Number(event.target.value);
  tileSizeValue.textContent = `${size} px`;

  if (currentFile) {
    queueMosaicRefresh();
  }
});

function queueMosaicRefresh() {
  if (mosaicDebounceTimeoutId) {
    clearTimeout(mosaicDebounceTimeoutId);
  }

  mosaicDebounceTimeoutId = setTimeout(async () => {
    mosaicDebounceTimeoutId = null;
    await createMosaicFromServer();
  }, mosaicDebounceDelayMs);
}

async function drawOriginalToCanvas(file) {
  const probe = await createImageBitmap(file);
  const maxDimension = 800;
  const scale = Math.min(1, maxDimension / Math.max(probe.width, probe.height));
  const resizeWidth = Math.max(1, Math.round(probe.width * scale));
  const resizeHeight = Math.max(1, Math.round(probe.height * scale));
  probe.close();

  const bitmap = await createImageBitmap(file, {
    resizeWidth,
    resizeHeight,
  });

  originalCanvas.width = resizeWidth;
  originalCanvas.height = resizeHeight;

  const ctx = originalCanvas.getContext('2d');
  ctx.clearRect(0, 0, resizeWidth, resizeHeight);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
}

async function createMosaicFromServer() {
  const blob = await new Promise((resolve, reject) => {
    originalCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode canvas as blob.'))),
      'image/png'
    );
  });

  const response = await fetch(
    `http://localhost:3000/api/mosaic?tileSize=${Number(tileSize.value)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': blob.type },
      body: blob,
    }
  );

  if (!response.ok) {
    throw new Error(`Mosaic request failed with status ${response.status}`);
  }

  const mosaicBlob = await response.blob();
  const mosaicBitmap = await createImageBitmap(mosaicBlob);

  mosaicCanvas.width = mosaicBitmap.width;
  mosaicCanvas.height = mosaicBitmap.height;

  const mosaicCtx = mosaicCanvas.getContext('2d');
  mosaicCtx.clearRect(0, 0, mosaicBitmap.width, mosaicBitmap.height);
  mosaicCtx.drawImage(mosaicBitmap, 0, 0);
  mosaicBitmap.close();
}
