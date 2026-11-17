import { Router } from 'express';
import { crearPerfilController } from '../controllers/perfilController.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireUsuario } from '../middlewares/requireUsuario.js';

export function crearPerfilRouter({ perfilService, resenaService, usuarioService }) {
  const router = Router();
  const controller = crearPerfilController({ perfilService, resenaService });

  router.get('/:usuarioId/resenas', controller.resenas);
  router.put(
    '/:usuarioId/favoritas',
    requireAuth,
    requireUsuario(usuarioService),
    controller.actualizarFavoritas,
  );
  router.get('/:usuarioId', controller.perfil);

  return router;
}
