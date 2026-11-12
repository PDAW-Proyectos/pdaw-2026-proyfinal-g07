import { Router } from 'express';
import { crearAdminController } from '../controllers/adminController.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

export function crearAdminRouter({ adminService, usuarioService }) {
  const router = Router();
  const controller = crearAdminController({ adminService });

  router.use(requireAdmin(usuarioService));

  router.get('/usuarios', controller.listarUsuarios);
  router.delete('/usuarios/:id', controller.eliminarUsuario);
  router.delete('/resenas/:id', controller.eliminarResena);

  return router;
}
