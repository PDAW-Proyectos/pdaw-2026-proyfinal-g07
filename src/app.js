import express from 'express';
import { fileURLToPath } from 'node:url';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { requestContext } from './middlewares/requestContext.js';
import { requireJson } from './middlewares/requireJson.js';
import { logger as loggerPredeterminado } from './utils/logger.js';

const publicPath = fileURLToPath(new URL('../public/', import.meta.url));

export function createApp({ logger = loggerPredeterminado } = {}) {
  const app = express();

  app.disable('x-powered-by');

  app.use(requestContext(logger));
  app.use('/api', requireJson);
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/salud', (req, res) => {
    res.json({ estado: 'ok' });
  });

  app.use(express.static(publicPath));

  app.use(notFound);
  app.use(errorHandler(logger));

  return app;
}
