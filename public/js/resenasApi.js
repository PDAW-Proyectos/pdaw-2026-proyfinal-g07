import { solicitar } from './apiCliente.js';

/**
 * Devuelve las últimas reseñas públicas. La colección tiene la forma
 * { data, page, limit, total }.
 */
export function listarResenasRecientes({ page = 1, limit = 10 } = {}) {
  return solicitar('/resenas/recientes', { parametros: { page, limit } });
}

/**
 * Devuelve las reseñas del usuario autenticado.
 */
export function listarMisResenas({ page = 1, limit = 20 } = {}) {
  return solicitar('/resenas/mias', { parametros: { page, limit } });
}

/**
 * Publica una reseña nueva. Recibe { peliculaId, comentario }.
 */
export function crearResena({ peliculaId, comentario }) {
  return solicitar('/resenas', { metodo: 'POST', cuerpo: { peliculaId, comentario } });
}

/**
 * Reemplaza el comentario de una reseña propia.
 */
export function actualizarResena(id, { comentario }) {
  return solicitar(`/resenas/${encodeURIComponent(id)}`, {
    metodo: 'PATCH',
    cuerpo: { comentario },
  });
}

/**
 * Elimina una reseña propia.
 */
export function eliminarResena(id) {
  return solicitar(`/resenas/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
}
