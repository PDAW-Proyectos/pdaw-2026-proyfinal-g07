import {
  validarFechaHora,
  validarId,
  validarTexto,
} from "../utils/validaciones.js";

/**
 * Opinión pública escrita por un usuario sobre una película.
 * Es independiente de la visualización y no contiene puntuación.
 */
export class Resena {
  #id;
  #usuarioId;
  #peliculaId;
  #comentario;
  #fechaPublicacion;

  /**
   * Construye una reseña validando sus datos e invariantes.
   */
  constructor({
    id,
    usuarioId,
    peliculaId,
    comentario,
    fechaPublicacion = new Date(),
  }) {
    this.#id = validarId(id, "id");
    this.#usuarioId = validarId(usuarioId, "usuarioId");
    this.#peliculaId = validarId(peliculaId, "peliculaId");
    this.#comentario = validarTexto(comentario, "comentario", { max: 5000 });
    this.#fechaPublicacion = validarFechaHora(
      fechaPublicacion,
      "fechaPublicacion"
    );
  }

  /**
   * Devuelve el identificador interno de la reseña.
   */
  get id() {
    return this.#id;
  }

  /**
   * Devuelve el identificador del autor.
   */
  get usuarioId() {
    return this.#usuarioId;
  }

  /**
   * Devuelve el identificador interno de la película reseñada.
   */
  get peliculaId() {
    return this.#peliculaId;
  }

  /**
   * Devuelve el texto público de la reseña.
   */
  get comentario() {
    return this.#comentario;
  }

  /**
   * Devuelve una copia de la fecha de publicación.
   */
  get fechaPublicacion() {
    return new Date(this.#fechaPublicacion.getTime());
  }

  /**
   * Reemplaza el comentario validando que no quede vacío.
   * La fecha de publicación original no cambia.
   */
  editar(texto) {
    this.#comentario = validarTexto(texto, "comentario", { max: 5000 });
  }

  /**
   * Serializa la reseña para persistencia.
   */
  toJSON() {
    return {
      id: this.#id,
      usuarioId: this.#usuarioId,
      peliculaId: this.#peliculaId,
      comentario: this.#comentario,
      fechaPublicacion: this.#fechaPublicacion.toISOString(),
    };
  }

  /**
   * Reconstruye una reseña a partir de datos persistidos.
   */
  static fromJSON(datos) {
    return new Resena(datos);
  }
}
