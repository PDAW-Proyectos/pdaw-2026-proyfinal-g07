import { ErrorDominio } from '../utils/ErrorDominio.js';
import { validarId } from '../utils/validaciones.js';

const LONGITUD_MAXIMA_CONSULTA = 100;
const LIMITE_POR_PAGINA = 20;
const MAXIMO_PAGINA_TMDB = 500;

/**
 * Casos de uso del catálogo de películas.
 * Las búsquedas y tendencias pasan por el adaptador de TMDB y dejan una copia
 * normalizada en el catálogo local; el resto de la API usa el id interno.
 */
export class PeliculaService {
  #peliculaRepository;
  #tmdbAdapter;
  #resenaService;

  constructor({ peliculaRepository, tmdbAdapter, resenaService }) {
    this.#peliculaRepository = peliculaRepository;
    this.#tmdbAdapter = tmdbAdapter;
    this.#resenaService = resenaService;
  }

  /**
   * Busca películas por título, las guarda en el catálogo local y devuelve la página.
   */
  async buscar({ q, page = 1 }) {
    const consulta = this.#validarConsulta(q);
    const pagina = this.#validarPagina(page);
    const resultado = await this.#tmdbAdapter.buscar({ q: consulta, page: pagina });

    return this.#guardarColeccion(resultado, pagina);
  }

  /**
   * Devuelve las películas en tendencia y las guarda en el catálogo local.
   */
  async tendencias({ page = 1 } = {}) {
    const pagina = this.#validarPagina(page);
    const resultado = await this.#tmdbAdapter.tendencias({ page: pagina });

    return this.#guardarColeccion(resultado, pagina);
  }

  /**
   * Devuelve la ficha de una película del catálogo local.
   */
  async obtener(peliculaId) {
    const id = validarId(peliculaId, 'peliculaId');
    const pelicula = await this.#peliculaRepository.buscarPorId(id);

    if (!pelicula) {
      throw new ErrorDominio(
        'PELICULA_NO_ENCONTRADA',
        'No existe una película con ese identificador.',
        { campo: 'peliculaId' },
      );
    }

    return pelicula;
  }

  /**
   * Devuelve las reseñas públicas de una película del catálogo local.
   */
  listarResenas(peliculaId, paginacion) {
    return this.#resenaService.listarPorPelicula(validarId(peliculaId, 'peliculaId'), paginacion);
  }

  /**
   * Persiste la página recibida y arma la respuesta de colección del contrato.
   */
  async #guardarColeccion({ peliculas, total }, page) {
    const data = await this.#peliculaRepository.guardarVarias(peliculas);

    return { data, page, limit: LIMITE_POR_PAGINA, total };
  }

  #validarConsulta(valor) {
    if (typeof valor !== 'string' || valor.trim() === '') {
      throw new ErrorDominio(
        'VALIDACION_FALLIDA',
        'El parámetro q es obligatorio y no puede estar vacío.',
        { campo: 'q' },
      );
    }

    const consulta = valor.trim();

    if (consulta.length > LONGITUD_MAXIMA_CONSULTA) {
      throw new ErrorDominio(
        'VALIDACION_FALLIDA',
        `El parámetro q no puede superar los ${LONGITUD_MAXIMA_CONSULTA} caracteres.`,
        { campo: 'q', max: LONGITUD_MAXIMA_CONSULTA },
      );
    }

    return consulta;
  }

  #validarPagina(valor) {
    if (!Number.isInteger(valor) || valor < 1 || valor > MAXIMO_PAGINA_TMDB) {
      throw new ErrorDominio(
        'VALIDACION_FALLIDA',
        `El parámetro page debe ser un entero entre 1 y ${MAXIMO_PAGINA_TMDB}.`,
        { campo: 'page', min: 1, max: MAXIMO_PAGINA_TMDB },
      );
    }

    return valor;
  }
}
