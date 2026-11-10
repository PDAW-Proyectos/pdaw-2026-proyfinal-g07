import express from 'express';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { requestContext } from './middlewares/requestContext.js';
import { requireJson } from './middlewares/requireJson.js';
import { createSessionMiddleware } from './middlewares/session.js';
import { crearAuthRouter } from './routes/authRoutes.js';
import { crearResenaRouter } from './routes/resenaRoutes.js';
import { logger as loggerPredeterminado } from './utils/logger.js';

const publicPath = fileURLToPath(new URL('../public/', import.meta.url));

export function createApp({ logger = loggerPredeterminado, container } = {}) {
  const app = express();

  app.disable('x-powered-by');

  if (config.esProduccion) {
    // El hosting termina TLS en un proxy. Sin esto, express-session no detecta
    // la conexión como segura y nunca envía la cookie de sesión al navegador.
    app.set('trust proxy', 1);
  }

  app.use(requestContext(logger));
  app.use(createSessionMiddleware());
  app.use('/api', requireJson);
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/salud', (req, res) => {
    res.json({ estado: 'ok' });
  });

  if (container?.usuarioService) {
    app.use('/api/auth', crearAuthRouter({ usuarioService: container.usuarioService }));
  }

  if (container?.resenaService) {
    app.use('/api/resenas', crearResenaRouter({ resenaService: container.resenaService }));
  }

  app.use(express.static(publicPath));

  app.use(notFound);
  app.use(errorHandler(logger));

  return app;
}
