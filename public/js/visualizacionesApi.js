import { solicitar } from './apiCliente.js';

/**
 * Devuelve el historial de visualizaciones del usuario autenticado.
 * La colección tiene la forma { data, page, limit, total }.
 */
export function listarVisualizaciones({ page = 1, limit = 20, orden = 'fecha_desc' } = {}) {
  return solicitar('/visualizaciones', { parametros: { page, limit, orden } });
}

/**
 * Registra que el usuario autenticado vio una película.
 * La fecha se envía como `YYYY-MM-DD` y la puntuación es opcional.
 */
export function crearVisualizacion({ peliculaId, fecha, puntuacion = null }) {
  return solicitar('/visualizaciones', {
    metodo: 'POST',
    cuerpo: {
      peliculaId,
      fecha,
      ...(puntuacion !== null && { puntuacion }),
    },
  });
}
