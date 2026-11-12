import { Pelicula } from '../models/Pelicula.js';
import { ErrorDominio } from '../utils/ErrorDominio.js';

const COLECCION = 'peliculas';

/**
 * Repositorio del catálogo local de películas.
 */
export class PeliculaRepository {
  #store;

  /**
   * Recibe el store que provee las colecciones.
   */
  constructor({ store }) {
    this.#store = store;
  }

  /**
   * Guarda o actualiza una película.
   * Si ya existe una con el mismo tmdbId, conserva el id interno original.
   */
  async guardar(pelicula) {
    const [guardada] = await this.guardarVarias([pelicula]);

    return guardada;
  }

  /**
   * Guarda o actualiza varias películas con una sola escritura en el store.
   * Devuelve las instancias persistidas, con el id interno original cuando ya existían.
   */
  async guardarVarias(peliculas) {
    if (peliculas.length === 0) {
      return [];
    }

    return this.#store.actualizar(COLECCION, (registros) => {
      const guardadas = [];

      for (const pelicula of peliculas) {
        const indiceTmdb = registros.findIndex((registro) => registro.tmdbId === pelicula.tmdbId);

        if (indiceTmdb >= 0) {
          const actualizada = Pelicula.fromJSON({
            ...pelicula.toJSON(),
            id: registros[indiceTmdb].id,
          });

          registros[indiceTmdb] = actualizada.toJSON();
          guardadas.push(actualizada);
          continue;
        }

        const hayIdDuplicado = registros.some((registro) => registro.id === pelicula.id);

        if (hayIdDuplicado) {
          throw new ErrorDominio('ID_DUPLICADO', 'Ya existe una película con ese id interno.', {
            campo: 'id',
          });
        }

        registros.push(pelicula.toJSON());
        guardadas.push(pelicula);
      }

      return guardadas;
    });
  }

  /**
   * Busca una película por su identificador interno.
   */
  async buscarPorId(id) {
    const registro = this.#store.leer(COLECCION).find((candidato) => candidato.id === id);

    return registro ? Pelicula.fromJSON(registro) : null;
  }

  /**
   * Busca una película por su identificador de TMDB.
   */
  async buscarPorTmdbId(tmdbId) {
    const registro = this.#store.leer(COLECCION).find((candidato) => candidato.tmdbId === tmdbId);

    return registro ? Pelicula.fromJSON(registro) : null;
  }

  /**
   * Devuelve todas las películas del catálogo local.
   */
  async listar() {
    return this.#store.leer(COLECCION).map((registro) => Pelicula.fromJSON(registro));
  }
}
