import { Router } from 'express';
import { crearResenaController } from '../controllers/resenaController.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireUsuario } from '../middlewares/requireUsuario.js';

export function crearResenaRouter({ resenaService, usuarioService }) {
  const router = Router();
  const controller = crearResenaController({ resenaService });
  const autenticado = [requireAuth, requireUsuario(usuarioService)];

  // Las rutas fijas van antes de /:id para que no las capture el parámetro.
  router.get('/recientes', controller.recientes);
  router.get('/mias', ...autenticado, controller.mias);
  router.get('/:id', controller.obtener);
  router.post('/', ...autenticado, controller.crear);
  router.patch('/:id', ...autenticado, controller.actualizar);
  router.delete('/:id', ...autenticado, controller.eliminar);

  return router;
}
