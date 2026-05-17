import express, { type Express } from 'express';
import cors from 'cors';
import { mosaicRouter, payloadTooLargeHandler } from './routes/mosaic';

export function createApp(): Express {
	const app = express();

	const corsOrigin = process.env.CORS_ORIGIN ?? '*';
	app.use(cors({ origin: corsOrigin }));

	app.get('/health', (_req, res) => {
		res.json({ status: 'ok' });
	});

	app.use('/mosaic', mosaicRouter);

	app.use(payloadTooLargeHandler);

	return app;
}
