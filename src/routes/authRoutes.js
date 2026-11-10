import { Router } from 'express';
import { crearAuthController } from '../controllers/authController.js';
import { limitarIntentos } from '../middlewares/limitarIntentos.js';

export function crearAuthRouter({
  usuarioService,
  limitadorRegistro = limitarIntentos(),
  limitadorLogin = limitarIntentos({
    clave: async (req) => {
      const ip = req.ip ?? 'sin-ip';
      const identificador = String(req.body?.identificador ?? '')
        .trim()
        .toLowerCase();
      const usuario = identificador
        ? await usuarioService.buscarPorIdentificador(identificador)
        : null;

      return usuario ? `${ip}|cuenta:${usuario.id}` : `${ip}|identificador:${identificador}`;
    },
  }),
}) {
  const router = Router();
  const controller = crearAuthController({ usuarioService });

  router.post('/registro', limitadorRegistro, controller.registrar);
  router.post('/login', limitadorLogin, controller.login);
  router.get('/sesion', controller.sesion);
  router.post('/logout', controller.logout);

  return router;
}
