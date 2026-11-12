import { ErrorDominio } from '../utils/ErrorDominio.js';
import { validarId } from '../utils/validaciones.js';

const LONGITUD_MAXIMA_CONSULTA = 100;
const LIMITE_POR_PAGINA = 20;
const MAXIMO_PAGINA_TMDB = 500;
const TTL_BUSQUEDA_MS = 60 * 1000;
const TTL_TENDENCIAS_MS = 5 * 60 * 1000;
const MAX_ENTRADAS_CACHE = 200;

/**
 * Casos de uso del catálogo de películas.
 * Las búsquedas y tendencias pasan por el adaptador de TMDB y dejan una copia
 * normalizada en el catálogo local; el resto de la API usa el id interno.
 * Las respuestas se cachean en memoria unos minutos para no saturar TMDB.
 */
export class PeliculaService {
  #peliculaRepository;
  #tmdbAdapter;
  #resenaService;
  #ahora;
  #cache = new Map();

  constructor({ peliculaRepository, tmdbAdapter, resenaService, ahora = () => new Date() }) {
    this.#peliculaRepository = peliculaRepository;
    this.#tmdbAdapter = tmdbAdapter;
    this.#resenaService = resenaService;
    this.#ahora = ahora;
  }

  /**
   * Busca películas por título, las guarda en el catálogo local y devuelve la página.
   */
  async buscar({ q, page = 1 }) {
    const consulta = this.#validarConsulta(q);
    const pagina = this.#validarPagina(page);
    const clave = `buscar:${consulta.toLowerCase()}:${pagina}`;
    const cacheada = this.#leerCache(clave);

    if (cacheada) {
      return cacheada;
    }

    const resultado = await this.#tmdbAdapter.buscar({ q: consulta, page: pagina });
    const coleccion = await this.#guardarColeccion(resultado, pagina);

    return this.#guardarCache(clave, coleccion, TTL_BUSQUEDA_MS);
  }

  /**
   * Devuelve las películas en tendencia y las guarda en el catálogo local.
   */
  async tendencias({ page = 1 } = {}) {
    const pagina = this.#validarPagina(page);
    const clave = `tendencias:${pagina}`;
    const cacheada = this.#leerCache(clave);

    if (cacheada) {
      return cacheada;
    }

    const resultado = await this.#tmdbAdapter.tendencias({ page: pagina });
    const coleccion = await this.#guardarColeccion(resultado, pagina);

    return this.#guardarCache(clave, coleccion, TTL_TENDENCIAS_MS);
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

  #leerCache(clave) {
    const entrada = this.#cache.get(clave);

    if (!entrada) {
      return null;
    }

    if (entrada.expira <= this.#ahora().getTime()) {
      this.#cache.delete(clave);
      return null;
    }

    return entrada.coleccion;
  }

  #guardarCache(clave, coleccion, ttlMs) {
    this.#cache.set(clave, { coleccion, expira: this.#ahora().getTime() + ttlMs });
    this.#podarCache();

    return coleccion;
  }

  /**
   * Mantiene el cache acotado: descarta las entradas vencidas y, si sigue lleno,
   * elimina las más antiguas.
   */
  #podarCache() {
    if (this.#cache.size <= MAX_ENTRADAS_CACHE) {
      return;
    }

    const instante = this.#ahora().getTime();

    for (const [clave, entrada] of this.#cache) {
      if (entrada.expira <= instante) {
        this.#cache.delete(clave);
      }
    }

    while (this.#cache.size > MAX_ENTRADAS_CACHE) {
      this.#cache.delete(this.#cache.keys().next().value);
    }
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
