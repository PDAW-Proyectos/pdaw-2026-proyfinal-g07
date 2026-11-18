import {
  validarArrayTexto,
  validarEntero,
  validarId,
  validarPuntuacionTmdb,
  validarRutaBackdrop,
  validarRutaPoster,
  validarTexto,
  validarVotosTmdb,
} from '../utils/validaciones.js';

/**
 * Película normalizada del catálogo local.
 * Separa el identificador interno del identificador externo de TMDB.
 */
export class Pelicula {
  #id;
  #tmdbId;
  #titulo;
  #sinopsis;
  #anioEstreno;
  #generos;
  #rutaPoster;
  #rutaBackdrop;
  #director;
  #puntuacionTmdb;
  #votosTmdb;

  /**
   * Construye una película validando sus datos e invariantes.
   */
  constructor({
    id,
    tmdbId,
    titulo,
    sinopsis = '',
    anioEstreno,
    generos = [],
    rutaPoster = null,
    rutaBackdrop = null,
    director = null,
    puntuacionTmdb = null,
    votosTmdb = null,
  }) {
    this.#id = validarId(id, 'id');
    this.#tmdbId = validarEntero(tmdbId, 'tmdbId', { min: 1 });
    this.#titulo = validarTexto(titulo, 'titulo', { max: 500 });
    this.#sinopsis = validarTexto(sinopsis ?? '', 'sinopsis', { min: 0, max: 5000 });
    this.#anioEstreno = validarEntero(anioEstreno, 'anioEstreno', {
      min: 1800,
      max: 2100,
    });
    this.#generos = validarArrayTexto(generos, 'generos');
    this.#rutaPoster = validarRutaPoster(rutaPoster);
    this.#rutaBackdrop = validarRutaBackdrop(rutaBackdrop);
    this.#director =
      director === null || director === undefined || director === ''
        ? null
        : validarTexto(director, 'director', { max: 200 });
    this.#puntuacionTmdb = validarPuntuacionTmdb(puntuacionTmdb);
    this.#votosTmdb = validarVotosTmdb(votosTmdb);
  }

  /**
   * Devuelve el identificador interno de la película.
   */
  get id() {
    return this.#id;
  }

  /**
   * Devuelve el identificador de la película en TMDB.
   */
  get tmdbId() {
    return this.#tmdbId;
  }

  /**
   * Devuelve el título de la película.
   */
  get titulo() {
    return this.#titulo;
  }

  /**
   * Devuelve la sinopsis de la película.
   */
  get sinopsis() {
    return this.#sinopsis;
  }

  /**
   * Devuelve el año de estreno.
   */
  get anioEstreno() {
    return this.#anioEstreno;
  }

  /**
   * Devuelve una copia de los géneros para evitar mutaciones externas.
   */
  get generos() {
    return [...this.#generos];
  }

  /**
   * Devuelve la ruta del póster o null si no existe.
   */
  get rutaPoster() {
    return this.#rutaPoster;
  }

  /**
   * Devuelve la ruta del backdrop o null si no existe.
   */
  get rutaBackdrop() {
    return this.#rutaBackdrop;
  }

  get director() {
    return this.#director;
  }

  get puntuacionTmdb() {
    return this.#puntuacionTmdb;
  }

  get votosTmdb() {
    return this.#votosTmdb;
  }

  /**
   * Serializa la película completa para persistencia.
   */
  toJSON() {
    return {
      id: this.#id,
      tmdbId: this.#tmdbId,
      titulo: this.#titulo,
      sinopsis: this.#sinopsis,
      anioEstreno: this.#anioEstreno,
      generos: [...this.#generos],
      rutaPoster: this.#rutaPoster,
      rutaBackdrop: this.#rutaBackdrop,
      director: this.#director,
      puntuacionTmdb: this.#puntuacionTmdb,
      votosTmdb: this.#votosTmdb,
    };
  }

  /**
   * Devuelve la representación resumida que se usa en listados y referencias.
   */
  toResumenJSON() {
    return {
      id: this.#id,
      tmdbId: this.#tmdbId,
      titulo: this.#titulo,
      anioEstreno: this.#anioEstreno,
      generos: [...this.#generos],
      rutaPoster: this.#rutaPoster,
      rutaBackdrop: this.#rutaBackdrop,
      puntuacionTmdb: this.#puntuacionTmdb,
    };
  }

  /**
   * Devuelve la ficha completa de la película.
   */
  toDetalleJSON() {
    return {
      id: this.#id,
      tmdbId: this.#tmdbId,
      titulo: this.#titulo,
      sinopsis: this.#sinopsis,
      anioEstreno: this.#anioEstreno,
      generos: [...this.#generos],
      rutaPoster: this.#rutaPoster,
      rutaBackdrop: this.#rutaBackdrop,
      director: this.#director,
      puntuacionTmdb: this.#puntuacionTmdb,
      votosTmdb: this.#votosTmdb,
    };
  }

  /**
   * Reconstruye una película a partir de datos persistidos.
   */
  static fromJSON(datos) {
    return new Pelicula(datos);
  }
}
