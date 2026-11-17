const PUNTUACION_MINIMA = 1;
const PUNTUACION_MAXIMA = 5;

export class EstadisticaService {
  #visualizacionRepository;
  #resenaRepository;

  constructor({ visualizacionRepository, resenaRepository }) {
    this.#visualizacionRepository = visualizacionRepository;
    this.#resenaRepository = resenaRepository;
  }

  async obtener(usuarioId) {
    const [visualizaciones, resenas] = await Promise.all([
      this.#visualizacionRepository.listarPorUsuario(usuarioId),
      this.#resenaRepository.listarPorUsuario(usuarioId),
    ]);
    const peliculas = new Set(visualizaciones.map(({ peliculaId }) => peliculaId));
    const puntuaciones = this.#puntuacionesVigentes(visualizaciones, resenas);
    const distribucionPuntuacion = this.#distribucionVacia();
    let sumaPuntuaciones = 0;

    for (const puntuacion of puntuaciones.values()) {
      distribucionPuntuacion[String(puntuacion)] += 1;
      sumaPuntuaciones += puntuacion;
    }

    return {
      totalVisualizaciones: visualizaciones.length,
      peliculasUnicas: peliculas.size,
      promedioPuntuacion:
        puntuaciones.size === 0
          ? null
          : Math.round((sumaPuntuaciones / puntuaciones.size) * 10) / 10,
      totalResenas: resenas.length,
      distribucionPuntuacion,
    };
  }

  #puntuacionesVigentes(visualizaciones, resenas) {
    const ultimasVisualizaciones = new Map();
    const puntuaciones = new Map();

    for (const visualizacion of visualizaciones) {
      const actual = ultimasVisualizaciones.get(visualizacion.peliculaId);

      if (!actual || visualizacion.fecha >= actual.fecha) {
        ultimasVisualizaciones.set(visualizacion.peliculaId, visualizacion);
      }
    }

    for (const resena of resenas) {
      if (resena.puntuacion !== null) {
        puntuaciones.set(resena.peliculaId, resena.puntuacion);
      }
    }

    for (const [peliculaId, visualizacion] of ultimasVisualizaciones) {
      if (visualizacion.puntuacion !== null && !puntuaciones.has(peliculaId)) {
        puntuaciones.set(peliculaId, visualizacion.puntuacion);
      }
    }

    return puntuaciones;
  }

  #distribucionVacia() {
    const distribucion = {};

    for (let valor = PUNTUACION_MINIMA; valor <= PUNTUACION_MAXIMA; valor += 1) {
      distribucion[String(valor)] = 0;
    }

    return distribucion;
  }
}
