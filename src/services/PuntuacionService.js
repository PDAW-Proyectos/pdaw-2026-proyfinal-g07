import { validarPuntuacion } from '../utils/validaciones.js';

export class PuntuacionService {
  #resenaRepository;
  #visualizacionRepository;

  constructor({ resenaRepository, visualizacionRepository }) {
    this.#resenaRepository = resenaRepository;
    this.#visualizacionRepository = visualizacionRepository;
  }

  async obtenerPuntuacionDeResena(usuarioId, peliculaId) {
    const resena = await this.#resenaRepository.buscarPorUsuarioYPelicula(usuarioId, peliculaId);

    return resena?.puntuacion ?? null;
  }

  async obtenerPuntuacionDeVisualizacion(usuarioId, peliculaId) {
    const visualizacion = await this.#visualizacionRepository.buscarUltimaPorUsuarioYPelicula(
      usuarioId,
      peliculaId,
    );

    return visualizacion?.puntuacion ?? null;
  }

  /**
   * Devuelve la nota vigente de cada película para un usuario.
   * La reseña puntuada tiene prioridad sobre la última visualización.
   */
  async puntuacionesDeUsuario(usuarioId) {
    const [resenas, visualizaciones] = await Promise.all([
      this.#resenaRepository.listarPorUsuario(usuarioId),
      this.#visualizacionRepository.listarPorUsuario(usuarioId),
    ]);
    const puntuaciones = new Map();
    const ultimasVisualizaciones = new Map();

    for (const resena of resenas) {
      if (resena.puntuacion !== null) {
        puntuaciones.set(resena.peliculaId, resena.puntuacion);
      }
    }

    for (const visualizacion of visualizaciones) {
      const actual = ultimasVisualizaciones.get(visualizacion.peliculaId);

      if (!actual || visualizacion.fecha >= actual.fecha) {
        ultimasVisualizaciones.set(visualizacion.peliculaId, visualizacion);
      }
    }

    for (const [peliculaId, visualizacion] of ultimasVisualizaciones) {
      if (visualizacion.puntuacion !== null && !puntuaciones.has(peliculaId)) {
        puntuaciones.set(peliculaId, visualizacion.puntuacion);
      }
    }

    return puntuaciones;
  }

  async sincronizarResena(usuarioId, peliculaId, puntuacion) {
    const valor = validarPuntuacion(puntuacion);
    const resena = await this.#resenaRepository.buscarPorUsuarioYPelicula(usuarioId, peliculaId);

    if (!resena || resena.puntuacion === valor) {
      return resena;
    }

    resena.cambiarPuntuacion(valor);
    await this.#resenaRepository.actualizar(resena);

    return resena;
  }

  async sincronizarVisualizacion(usuarioId, peliculaId, puntuacion) {
    const valor = validarPuntuacion(puntuacion);
    const visualizacion = await this.#visualizacionRepository.buscarUltimaPorUsuarioYPelicula(
      usuarioId,
      peliculaId,
    );

    if (!visualizacion || visualizacion.puntuacion === valor) {
      return visualizacion;
    }

    visualizacion.cambiarPuntuacion(valor);
    await this.#visualizacionRepository.actualizar(visualizacion);

    return visualizacion;
  }

  async promedioPorPelicula(peliculaId) {
    const [resenas, visualizaciones] = await Promise.all([
      this.#resenaRepository.listarPorPelicula(peliculaId),
      this.#visualizacionRepository.listarPorPelicula(peliculaId),
    ]);
    const puntuaciones = new Map();
    const ultimasVisualizaciones = new Map();

    for (const resena of resenas) {
      if (resena.puntuacion !== null) {
        puntuaciones.set(resena.usuarioId, resena.puntuacion);
      }
    }

    for (const visualizacion of visualizaciones) {
      const actual = ultimasVisualizaciones.get(visualizacion.usuarioId);

      if (!actual || visualizacion.fecha >= actual.fecha) {
        ultimasVisualizaciones.set(visualizacion.usuarioId, visualizacion);
      }
    }

    for (const [usuarioId, visualizacion] of ultimasVisualizaciones) {
      if (visualizacion.puntuacion !== null && !puntuaciones.has(usuarioId)) {
        puntuaciones.set(usuarioId, visualizacion.puntuacion);
      }
    }

    const valores = [...puntuaciones.values()];

    if (valores.length === 0) {
      return { promedioPuntuacion: null, totalPuntuaciones: 0 };
    }

    const suma = valores.reduce((total, puntuacion) => total + puntuacion, 0);

    return {
      promedioPuntuacion: Math.round((suma / valores.length) * 10) / 10,
      totalPuntuaciones: valores.length,
    };
  }
}
