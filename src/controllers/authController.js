import {
  destruirSesion,
  guardarSesion,
  NOMBRE_COOKIE_SESION,
  regenerarSesion,
} from '../utils/sesion.js';

export function crearAuthController({ usuarioService }) {
  return {
    async registrar(req, res) {
      const usuario = await usuarioService.registrar(req.body);

      await regenerarSesion(req);
      req.session.userId = usuario.id;
      await guardarSesion(req);

      res.status(201).location('/api/auth/sesion').json({ usuario: usuario.toPrivateJSON() });
    },

    async login(req, res) {
      const usuario = await usuarioService.autenticar(req.body);

      await regenerarSesion(req);
      req.session.userId = usuario.id;
      await guardarSesion(req);

      res.json({ usuario: usuario.toPrivateJSON() });
    },

    async sesion(req, res) {
      const usuario = req.session?.userId
        ? await usuarioService.buscarPorId(req.session.userId)
        : null;

      if (!usuario) {
        res.json({ autenticado: false, usuario: null });
        return;
      }

      res.json({ autenticado: true, usuario: usuario.toPrivateJSON() });
    },

    async logout(req, res) {
      await destruirSesion(req);
      res.clearCookie(NOMBRE_COOKIE_SESION, { path: '/' });
      res.status(204).send();
    },
  };
}
