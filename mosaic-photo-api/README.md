# mosaic-photo-api

Express backend for mosaic image processing. Decoupled from the SvelteKit frontend so the two can be deployed and scaled independently.

## Endpoints

- `GET /health` &mdash; liveness probe, returns `{ "status": "ok" }`.
- `GET /settings` &mdash; returns the active client-relevant limits: `tileSize.min`, `tileSize.max`, and `maxBodyBytes`.
- `POST /mosaic?tileSize=<int>` &mdash; accepts an image binary (`Content-Type: image/png` typical), returns a PNG of the same dimensions with the mosaic effect applied. `tileSize` must be within the configured bounds. The body is capped by `MAX_BODY_BYTES` (default `20 MiB`); `GET /settings` exposes the active byte limit.

## Prerequisites

- Node.js 18+

## Run in development

```bash
cd mosaic-photo-api
npm install
npm run dev
```

Defaults to `http://localhost:3001`. Override with `PORT` / `HOST` env vars.

## Build and run

```bash
cd mosaic-photo-api
npm run build
npm start
```

Compiled JavaScript is written to `dist/`.

## Configuration

| Env var          | Default                    | Notes                                                                               |
| ---------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| `PORT`           | `3001`                     | TCP port to listen on.                                                              |
| `HOST`           | `0.0.0.0`                  | Bind address.                                                                       |
| `CORS_ORIGIN`    | `*` (any origin permitted) | Lock down to your frontend origin in production, e.g. `https://mosaic.example.com`. |
| `MAX_BODY_BYTES` | `20971520`                 | Max raw image upload size in bytes.                                                 |
| `MIN_TILE_SIZE`  | `2`                        | Minimum accepted `tileSize`.                                                        |
| `MAX_TILE_SIZE`  | `256`                      | Maximum accepted `tileSize`.                                                        |

## Tests / type-checking

```bash
npm test       # runs the route smoke tests via supertest
npm run check  # tsc --noEmit
```
