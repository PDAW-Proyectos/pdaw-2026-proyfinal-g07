import { solicitar } from './apiCliente.js';

/**
 * Lista la watchlist del usuario autenticado.
 * Devuelve una colección de entradas { id, fechaAgregado, pelicula }.
 */
export function listarWatchlist({ page = 1, limit = 20 } = {}) {
  return solicitar('/watchlist', { parametros: { page, limit } });
}

/**
 * Indica si una película está en la watchlist: { enWatchlist, entrada? }.
 */
export function consultarWatchlist(peliculaId) {
  return solicitar(`/watchlist/${encodeURIComponent(peliculaId)}`);
}

/**
 * Agrega una película a la watchlist del usuario autenticado.
 */
export function agregarAWatchlist(peliculaId) {
  return solicitar('/watchlist', { metodo: 'POST', cuerpo: { peliculaId } });
}

/**
 * Quita una película de la watchlist del usuario autenticado.
 */
export function quitarDeWatchlist(peliculaId) {
  return solicitar(`/watchlist/${encodeURIComponent(peliculaId)}`, { metodo: 'DELETE' });
}
