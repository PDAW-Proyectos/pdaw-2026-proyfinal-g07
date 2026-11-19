import { solicitar } from './apiCliente.js';

/**
 * Devuelve el perfil público de un usuario junto con sus métricas, favoritas
 * y la afinidad con el visitante autenticado, si corresponde.
 */
export function obtenerPerfilPublico(usuarioId) {
  return solicitar(`/usuarios/${encodeURIComponent(usuarioId)}`);
}

/**
 * Devuelve una página de las reseñas públicas de un usuario.
 */
export function listarResenasDeUsuario(usuarioId, { page = 1, limit = 6 } = {}) {
  return solicitar(`/usuarios/${encodeURIComponent(usuarioId)}/resenas`, {
    parametros: { page, limit },
  });
}

export function actualizarFavoritas(usuarioId, favoritas) {
  return solicitar(`/usuarios/${encodeURIComponent(usuarioId)}/favoritas`, {
    metodo: 'PUT',
    cuerpo: { favoritas },
  });
}
