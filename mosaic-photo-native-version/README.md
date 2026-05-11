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

The client sends image pixel data to `POST http://localhost:3000/api/mosaic` and renders the processed response.
