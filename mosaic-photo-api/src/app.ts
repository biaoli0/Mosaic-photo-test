import express, { type Express } from 'express';
import cors from 'cors';
import { payloadTooLargeHandler } from './mosaic/errors';
import { mosaicRouter } from './mosaic/route';
import { settingsRouter } from './settings/route';

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
