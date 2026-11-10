import { ErrorDominio } from '../utils/ErrorDominio.js';

const ERRORES_HTTP = new Map([
  ['SOLICITUD_INVALIDA', { status: 400, title: 'Solicitud inválida' }],
  ['VALIDACION_FALLIDA', { status: 400, title: 'Datos inválidos' }],
  ['TIPO_INVALIDO', { status: 400, title: 'Datos inválidos' }],
  ['FORMATO_INVALIDO', { status: 400, title: 'Datos inválidos' }],
  ['LONGITUD_INVALIDA', { status: 400, title: 'Datos inválidos' }],
  ['VALOR_FUERA_DE_RANGO', { status: 400, title: 'Datos inválidos' }],
  ['FECHA_FUTURA', { status: 400, title: 'Datos inválidos' }],
  ['PUNTUACION_INVALIDA', { status: 400, title: 'Datos inválidos' }],
  ['CREDENCIALES_INVALIDAS', { status: 401, title: 'Credenciales inválidas' }],
  ['SESION_REQUERIDA', { status: 401, title: 'Sesión requerida' }],
  ['SESION_EXPIRADA', { status: 401, title: 'Sesión expirada' }],
  ['NO_AUTORIZADO', { status: 403, title: 'Acceso denegado' }],
  ['NO_ENCONTRADO', { status: 404, title: 'No encontrado' }],
  ['PELICULA_NO_ENCONTRADA', { status: 404, title: 'Película no encontrada' }],
  ['EMAIL_DUPLICADO', { status: 409, title: 'Conflicto con el estado actual' }],
  ['NOMBRE_USUARIO_DUPLICADO', { status: 409, title: 'Conflicto con el estado actual' }],
  ['RESENA_DUPLICADA', { status: 409, title: 'Conflicto con el estado actual' }],
  ['ID_DUPLICADO', { status: 409, title: 'Conflicto con el estado actual' }],
  ['CONTENIDO_NO_SOPORTADO', { status: 415, title: 'Tipo de contenido no soportado' }],
  ['DEMASIADOS_INTENTOS', { status: 429, title: 'Demasiadas solicitudes' }],
  ['ERROR_INTERNO', { status: 500, title: 'Error interno' }],
  ['TMDB_NO_DISPONIBLE', { status: 502, title: 'Servicio externo no disponible' }],
]);

function errorConocido(error) {
  if (error instanceof ErrorDominio) {
    const definicion = ERRORES_HTTP.get(error.codigo);

    if (!definicion) {
      return null;
    }

    return {
      status: definicion.status,
      title: definicion.title,
      detail: error.codigo === 'ERROR_INTERNO' ? 'Ocurrió un error inesperado.' : error.message,
      errores: normalizarErrores(error),
    };
  }

  if (error.type === 'entity.parse.failed') {
    return {
      status: 400,
      title: 'Solicitud inválida',
      detail: 'El cuerpo JSON no es válido.',
    };
  }

  return null;
}

function normalizarErrores(error) {
  const { detalles } = error;

  if (!detalles || typeof detalles !== 'object') {
    return undefined;
  }

  if (Array.isArray(detalles)) {
    return detalles.length > 0 ? detalles : undefined;
  }

  if (Array.isArray(detalles.errores)) {
    return detalles.errores.length > 0 ? detalles.errores : undefined;
  }

  if (typeof detalles.campo === 'string') {
    return [{ campo: detalles.campo, mensaje: detalles.mensaje ?? error.message }];
  }

  return undefined;
}

export function errorHandler(logger) {
  return (error, req, res, _next) => {
    const conocido = errorConocido(error);
    const status = conocido?.status ?? 500;
    const contexto = { requestId: req.id, status };

    if (status >= 500) {
      logger.error(error.message, { ...contexto, stack: error.stack });
    } else {
      logger.warn(error.message, contexto);
    }

    const problema = {
      type: 'about:blank',
      title: conocido?.title ?? 'Error interno',
      status,
      detail: conocido?.detail ?? 'Ocurrió un error inesperado.',
      instance: req.originalUrl,
      requestId: req.id,
      ...(conocido?.errores && { errores: conocido.errores }),
    };

    res.status(status).type('application/problem+json').json(problema);
  };
}
