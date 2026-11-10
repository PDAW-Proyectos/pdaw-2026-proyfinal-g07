import { validarFechaNoFutura, validarId, validarPuntuacion } from '../utils/validaciones.js';

/**
 * Registro privado de una película vista por un usuario.
 * La puntuación es opcional y pertenece a este registro, no a la reseña.
 */
export class Visualizacion {
  #id;
  #usuarioId;
  #peliculaId;
  #fecha;
  #puntuacion;

  /**
   * Construye una visualización validando sus datos e invariantes.
   * El parámetro hoy permite probar la regla de fechas futuras con un reloj fijo.
   */
  constructor({ id, usuarioId, peliculaId, fecha, puntuacion = null }, hoy = new Date()) {
    this.#id = validarId(id, 'id');
    this.#usuarioId = validarId(usuarioId, 'usuarioId');
    this.#peliculaId = validarId(peliculaId, 'peliculaId');
    this.#fecha = validarFechaNoFutura(fecha, hoy);
    this.#puntuacion = validarPuntuacion(puntuacion);
  }

  /**
   * Devuelve el identificador interno de la visualización.
   */
  get id() {
    return this.#id;
  }

  /**
   * Devuelve el identificador del usuario dueño del registro.
   */
  get usuarioId() {
    return this.#usuarioId;
  }

  /**
   * Devuelve el identificador interno de la película vista.
   */
  get peliculaId() {
    return this.#peliculaId;
  }

  /**
   * Devuelve la fecha de visualización en formato YYYY-MM-DD.
   */
  get fecha() {
    return this.#fecha;
  }

  /**
   * Devuelve la puntuación de 1 a 5, o null si no fue calificada.
   */
  get puntuacion() {
    return this.#puntuacion;
  }

  /**
   * Cambia la fecha de visualización validando que no sea futura.
   */
  cambiarFecha(fecha, hoy = new Date()) {
    this.#fecha = validarFechaNoFutura(fecha, hoy);
  }

  /**
   * Cambia la puntuación; null permite quitar la calificación.
   */
  cambiarPuntuacion(valor) {
    this.#puntuacion = validarPuntuacion(valor);
  }

  /**
   * Serializa la visualización para persistencia.
   */
  toJSON() {
    return {
      id: this.#id,
      usuarioId: this.#usuarioId,
      peliculaId: this.#peliculaId,
      fecha: this.#fecha,
      puntuacion: this.#puntuacion,
    };
  }

  /**
   * Reconstruye una visualización a partir de datos persistidos.
   */
  static fromJSON(datos, hoy = new Date()) {
    return new Visualizacion(datos, hoy);
  }
}
