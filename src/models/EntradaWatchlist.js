import { validarFechaHora, validarId } from '../utils/validaciones.js';

/**
 * Película pendiente de ver que un usuario guardó en su watchlist.
 * Cada usuario tiene como máximo una entrada por película.
 */
export class EntradaWatchlist {
  #id;
  #usuarioId;
  #peliculaId;
  #fechaAgregado;

  /**
   * Construye la entrada validando sus datos e invariantes.
   */
  constructor({ id, usuarioId, peliculaId, fechaAgregado = new Date() }) {
    this.#id = validarId(id, 'id');
    this.#usuarioId = validarId(usuarioId, 'usuarioId');
    this.#peliculaId = validarId(peliculaId, 'peliculaId');
    this.#fechaAgregado = validarFechaHora(fechaAgregado, 'fechaAgregado');
  }

  /**
   * Devuelve el identificador interno de la entrada.
   */
  get id() {
    return this.#id;
  }

  /**
   * Devuelve el identificador del usuario dueño de la entrada.
   */
  get usuarioId() {
    return this.#usuarioId;
  }

  /**
   * Devuelve el identificador interno de la película guardada.
   */
  get peliculaId() {
    return this.#peliculaId;
  }

  /**
   * Devuelve una copia de la fecha en que se agregó la película.
   */
  get fechaAgregado() {
    return new Date(this.#fechaAgregado.getTime());
  }

  /**
   * Serializa la entrada para persistencia.
   */
  toJSON() {
    return {
      id: this.#id,
      usuarioId: this.#usuarioId,
      peliculaId: this.#peliculaId,
      fechaAgregado: this.#fechaAgregado.toISOString(),
    };
  }

  /**
   * Reconstruye una entrada a partir de datos persistidos.
   */
  static fromJSON(datos) {
    return new EntradaWatchlist(datos);
  }
}
