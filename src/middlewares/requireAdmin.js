import { ErrorDominio } from '../utils/ErrorDominio.js';
import { destruirSesion } from '../utils/sesion.js';

/**
 * Exige una sesión válida con rol de administrador.
 * Carga el rol desde el repositorio en cada petición para que una baja o
 * degradación tenga efecto inmediato.
 */
export function requireAdmin(usuarioService) {
  return async (req, res, next) => {
    try {
      const usuario = req.session?.userId
        ? await usuarioService.buscarPorId(req.session.userId)
        : null;

      if (!usuario) {
        await destruirSesion(req);
        throw new ErrorDominio('SESION_REQUERIDA', 'La sesión ya no es válida.');
      }

      if (usuario.rol !== 'admin') {
        throw new ErrorDominio('NO_AUTORIZADO', 'La ruta requiere rol de administrador.');
      }

      req.usuario = usuario;
      next();
    } catch (error) {
      next(error);
    }
  };
}
