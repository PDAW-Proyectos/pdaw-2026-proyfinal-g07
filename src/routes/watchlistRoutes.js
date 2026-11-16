import { Router } from 'express';
import { crearWatchlistController } from '../controllers/watchlistController.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireUsuario } from '../middlewares/requireUsuario.js';

export function crearWatchlistRouter({ watchlistService, usuarioService }) {
  const router = Router();
  const controller = crearWatchlistController({ watchlistService });

  router.use(requireAuth, requireUsuario(usuarioService));

  router.get('/', controller.listar);
  router.post('/', controller.crear);
  router.get('/:peliculaId', controller.obtener);
  router.delete('/:peliculaId', controller.eliminar);

  return router;
}
