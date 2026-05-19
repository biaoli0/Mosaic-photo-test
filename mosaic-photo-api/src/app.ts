import express, { type Express } from 'express';
import cors from 'cors';
import { mosaicRouter, payloadTooLargeHandler } from './routes/mosaic';
import { settingsRouter } from './routes/settings';

export function createApp(): Express {
	const app = express();

	const corsOrigin = process.env.CORS_ORIGIN ?? '*';
	app.use(cors({ origin: corsOrigin }));

	app.get('/health', (_req, res) => {
		res.json({ status: 'ok' });
	});

	app.use('/settings', settingsRouter);
	app.use('/mosaic', mosaicRouter);

	app.use(payloadTooLargeHandler);

	return app;
}
