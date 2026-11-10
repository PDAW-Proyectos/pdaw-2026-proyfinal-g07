import { randomUUID } from 'node:crypto';
import { Visualizacion } from '../models/Visualizacion.js';
import { ErrorDominio } from '../utils/ErrorDominio.js';
import {
  validarCuerpo,
  validarFechaNoFutura,
  validarId,
  validarPuntuacion,
} from '../utils/validaciones.js';

const CAMPOS_CREACION = new Set(['peliculaId', 'fecha', 'puntuacion']);
const CAMPOS_ACTUALIZACION = new Set(['fecha', 'puntuacion']);
const ORDENES = new Set(['fecha_desc', 'fecha_asc', 'puntuacion_desc']);
const ORDEN_PREDETERMINADO = 'fecha_desc';

/**
 * Ordena visualizaciones; en puntuacion_desc los registros sin puntaje van al final.
 */
function comparar(a, b, orden) {
  if (orden === 'puntuacion_desc') {
    if (a.puntuacion === null && b.puntuacion === null) {
      return 0;
    }

    if (a.puntuacion === null) {
      return 1;
    }

    if (b.puntuacion === null) {
      return -1;
    }

    return b.puntuacion - a.puntuacion;
  }

  if (orden === 'fecha_asc') {
    return a.fecha.localeCompare(b.fecha);
  }

  return b.fecha.localeCompare(a.fecha);
}

/**
 * Casos de uso del historial privado de visualizaciones.
 * Toda operación verifica que el registro pertenezca al usuario de la sesión.
 */
export class VisualizacionService {
  #visualizacionRepository;
  #peliculaRepository;
  #hoy;

  constructor({ visualizacionRepository, peliculaRepository, hoy = () => new Date() }) {
    this.#visualizacionRepository = visualizacionRepository;
    this.#peliculaRepository = peliculaRepository;
    this.#hoy = hoy;
  }

  async crear(usuarioId, datos) {
    validarCuerpo(datos, CAMPOS_CREACION);

    const peliculaId = validarId(datos.peliculaId, 'peliculaId');
    const pelicula = await this.#buscarPelicula(peliculaId);
    const fecha = validarFechaNoFutura(datos.fecha, this.#hoy());
    const puntuacion = validarPuntuacion(datos.puntuacion);

    const visualizacion = new Visualizacion(
      { id: randomUUID(), usuarioId, peliculaId, fecha, puntuacion },
      this.#hoy(),
    );

    await this.#visualizacionRepository.crear(visualizacion);

    return { visualizacion, pelicula };
  }

  async listar(usuarioId, { page = 1, limit = 20, orden = ORDEN_PREDETERMINADO } = {}) {
    const ordenValido = this.#validarOrden(orden);
    const visualizaciones = await this.#visualizacionRepository.listarPorUsuario(usuarioId);

    visualizaciones.sort((a, b) => comparar(a, b, ordenValido));

    const total = visualizaciones.length;
    const inicio = (page - 1) * limit;
    const pagina = visualizaciones.slice(inicio, inicio + limit);

    const data = await Promise.all(
      pagina.map(async (visualizacion) => ({
        visualizacion,
        pelicula: await this.#peliculaRepository.buscarPorId(visualizacion.peliculaId),
      })),
    );

    return { data, page, limit, total };
  }

  async obtener(usuarioId, id) {
    const visualizacion = await this.#buscarPropia(usuarioId, id);
    const pelicula = await this.#peliculaRepository.buscarPorId(visualizacion.peliculaId);

    return { visualizacion, pelicula };
  }

  async actualizar(usuarioId, id, datos) {
    validarCuerpo(datos, CAMPOS_ACTUALIZACION);

    const visualizacion = await this.#buscarPropia(usuarioId, id);

    if (Object.hasOwn(datos, 'fecha')) {
      visualizacion.cambiarFecha(datos.fecha, this.#hoy());
    }

    if (Object.hasOwn(datos, 'puntuacion')) {
      visualizacion.cambiarPuntuacion(datos.puntuacion);
    }

    await this.#visualizacionRepository.actualizar(visualizacion);

    const pelicula = await this.#peliculaRepository.buscarPorId(visualizacion.peliculaId);

    return { visualizacion, pelicula };
  }

  async eliminar(usuarioId, id) {
    await this.#buscarPropia(usuarioId, id);
    await this.#visualizacionRepository.eliminar(id);
  }

  /**
   * Devuelve la visualización solo si pertenece al usuario; si no, 404.
   */
  async #buscarPropia(usuarioId, id) {
    const visualizacion = await this.#visualizacionRepository.buscarPorId(id);

    if (!visualizacion || visualizacion.usuarioId !== usuarioId) {
      throw new ErrorDominio('NO_ENCONTRADO', 'La visualización no existe.');
    }

    return visualizacion;
  }

  /**
   * Verifica que la película exista en el catálogo local.
   */
  async #buscarPelicula(peliculaId) {
    const pelicula = await this.#peliculaRepository.buscarPorId(peliculaId);

    if (!pelicula) {
      throw new ErrorDominio(
        'PELICULA_NO_ENCONTRADA',
        'No existe una película con ese identificador.',
        { campo: 'peliculaId' },
      );
    }

    return pelicula;
  }

  #validarOrden(orden) {
    if (!ORDENES.has(orden)) {
      throw new ErrorDominio('VALIDACION_FALLIDA', 'El orden solicitado no es válido.', {
        campo: 'orden',
      });
    }

    return orden;
  }
}
