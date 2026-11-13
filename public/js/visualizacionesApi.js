import { solicitar } from './apiCliente.js';

/**
 * Devuelve el historial de visualizaciones del usuario autenticado.
 * La colección tiene la forma { data, page, limit, total }.
 */
export function listarVisualizaciones({ page = 1, limit = 20, orden = 'fecha_desc' } = {}) {
  return solicitar('/visualizaciones', { parametros: { page, limit, orden } });
}
