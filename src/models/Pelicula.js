import {
  validarArrayTexto,
  validarEntero,
  validarId,
  validarRutaPoster,
  validarTexto,
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

  /**
   * Construye una película validando sus datos e invariantes.
   */
  constructor({ id, tmdbId, titulo, sinopsis = '', anioEstreno, generos = [], rutaPoster = null }) {
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
    };
  }

  /**
   * Reconstruye una película a partir de datos persistidos.
   */
  static fromJSON(datos) {
    return new Pelicula(datos);
  }
}
