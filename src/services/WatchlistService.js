import { randomUUID } from 'node:crypto';
import { EntradaWatchlist } from '../models/EntradaWatchlist.js';
import { ErrorDominio } from '../utils/ErrorDominio.js';
import { paginar } from '../utils/paginacion.js';
import { validarCuerpo, validarId } from '../utils/validaciones.js';

const CAMPOS_CREACION = new Set(['peliculaId']);

/**
 * Ordena de la más reciente a la más antigua y desempata por id.
 */
function porFechaDescendente(a, b) {
  const diferencia = b.fechaAgregado.getTime() - a.fechaAgregado.getTime();

  return diferencia !== 0 ? diferencia : a.id.localeCompare(b.id);
}

/**
 * Casos de uso de la watchlist privada de un usuario.
 * Toda operación usa el usuario de la sesión y verifica que la película exista.
 */
export class WatchlistService {
  #watchlistRepository;
  #peliculaRepository;
  #ahora;

  constructor({ watchlistRepository, peliculaRepository, ahora = () => new Date() }) {
    this.#watchlistRepository = watchlistRepository;
    this.#peliculaRepository = peliculaRepository;
    this.#ahora = ahora;
  }

  /**
   * Agrega una película a la watchlist del usuario.
   * Si ya estaba, el repositorio responde PELICULA_YA_EN_WATCHLIST.
   */
  async crear(usuarioId, datos) {
    validarCuerpo(datos, CAMPOS_CREACION);

    const peliculaId = validarId(datos.peliculaId, 'peliculaId');
    const pelicula = await this.#buscarPelicula(peliculaId);
    const entrada = new EntradaWatchlist({
      id: randomUUID(),
      usuarioId,
      peliculaId,
      fechaAgregado: this.#ahora(),
    });

    await this.#watchlistRepository.crear(entrada);

    return { entrada, pelicula };
  }

  /**
   * Lista la watchlist del usuario con sus películas, de la más reciente a la más antigua.
   */
  async listar(usuarioId, { page = 1, limit = 20 } = {}) {
    const entradas = await this.#watchlistRepository.listarPorUsuario(usuarioId);

    if (entradas.length === 0) {
      return { data: [], page, limit, total: 0 };
    }

    const peliculas = await this.#peliculaRepository.listar();
    const peliculasPorId = new Map(peliculas.map((pelicula) => [pelicula.id, pelicula]));
    const vigentes = entradas
      .filter((entrada) => peliculasPorId.has(entrada.peliculaId))
      .sort(porFechaDescendente);
    const pagina = paginar(vigentes, { page, limit });

    return {
      ...pagina,
      data: pagina.data.map((entrada) => ({
        entrada,
        pelicula: peliculasPorId.get(entrada.peliculaId),
      })),
    };
  }

  /**
   * Indica si una película está en la watchlist del usuario.
   * No falla cuando la película no existe: la respuesta es simplemente negativa.
   */
  async obtener(usuarioId, peliculaId) {
    const id = validarId(peliculaId, 'peliculaId');
    const entrada = await this.#watchlistRepository.buscarPorUsuarioYPelicula(usuarioId, id);

    if (!entrada) {
      return { entrada: null, pelicula: null };
    }

    const pelicula = await this.#peliculaRepository.buscarPorId(id);

    return pelicula ? { entrada, pelicula } : { entrada: null, pelicula: null };
  }

  /**
   * Quita una película de la watchlist; si no estaba, responde 404.
   */
  async eliminar(usuarioId, peliculaId) {
    const id = validarId(peliculaId, 'peliculaId');
    const eliminada = await this.#watchlistRepository.eliminarPorUsuarioYPelicula(usuarioId, id);

    if (!eliminada) {
      throw new ErrorDominio('NO_ENCONTRADO', 'La película no está en tu watchlist.');
    }
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
}
