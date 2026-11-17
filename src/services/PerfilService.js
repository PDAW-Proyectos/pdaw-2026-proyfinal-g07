import { ErrorDominio } from '../utils/ErrorDominio.js';
import { validarCuerpo, validarFavoritas } from '../utils/validaciones.js';

const CANTIDAD_MEJOR_PUNTUADAS = 6;
const MINIMO_AFINIDAD = 3;
const PUNTUACION_MINIMA = 1;
const PUNTUACION_MAXIMA = 5;
const DIFERENCIA_MAXIMA = PUNTUACION_MAXIMA - PUNTUACION_MINIMA;
const PESO_PUNTUACIONES = 0.7;
const PESO_FAVORITAS = 0.3;
const CAMPOS_FAVORITAS = new Set(['favoritas']);

function porFechaDescendente(a, b) {
  return b.fechaPublicacion.getTime() - a.fechaPublicacion.getTime();
}

/**
 * Datos públicos de un usuario y afinidad agregada con el visitante.
 * Nunca expone visualizaciones, watchlist, email ni hash.
 */
export class PerfilService {
  #usuarioRepository;
  #resenaRepository;
  #peliculaRepository;
  #puntuacionService;

  constructor({ usuarioRepository, resenaRepository, peliculaRepository, puntuacionService }) {
    this.#usuarioRepository = usuarioRepository;
    this.#resenaRepository = resenaRepository;
    this.#peliculaRepository = peliculaRepository;
    this.#puntuacionService = puntuacionService;
  }

  /**
   * Devuelve el perfil público de un usuario. La afinidad solo se calcula cuando
   * hay un visitante autenticado distinto del dueño del perfil.
   */
  async obtenerPerfilPublico(usuarioId, { visitanteId = null } = {}) {
    const usuario = await this.#buscarUsuario(usuarioId);
    const resenas = await this.#resenaRepository.listarPorUsuario(usuario.id);
    const estadisticas = this.#calcularEstadisticas(resenas);
    const favoritas = await this.#resolverFavoritas(usuario.favoritas);
    const mejorPuntuadas = await this.#seleccionarMejorPuntuadas(resenas);
    const afinidad = await this.#calcularAfinidad(usuario, visitanteId);

    return { usuario, estadisticas, favoritas, mejorPuntuadas, afinidad };
  }

  /**
   * Reemplaza la selección de hasta cinco favoritas del usuario.
   */
  async actualizarFavoritas(usuarioId, datos) {
    validarCuerpo(datos, CAMPOS_FAVORITAS);

    const favoritas = validarFavoritas(datos.favoritas);
    const usuario = await this.#buscarUsuario(usuarioId);
    const peliculas = await this.#resolverFavoritas(favoritas, { estricto: true });
    const actualizado = await this.#usuarioRepository.actualizar(usuario.conFavoritas(favoritas));

    return { usuario: actualizado, favoritas: peliculas };
  }

  #calcularEstadisticas(resenas) {
    const distribucionPuntuacion = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    const peliculas = new Set();
    let suma = 0;
    let totalPuntuadas = 0;

    for (const resena of resenas) {
      peliculas.add(resena.peliculaId);

      if (Number.isInteger(resena.puntuacion)) {
        distribucionPuntuacion[resena.puntuacion] += 1;
        suma += resena.puntuacion;
        totalPuntuadas += 1;
      }
    }

    return {
      totalResenas: resenas.length,
      peliculasResenadas: peliculas.size,
      totalPuntuadas,
      promedioPuntuacion:
        totalPuntuadas === 0 ? null : Math.round((suma / totalPuntuadas) * 10) / 10,
      distribucionPuntuacion,
    };
  }

  /**
   * Elige hasta seis películas puntuadas, priorizando la nota más alta y,
   * en caso de empate, la reseña más reciente.
   */
  async #seleccionarMejorPuntuadas(resenas) {
    const porPelicula = new Map();

    for (const resena of resenas) {
      if (!Number.isInteger(resena.puntuacion)) {
        continue;
      }

      const actual = porPelicula.get(resena.peliculaId);
      const esMejor =
        !actual ||
        resena.puntuacion > actual.puntuacion ||
        (resena.puntuacion === actual.puntuacion &&
          resena.fechaPublicacion.getTime() > actual.fechaPublicacion.getTime());

      if (esMejor) {
        porPelicula.set(resena.peliculaId, resena);
      }
    }

    const seleccionadas = [...porPelicula.values()]
      .sort((a, b) => b.puntuacion - a.puntuacion || porFechaDescendente(a, b))
      .slice(0, CANTIDAD_MEJOR_PUNTUADAS);

    if (seleccionadas.length === 0) {
      return [];
    }

    const peliculas = await this.#peliculaRepository.listar();
    const peliculasPorId = new Map(peliculas.map((pelicula) => [pelicula.id, pelicula]));

    return seleccionadas
      .map((resena) => ({
        pelicula: peliculasPorId.get(resena.peliculaId),
        puntuacion: resena.puntuacion,
      }))
      .filter(({ pelicula }) => pelicula !== undefined);
  }

  /**
   * Calcula la afinidad con las notas en común y la intersección de favoritas.
   * Las notas exigen un mínimo de coincidencias para no revelar una nota privada;
   * las favoritas son datos públicos y pueden aportar afinidad por sí solas.
   */
  async #calcularAfinidad(propietario, visitanteId) {
    if (!visitanteId || visitanteId === propietario.id) {
      return null;
    }

    const visitante = await this.#usuarioRepository.buscarPorId(visitanteId);

    if (!visitante) {
      return null;
    }

    const [puntuacionesVisitante, puntuacionesPropietario] = await Promise.all([
      this.#puntuacionService.puntuacionesDeUsuario(visitante.id),
      this.#puntuacionService.puntuacionesDeUsuario(propietario.id),
    ]);
    const puntuaciones = this.#compararPuntuaciones(puntuacionesPropietario, puntuacionesVisitante);
    const favoritas = this.#compararFavoritas(propietario.favoritas, visitante.favoritas);

    return {
      porcentaje: this.#combinarPorcentajes(puntuaciones.porcentaje, favoritas.porcentaje),
      peliculasEnComun: puntuaciones.peliculasEnComun,
      coincidencias: puntuaciones.porcentaje === null ? null : puntuaciones.coincidencias,
      minimoRequerido: MINIMO_AFINIDAD,
      favoritasEnComun: favoritas.enComun,
      porcentajePuntuaciones: puntuaciones.porcentaje,
      porcentajeFavoritas: favoritas.porcentaje,
    };
  }

  #compararPuntuaciones(puntuacionesPropietario, puntuacionesVisitante) {
    let peliculasEnComun = 0;
    let sumaDiferencias = 0;
    let coincidencias = 0;

    for (const [peliculaId, puntuacionPropietario] of puntuacionesPropietario) {
      const puntuacionVisitante = puntuacionesVisitante.get(peliculaId);

      if (puntuacionVisitante === undefined) {
        continue;
      }

      peliculasEnComun += 1;
      sumaDiferencias += Math.abs(puntuacionPropietario - puntuacionVisitante);

      if (puntuacionPropietario === puntuacionVisitante) {
        coincidencias += 1;
      }
    }

    return {
      peliculasEnComun,
      coincidencias,
      porcentaje:
        peliculasEnComun < MINIMO_AFINIDAD
          ? null
          : Math.round((1 - sumaDiferencias / (peliculasEnComun * DIFERENCIA_MAXIMA)) * 100),
    };
  }

  #compararFavoritas(favoritasPropietario, favoritasVisitante) {
    const conjuntoVisitante = new Set(favoritasVisitante);
    const enComun = favoritasPropietario.filter((peliculaId) =>
      conjuntoVisitante.has(peliculaId),
    ).length;
    const consideradas = Math.min(favoritasPropietario.length, conjuntoVisitante.size);

    return {
      enComun,
      porcentaje: consideradas === 0 ? null : Math.round((enComun / consideradas) * 100),
    };
  }

  #combinarPorcentajes(porcentajePuntuaciones, porcentajeFavoritas) {
    const componentes = [];

    if (porcentajePuntuaciones !== null) {
      componentes.push({ valor: porcentajePuntuaciones, peso: PESO_PUNTUACIONES });
    }

    if (porcentajeFavoritas !== null) {
      componentes.push({ valor: porcentajeFavoritas, peso: PESO_FAVORITAS });
    }

    const pesoTotal = componentes.reduce((total, componente) => total + componente.peso, 0);

    if (pesoTotal === 0) {
      return null;
    }

    return Math.round(
      componentes.reduce((total, componente) => total + componente.valor * componente.peso, 0) /
        pesoTotal,
    );
  }

  async #resolverFavoritas(ids, { estricto = false } = {}) {
    if (ids.length === 0) {
      return [];
    }

    const peliculas = await this.#peliculaRepository.listar();
    const peliculasPorId = new Map(peliculas.map((pelicula) => [pelicula.id, pelicula]));
    const favoritas = [];

    for (const id of ids) {
      const pelicula = peliculasPorId.get(id);

      if (!pelicula) {
        if (estricto) {
          throw new ErrorDominio(
            'PELICULA_NO_ENCONTRADA',
            'Una de las películas favoritas no existe.',
            { campo: 'favoritas' },
          );
        }

        continue;
      }

      favoritas.push(pelicula);
    }

    return favoritas;
  }

  async #buscarUsuario(usuarioId) {
    const usuario = await this.#usuarioRepository.buscarPorId(usuarioId);

    if (!usuario) {
      throw new ErrorDominio('NO_ENCONTRADO', 'El usuario no existe.');
    }

    return usuario;
  }
}
