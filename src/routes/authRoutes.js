import { Router } from 'express';
import { crearAuthController } from '../controllers/authController.js';

export function crearAuthRouter({ usuarioService }) {
  const router = Router();
  const controller = crearAuthController({ usuarioService });

  router.post('/registro', controller.registrar);
  router.get('/sesion', controller.sesion);
  router.post('/logout', controller.logout);

  return router;
}
