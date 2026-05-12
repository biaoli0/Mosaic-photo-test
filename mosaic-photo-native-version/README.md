# Mosaic Photo (Native)

This native version keeps image transformation on the Node.js server.

## Prerequisites

- Node.js 18+

## Run in development

1. Install dependencies:

   ```bash
   cd mosaic-photo-native-version
   npm install
   ```

2. Start the API server:

   ```bash
   npm run dev
   ```

3. Open `index.html` in your browser (or serve the folder with any static file server).

The client encodes the (already-resized) canvas as a PNG via `canvas.toBlob` and `POST`s it to `http://localhost:3000/api/mosaic?tileSize=<n>`. 

## Design notes

- **Resize on the client before uploading.** We decode the file with `createImageBitmap(file, { resizeWidth, resizeHeight })` and cap the longest edge at 800 px before anything leaves the browser. A 10 MB phone photo typically becomes a hundreds KB PNG, and the server's per-pixel mosaic loop runs on far fewer pixels.
- **Wire format is an image blob, not JSON pixels.** PNG over `Content-Type: image/png` is ~10–15× smaller than a JSON array of RGBA bytes and lets the browser / `sharp` do encoding in native code.
