import { Router } from 'express';
import { mosaicSettings } from '../settings';

export const settingsRouter: Router = Router();

settingsRouter.get('/', (_req, res) => {
	res.json(mosaicSettings);
});
