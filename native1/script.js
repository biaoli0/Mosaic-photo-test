const imageUpload = document.getElementById('imageUpload');
const originalCanvas = document.getElementById('originalCanvas');
const mosaicCanvas = document.getElementById('mosaicCanvas');
const tileSize = document.getElementById('tileSize');

imageUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                originalCanvas.width = img.width;
                originalCanvas.height = img.height;
                const ctx = originalCanvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                createMosaic();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };
});

tileSize.addEventListener('change', (event) => {
    const size = Number(event.target.value);
    tileSizeValue.textContent = `${size} px`;
    createMosaic();
});

function createMosaic() {
    const ctx = originalCanvas.getContext('2d');
    const mosaicCtx = mosaicCanvas.getContext('2d');
    mosaicCanvas.width = originalCanvas.width;
    mosaicCanvas.height = originalCanvas.height;

    const size = Number(tileSize.value);

    for (let i = 0; i < originalCanvas.width; i += size) {
        for (let j = 0; j < originalCanvas.height; j += size) {
            const pixelData = ctx.getImageData(i, j, size, size);
            const averageColor = getAverageColor(pixelData);
            mosaicCtx.fillStyle = `rgb(${averageColor.red}, ${averageColor.green}, ${averageColor.blue})`;
            mosaicCtx.fillRect(i, j, size, size);
        }
    }
}

function getAverageColor(pixelData) {
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let i = 0; i < pixelData.data.length; i += 4) {
        red += pixelData.data[i];
        green += pixelData.data[i + 1];
        blue += pixelData.data[i + 2];
    }

    const count = pixelData.data.length / 4;

    return {
        red: Math.round(red / count),
        green: Math.round(green / count),
        blue: Math.round(blue / count),
    };
}
