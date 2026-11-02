import { Resena } from "../models/Resena.js";
import { ErrorDominio } from "../utils/ErrorDominio.js";

const COLECCION = "resenas";

/**
 * Repositorio de reseñas públicas.
 */
export class ResenaRepository {
  #store;

  /**
   * Recibe el store que provee las colecciones.
   */
  constructor({ store }) {
    this.#store = store;
  }

  /**
   * Guarda una reseña nueva verificando que el usuario no haya reseñado ya esa película.
   */
  async crear(resena) {
    return this.#store.actualizar(COLECCION, (registros) => {
      const hayResenaDuplicada = registros.some(
        (registro) =>
          registro.usuarioId === resena.usuarioId &&
          registro.peliculaId === resena.peliculaId
      );

      if (hayResenaDuplicada) {
        throw new ErrorDominio(
          "RESENA_DUPLICADA",
          "Ya existe una reseña de este usuario para la película.",
          { campo: "peliculaId" }
        );
      }

      registros.push(resena.toJSON());
      return resena;
    });
  }

  /**
   * Busca una reseña por su identificador interno.
   */
  async buscarPorId(id) {
    const registro = this.#store
      .leer(COLECCION)
      .find((candidato) => candidato.id === id);

    return registro ? Resena.fromJSON(registro) : null;
  }

  /**
   * Busca la reseña de un usuario para una película concreta.
   */
  async buscarPorUsuarioYPelicula(usuarioId, peliculaId) {
    const registro = this.#store
      .leer(COLECCION)
      .find(
        (candidato) =>
          candidato.usuarioId === usuarioId &&
          candidato.peliculaId === peliculaId
      );

    return registro ? Resena.fromJSON(registro) : null;
  }

  /**
   * Devuelve las reseñas de una película.
   */
  async listarPorPelicula(peliculaId) {
    return this.#store
      .leer(COLECCION)
      .filter((registro) => registro.peliculaId === peliculaId)
      .map((registro) => Resena.fromJSON(registro));
  }

  /**
   * Devuelve las reseñas escritas por un usuario.
   */
  async listarPorUsuario(usuarioId) {
    return this.#store
      .leer(COLECCION)
      .filter((registro) => registro.usuarioId === usuarioId)
      .map((registro) => Resena.fromJSON(registro));
  }

  /**
   * Devuelve todas las reseñas; el servicio se encarga de ordenarlas y paginarlas.
   */
  async listarTodas() {
    return this.#store
      .leer(COLECCION)
      .map((registro) => Resena.fromJSON(registro));
  }

  /**
   * Reemplaza una reseña existente y devuelve la instancia actualizada.
   */
  async actualizar(resena) {
    return this.#store.actualizar(COLECCION, (registros) => {
      const indice = registros.findIndex(
        (registro) => registro.id === resena.id
      );

      if (indice < 0) {
        return null;
      }

      registros[indice] = resena.toJSON();
      return resena;
    });
  }

  /**
   * Elimina una reseña y devuelve true si existía.
   */
  async eliminar(id) {
    return this.#store.actualizar(COLECCION, (registros) => {
      const indice = registros.findIndex((registro) => registro.id === id);

      if (indice < 0) {
        return false;
      }

      registros.splice(indice, 1);
      return true;
    });
  }
}
