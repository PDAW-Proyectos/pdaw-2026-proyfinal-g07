import { EntradaWatchlist } from '../models/EntradaWatchlist.js';
import { ErrorDominio } from '../utils/ErrorDominio.js';

const COLECCION = 'watchlist';

/**
 * Repositorio de películas pendientes de ver por cada usuario.
 */
export class WatchlistRepository {
  #store;

  /**
   * Recibe el store que provee las colecciones.
   */
  constructor({ store }) {
    this.#store = store;
  }

  /**
   * Guarda una entrada nueva verificando que el usuario no tenga ya esa película.
   * La unicidad se controla dentro de la mutación para evitar duplicados concurrentes.
   */
  async crear(entrada) {
    return this.#store.actualizar(COLECCION, (registros) => {
      const hayEntradaDuplicada = registros.some(
        (registro) =>
          registro.usuarioId === entrada.usuarioId && registro.peliculaId === entrada.peliculaId,
      );

      if (hayEntradaDuplicada) {
        throw new ErrorDominio(
          'PELICULA_YA_EN_WATCHLIST',
          'La película ya está en la watchlist del usuario.',
          { campo: 'peliculaId' },
        );
      }

      registros.push(entrada.toJSON());
      return entrada;
    });
  }

  /**
   * Busca la entrada de un usuario para una película concreta.
   */
  async buscarPorUsuarioYPelicula(usuarioId, peliculaId) {
    const registro = this.#store
      .leer(COLECCION)
      .find(
        (candidato) => candidato.usuarioId === usuarioId && candidato.peliculaId === peliculaId,
      );

    return registro ? EntradaWatchlist.fromJSON(registro) : null;
  }

  /**
   * Devuelve todas las entradas de la watchlist de un usuario.
   */
  async listarPorUsuario(usuarioId) {
    return this.#store
      .leer(COLECCION)
      .filter((registro) => registro.usuarioId === usuarioId)
      .map((registro) => EntradaWatchlist.fromJSON(registro));
  }

  /**
   * Elimina la entrada de una película y devuelve true si existía.
   */
  async eliminarPorUsuarioYPelicula(usuarioId, peliculaId) {
    return this.#store.actualizar(COLECCION, (registros) => {
      const indice = registros.findIndex(
        (registro) => registro.usuarioId === usuarioId && registro.peliculaId === peliculaId,
      );

      if (indice < 0) {
        return false;
      }

      registros.splice(indice, 1);
      return true;
    });
  }

  /**
   * Elimina todas las entradas de un usuario y devuelve cuántas borró.
   */
  async eliminarPorUsuario(usuarioId) {
    return this.#store.actualizar(COLECCION, (registros) => {
      const restantes = registros.filter((registro) => registro.usuarioId !== usuarioId);
      const eliminadas = registros.length - restantes.length;

      registros.splice(0, registros.length, ...restantes);

      return eliminadas;
    });
  }
}
