# Mosaic Photo

This repository contains a **mosaic image effect** demo: the browser loads an image, sends it to a small HTTP service that applies a tile-based mosaic with [sharp](https://github.com/lovell/sharp), and paints the result (progressively in the main web app).

## Packages

| Directory                                                      | Role                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`mosaic-photo-api`](./mosaic-photo-api)                       | Express server: `POST /mosaic`, `GET /settings`, `GET /health`.         |
| [`mosaic-photo-web`](./mosaic-photo-web)                       | SvelteKit UI: chunked uploads, canvas preview, configurable via env.    |
| [`mosaic-photo-native-version`](./mosaic-photo-native-version) | Minimal static HTML client plus a Node server variant (see its README). |

Each package has its own `package.json`, scripts, and README with endpoints, env vars, and design notes.

## Quick start (web + API)

Run the backend and frontend in two terminals from the repo root:

```bash
cd mosaic-photo-api && npm install && npm run dev
```

```bash
cd mosaic-photo-web && npm install && npm run dev -- --open
```

By default the API listens on **port 3001** and the web app expects it at `http://localhost:3001` (see `mosaic-photo-web/.env.example` and `VITE_MOSAIC_PHOTO_API_URL`).

## Configuration

- **API:** copy [`mosaic-photo-api/.env.example`](./mosaic-photo-api/.env.example) — `PORT`, `HOST`, body size, tile size limits, etc. Use `CORS_ORIGIN` in production to allow only your frontend origin.
- **Web:** copy [`mosaic-photo-web/.env.example`](./mosaic-photo-web/.env.example) — public API URL (`VITE_*`) and server-only chunking tuning via `$env/dynamic/private` in `+page.server.ts`. Tile bounds come from the API `GET /settings` endpoint.
