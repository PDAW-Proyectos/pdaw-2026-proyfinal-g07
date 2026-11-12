import { Visualizacion } from '../models/Visualizacion.js';

const COLECCION = 'visualizaciones';

/**
 * Repositorio de visualizaciones privadas.
 */
export class VisualizacionRepository {
  #store;

  /**
   * Recibe el store que provee las colecciones.
   */
  constructor({ store }) {
    this.#store = store;
  }

  /**
   * Guarda una visualización nueva.
   */
  async crear(visualizacion) {
    return this.#store.actualizar(COLECCION, (registros) => {
      registros.push(visualizacion.toJSON());
      return visualizacion;
    });
  }

  /**
   * Busca una visualización por su identificador interno.
   */
  async buscarPorId(id) {
    const registro = this.#store.leer(COLECCION).find((candidato) => candidato.id === id);

    return registro ? Visualizacion.fromJSON(registro) : null;
  }

  /**
   * Devuelve todas las visualizaciones de un usuario.
   */
  async listarPorUsuario(usuarioId) {
    return this.#store
      .leer(COLECCION)
      .filter((registro) => registro.usuarioId === usuarioId)
      .map((registro) => Visualizacion.fromJSON(registro));
  }

  /**
   * Reemplaza una visualización existente y devuelve la instancia actualizada.
   */
  async actualizar(visualizacion) {
    return this.#store.actualizar(COLECCION, (registros) => {
      const indice = registros.findIndex((registro) => registro.id === visualizacion.id);

      if (indice < 0) {
        return null;
      }

      registros[indice] = visualizacion.toJSON();
      return visualizacion;
    });
  }

  /**
   * Elimina una visualización y devuelve true si existía.
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

  /**
   * Elimina todas las visualizaciones de un usuario y devuelve cuántas borró.
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
