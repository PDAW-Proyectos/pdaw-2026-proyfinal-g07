import { Router } from 'express';
import { crearVisualizacionController } from '../controllers/visualizacionController.js';
import { requireAuth } from '../middlewares/requireAuth.js';

export function crearVisualizacionRouter({ visualizacionService }) {
  const router = Router();
  const controller = crearVisualizacionController({ visualizacionService });

  router.use(requireAuth);

  router.get('/', controller.listar);
  router.post('/', controller.crear);
  router.get('/:id', controller.obtener);
  router.patch('/:id', controller.actualizar);
  router.delete('/:id', controller.eliminar);

  return router;
}
