# Mosaic Photo (SvelteKit, chunked client)

The SvelteKit **frontend** for the mosaic photo generator. The image processing itself runs in a separate Node service — see [`../mosaic-photo-api`](../mosaic-photo-api). This package is now UI-only: it decodes the file, splits it into chunks, calls the backend over HTTP for each chunk, and paints the responses progressively onto a canvas.

## Prerequisites

- Node.js 18+
- The `mosaic-photo-api` service running (default `http://localhost:3001`).

## Run in development

```bash
# In one terminal — start the backend
cd mosaic-photo-api
npm install
npm run dev

# In another — start the frontend
cd mosaic-photo-web
npm install
npm run dev -- --open
```

## Configuration

| Env var                    | Default                 | Notes                                                                                                                          |
| -------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_MOSAIC_PHOTO_API_URL`  | `http://localhost:3001` | Resolved at build time. Must be set in the build environment for production. Vite-exposed env vars must be prefixed `VITE_`. |

A `.env.example` is checked in — copy it to `.env.local` if you need to override the default.

## Build

```bash
npm run build
npm run preview
```

## Design notes

- **Chunked rendering.** A bitmap is decoded once on the main thread, then `chunkPlanner` slices it into tile-aligned horizontal strips and a small worker pool (default concurrency 4) sends each strip to `POST {VITE_MOSAIC_PHOTO_API_URL}/mosaic?tileSize=<n>`. As each strip comes back it's drawn into the visible canvas, giving a top-to-bottom progressive reveal.
- **Resize on the client before uploading.** We decode the file with `createImageBitmap(file, { resizeWidth, resizeHeight })` and cap the longest edge at 800 px before anything leaves the browser. The resized canvas (not the original `File`) is what gets `toBlob`-encoded and uploaded, so a 10 MB phone photo becomes a hundreds-KB PNG and the server's per-pixel mosaic loop runs on far fewer pixels.
- **Wire format is an image blob, not JSON pixels.** Both directions of the API use `Content-Type: image/png` and binary bodies. This is ~10–15× smaller than a JSON array of RGBA bytes (and ~33% smaller than a base64 `data:` URL on the response side), and lets the browser / `sharp` do the encoding in native code.
- **Cross-origin direct connect.** The frontend talks to the backend directly (not through a SvelteKit-side proxy), so the backend must serve permissive CORS in dev and an explicit allow-list in prod (`CORS_ORIGIN` on the backend).
