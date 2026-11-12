import { Router } from 'express';
import { crearVisualizacionController } from '../controllers/visualizacionController.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireUsuario } from '../middlewares/requireUsuario.js';

export function crearVisualizacionRouter({ visualizacionService, usuarioService }) {
  const router = Router();
  const controller = crearVisualizacionController({ visualizacionService });

  router.use(requireAuth, requireUsuario(usuarioService));

  router.get('/', controller.listar);
  router.post('/', controller.crear);
  router.get('/:id', controller.obtener);
  router.patch('/:id', controller.actualizar);
  router.delete('/:id', controller.eliminar);

  return router;
}
