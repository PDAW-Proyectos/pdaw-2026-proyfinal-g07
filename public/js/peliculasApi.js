import { solicitar } from './apiCliente.js';

/**
 * Busca películas por título. Devuelve una colección de PeliculaResumen:
 * { data, page, limit, total }.
 */
export function buscarPeliculas({ q, page = 1 }) {
  return solicitar('/peliculas/buscar', { parametros: { q, page } });
}

/**
 * Lista las películas en tendencia. Devuelve una colección de PeliculaResumen.
 */
export function obtenerTendencias({ page = 1 } = {}) {
  return solicitar('/peliculas/tendencias', { parametros: { page } });
}

/**
 * Devuelve el catálogo amplio de películas populares de todas las épocas.
 */
export function obtenerCatalogo({ page = 1 } = {}) {
  return solicitar('/peliculas/catalogo', { parametros: { page } });
}

/**
 * Devuelve recomendaciones personalizadas. Requiere sesión.
 */
export function obtenerRecomendadas() {
  return solicitar('/peliculas/recomendadas');
}

/**
 * Devuelve la PeliculaDetalle del catálogo local según su id interno.
 */
export function obtenerPelicula(peliculaId) {
  return solicitar(`/peliculas/${encodeURIComponent(peliculaId)}`);
}

/**
 * Devuelve el trailer oficial de una película o `{ trailer: null }`.
 */
export function obtenerTrailer(peliculaId) {
  return solicitar(`/peliculas/${encodeURIComponent(peliculaId)}/trailer`);
}

/**
 * Devuelve la colección de reseñas públicas de una película.
 */
export function obtenerResenasDePelicula(peliculaId, { page = 1, limit = 20 } = {}) {
  return solicitar(`/peliculas/${encodeURIComponent(peliculaId)}/resenas`, {
    parametros: { page, limit },
  });
}
