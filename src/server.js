import { createApp } from './app.js';
import { config } from './config.js';
import { createContainer } from './container.js';
import { logger } from './utils/logger.js';

const container = await createContainer();

try {
  const administrador = await container.adminService.asegurarAdmin({
    email: config.adminEmail,
    password: config.adminPassword,
    nombre: config.adminNombre,
    nombreUsuario: config.adminUsuario,
  });

  if (administrador?.estado === 'creado') {
    logger.info('administrador creado', { usuario: administrador.usuario.nombreUsuario });
  }

  if (administrador?.estado === 'conflicto') {
    logger.warn('ADMIN_EMAIL ya existe sin rol admin; no se promovió');
  }
} catch (error) {
  logger.error('no se pudo preparar el administrador', { error: error.message });
  process.exit(1);
}

const app = createApp({ logger, container });

const server = app.listen(config.port, () => {
  logger.info('servidor iniciado', { port: config.port });
});

process.on('unhandledRejection', (reason) => {
  logger.error('promesa rechazada sin manejar', { reason: String(reason) });
});

process.on('uncaughtException', (error) => {
  logger.error('excepción no capturada', { stack: error.stack });
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('apagado ordenado');
  server.close(() => process.exit(0));
});
