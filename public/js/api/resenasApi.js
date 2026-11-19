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
 * Publica una reseña nueva. Recibe { peliculaId, comentario, puntuacion }.
 * La puntuación es opcional: se envía null si no se eligió ninguna.
 */
export function crearResena({ peliculaId, comentario, puntuacion = null }) {
  return solicitar('/resenas', {
    metodo: 'POST',
    cuerpo: { peliculaId, comentario, puntuacion },
  });
}

/**
 * Reemplaza el comentario y la puntuación opcional de una reseña propia.
 */
export function actualizarResena(id, { comentario, puntuacion = null }) {
  return solicitar(`/resenas/${encodeURIComponent(id)}`, {
    metodo: 'PATCH',
    cuerpo: { comentario, puntuacion },
  });
}

/**
 * Elimina una reseña propia.
 */
export function eliminarResena(id) {
  return solicitar(`/resenas/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
}
