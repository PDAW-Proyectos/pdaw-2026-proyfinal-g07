import { Router } from 'express';
import { crearEstadisticaController } from '../controllers/estadisticaController.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireUsuario } from '../middlewares/requireUsuario.js';

export function crearEstadisticaRouter({ estadisticaService, usuarioService }) {
  const router = Router();
  const controller = crearEstadisticaController({ estadisticaService });

  router.use(requireAuth, requireUsuario(usuarioService));

  router.get('/me', controller.obtener);

  return router;
}
