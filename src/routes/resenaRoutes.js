import { Router } from 'express';
import { crearResenaController } from '../controllers/resenaController.js';
import { requireAuth } from '../middlewares/requireAuth.js';

export function crearResenaRouter({ resenaService }) {
  const router = Router();
  const controller = crearResenaController({ resenaService });

  // Las rutas fijas van antes de /:id para que no las capture el parámetro.
  router.get('/recientes', controller.recientes);
  router.get('/mias', requireAuth, controller.mias);
  router.get('/:id', controller.obtener);
  router.post('/', requireAuth, controller.crear);
  router.patch('/:id', requireAuth, controller.actualizar);
  router.delete('/:id', requireAuth, controller.eliminar);

  return router;
}
