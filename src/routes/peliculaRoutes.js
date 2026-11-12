import { Router } from 'express';
import { crearPeliculaController } from '../controllers/peliculaController.js';

export function crearPeliculaRouter({ peliculaService }) {
  const router = Router();
  const controller = crearPeliculaController({ peliculaService });

  // Las rutas fijas van antes de /:peliculaId para que no las capture el parámetro.
  router.get('/buscar', controller.buscar);
  router.get('/tendencias', controller.tendencias);
  router.get('/:peliculaId/resenas', controller.resenas);
  router.get('/:peliculaId', controller.obtener);

  return router;
}
