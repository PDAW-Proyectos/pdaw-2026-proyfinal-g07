import { ErrorDominio } from '../utils/ErrorDominio.js';

export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    next(new ErrorDominio('SESION_REQUERIDA', 'La ruta requiere iniciar sesión.'));
    return;
  }

  next();
}
