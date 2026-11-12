import { ErrorDominio } from '../utils/ErrorDominio.js';
import { destruirSesion } from '../utils/sesion.js';

/**
 * Carga el usuario de la sesión y rechaza la petición si la cuenta ya no existe
 * (por ejemplo, porque un administrador la eliminó).
 */
export function requireUsuario(usuarioService) {
  return async (req, res, next) => {
    try {
      const usuario = req.session?.userId
        ? await usuarioService.buscarPorId(req.session.userId)
        : null;

      if (!usuario) {
        await destruirSesion(req);
        throw new ErrorDominio('SESION_REQUERIDA', 'La sesión ya no es válida.');
      }

      req.usuario = usuario;
      next();
    } catch (error) {
      next(error);
    }
  };
}
