import { ErrorDominio } from '../utils/ErrorDominio.js';

const METODOS_CON_CUERPO = new Set(['POST', 'PUT', 'PATCH']);

export function requireJson(req, res, next) {
  const tieneCuerpo =
    Number(req.headers['content-length'] ?? 0) > 0 || Boolean(req.headers['transfer-encoding']);

  if (!METODOS_CON_CUERPO.has(req.method) || !tieneCuerpo || req.is('application/json')) {
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
