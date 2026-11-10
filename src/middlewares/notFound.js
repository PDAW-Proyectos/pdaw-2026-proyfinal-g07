import { ErrorDominio } from '../utils/ErrorDominio.js';

export function notFound(req, res, next) {
  next(new ErrorDominio('NO_ENCONTRADO', 'La ruta solicitada no existe.'));
}
