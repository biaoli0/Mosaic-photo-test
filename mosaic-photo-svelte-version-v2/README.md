# Mosaic Photo (SvelteKit)

A SvelteKit version of the mosaic photo generator. Image processing happens on the SvelteKit server via a `+server.ts` endpoint that takes a PNG blob and returns a PNG blob.

## Prerequisites

- Node.js 18+

## Run in development

```bash
cd mosaic-photo-svelte-version-v2
npm install
npm run dev -- --open
```

## Build

```bash
npm run build
npm run preview
```

## Design notes

- **Resize on the client before uploading.** We decode the file with `createImageBitmap(file, { resizeWidth, resizeHeight })` and cap the longest edge at 800 px before anything leaves the browser. The resized canvas (not the original `File`) is what gets `toBlob`-encoded and uploaded, so a 10 MB phone photo becomes a hundreds-KB PNG, and the server's per-pixel mosaic loop runs on far fewer pixels.
- **Wire format is an image blob, not JSON pixels.** Both directions of the API (`POST /api/mosaic?tileSize=<n>`) use `Content-Type: image/png` and binary bodies. This is ~10–15× smaller than a JSON array of RGBA bytes (and ~33% smaller than a base64 `data:` URL on the response side), and lets the browser / `sharp` do the encoding in native code. The page uses a plain `fetch` instead of a SvelteKit form action because actions only serialize JSON-friendly data.
