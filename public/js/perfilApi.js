import { solicitar } from './apiCliente.js';

/**
 * Devuelve el historial de visualizaciones del usuario autenticado.
 */
export function obtenerVisualizaciones({ page = 1, limit = 20 } = {}) {
  return solicitar('/visualizaciones', { parametros: { page, limit } });
}

/**
 * Devuelve las reseñas escritas por el usuario autenticado.
 */
export function obtenerMisResenas({ page = 1, limit = 20 } = {}) {
  return solicitar('/resenas/mias', { parametros: { page, limit } });
}
