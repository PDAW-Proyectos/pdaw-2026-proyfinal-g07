import { Router } from 'express';
import { crearPeliculaController } from '../controllers/peliculaController.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireUsuario } from '../middlewares/requireUsuario.js';

export function crearPeliculaRouter({ peliculaService, usuarioService }) {
  const router = Router();
  const controller = crearPeliculaController({ peliculaService });

  // Las rutas fijas van antes de /:peliculaId para que no las capture el parámetro.
  router.get('/buscar', controller.buscar);
  router.get('/tendencias', controller.tendencias);

  if (usuarioService) {
    router.get(
      '/recomendadas',
      requireAuth,
      requireUsuario(usuarioService),
      controller.recomendadas,
    );
  }

  router.get('/:peliculaId/resenas', controller.resenas);
  router.get('/:peliculaId', controller.obtener);

  return router;
}
