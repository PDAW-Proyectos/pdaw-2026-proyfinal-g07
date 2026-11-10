import { ErrorDominio } from '../utils/ErrorDominio.js';

const METODOS_CON_CUERPO = new Set(['POST', 'PUT', 'PATCH']);

export function requireJson(req, res, next) {
  if (!METODOS_CON_CUERPO.has(req.method) || req.is('application/json')) {
    next();
    return;
  }

  next(
    new ErrorDominio(
      'CONTENIDO_NO_SOPORTADO',
      'El cuerpo de la solicitud debe enviarse con Content-Type application/json.',
    ),
  );
}
