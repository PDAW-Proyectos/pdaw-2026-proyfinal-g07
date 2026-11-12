import { randomUUID } from 'node:crypto';
import { Pelicula } from '../models/Pelicula.js';
import { ErrorDominio } from '../utils/ErrorDominio.js';

const IDIOMA = 'es-AR';
const LIMITE_TIEMPO_MS = 8000;
const RUTA_GENEROS = '/genre/movie/list';
const BASE_PREDETERMINADA = 'https://api.themoviedb.org/3';
const ANIO_MINIMO = 1800;
const ANIO_MAXIMO = 2100;
const LONGITUD_MAXIMA_TITULO = 500;
const LONGITUD_MAXIMA_SINOPSIS = 5000;
const LONGITUD_MAXIMA_IMAGEN = 500;

/**
 * Extrae el año de una fecha `YYYY-MM-DD`. Devuelve null si falta o está fuera de rango.
 */
function leerAnioEstreno(fecha) {
  if (typeof fecha !== 'string') {
    return null;
  }

  const anio = Number(fecha.slice(0, 4));

  if (!Number.isInteger(anio) || anio < ANIO_MINIMO || anio > ANIO_MAXIMO) {
    return null;
  }

  return anio;
}

/**
 * Adaptador de TMDB: traduce sus respuestas al modelo Pelicula del catálogo local
 * y normaliza los fallos del proveedor como TMDB_NO_DISPONIBLE.
 * La API key solo vive en el servidor y nunca se incluye en los mensajes de error.
 */
export class TMDBAdapter {
  #apiKey;
  #baseUrl;
  #fetch;
  #limiteTiempoMs;
  #generos = null;

  /**
   * `fetchImpl` permite inyectar un cliente HTTP falso en las pruebas.
   */
  constructor({
    apiKey,
    baseUrl = BASE_PREDETERMINADA,
    fetchImpl = globalThis.fetch,
    limiteTiempoMs = LIMITE_TIEMPO_MS,
  } = {}) {
    this.#apiKey = apiKey;
    this.#baseUrl = baseUrl;
    this.#fetch = fetchImpl;
    this.#limiteTiempoMs = limiteTiempoMs;
  }

  /**
   * Busca películas por título y devuelve la página normalizada.
   */
  async buscar({ q, page = 1 }) {
    const datos = await this.#pedir('/search/movie', {
      query: q,
      page,
      include_adult: 'false',
    });

    return this.#aColeccion(datos);
  }

  /**
   * Devuelve las películas en tendencia de la semana.
   */
  async tendencias({ page = 1 } = {}) {
    const datos = await this.#pedir('/trending/movie/week', { page });

    return this.#aColeccion(datos);
  }

  /**
   * Convierte la respuesta de TMDB en Peliculas, descartando las que no se pueden
   * normalizar (por ejemplo, estrenos sin fecha).
   */
  async #aColeccion(datos) {
    const generos = await this.#mapaGeneros();
    const resultados = Array.isArray(datos.results) ? datos.results : [];
    const peliculas = resultados
      .map((resultado) => this.#aPelicula(resultado, generos))
      .filter(Boolean);

    return {
      peliculas,
      page: Number(datos.page) || 1,
      total: Number(datos.total_results) || peliculas.length,
    };
  }

  #aPelicula(datos, generos) {
    try {
      const titulo = this.#leerTitulo(datos);

      if (!titulo || !Number.isInteger(datos.id)) {
        return null;
      }

      const anio = leerAnioEstreno(datos.release_date);

      if (anio === null) {
        return null;
      }

      return new Pelicula({
        id: randomUUID(),
        tmdbId: datos.id,
        titulo,
        sinopsis: this.#leerSinopsis(datos.overview),
        anioEstreno: anio,
        generos: this.#nombresDeGeneros(datos.genre_ids, generos),
        rutaPoster: this.#leerImagen(datos.poster_path),
        rutaBackdrop: this.#leerImagen(datos.backdrop_path),
      });
    } catch {
      // Un ítem con datos inesperados se descarta; no debe romper la página entera.
      return null;
    }
  }

  #leerTitulo(datos) {
    const titulo = typeof datos.title === 'string' ? datos.title.trim() : '';
    const alternativo = typeof datos.original_title === 'string' ? datos.original_title.trim() : '';

    return (titulo || alternativo).slice(0, LONGITUD_MAXIMA_TITULO);
  }

  #leerSinopsis(valor) {
    return typeof valor === 'string' ? valor.slice(0, LONGITUD_MAXIMA_SINOPSIS) : '';
  }

  #leerImagen(valor) {
    return typeof valor === 'string' && valor.length > 0 && valor.length <= LONGITUD_MAXIMA_IMAGEN
      ? valor
      : null;
  }

  #nombresDeGeneros(ids, generos) {
    if (!Array.isArray(ids)) {
      return [];
    }

    return ids.map((id) => generos.get(id)).filter(Boolean);
  }

  /**
   * Traduce los genre_ids de TMDB a nombres. La lista se pide una sola vez por proceso;
   * si falla, las películas se guardan sin géneros en lugar de romper la búsqueda.
   */
  async #mapaGeneros() {
    if (this.#generos) {
      return this.#generos;
    }

    try {
      const datos = await this.#pedir(RUTA_GENEROS);
      const lista = Array.isArray(datos.genres) ? datos.genres : [];

      this.#generos = new Map(
        lista
          .filter((genero) => Number.isInteger(genero?.id) && typeof genero?.name === 'string')
          .map((genero) => [genero.id, genero.name]),
      );
    } catch {
      // No se cachea el fallo: el próximo pedido vuelve a intentar la lista.
      return new Map();
    }

    return this.#generos;
  }

  /**
   * Hace la petición a TMDB y devuelve el JSON. Cualquier fallo se normaliza
   * para no filtrar la URL ni la API key al cliente.
   */
  async #pedir(ruta, parametros = {}) {
    if (!this.#apiKey) {
      throw new ErrorDominio(
        'TMDB_NO_DISPONIBLE',
        'Falta configurar la API key de TMDB en el servidor.',
      );
    }

    const url = new URL(`${this.#baseUrl}${ruta}`);

    url.searchParams.set('api_key', this.#apiKey);
    url.searchParams.set('language', IDIOMA);

    for (const [clave, valor] of Object.entries(parametros)) {
      if (valor !== undefined && valor !== null) {
        url.searchParams.set(clave, String(valor));
      }
    }

    const fetchImpl = this.#fetch;
    let respuesta;

    try {
      respuesta = await fetchImpl(url, { signal: AbortSignal.timeout(this.#limiteTiempoMs) });
    } catch {
      throw new ErrorDominio('TMDB_NO_DISPONIBLE', 'No se pudo contactar a TMDB.');
    }

    if (!respuesta.ok) {
      throw new ErrorDominio(
        'TMDB_NO_DISPONIBLE',
        `TMDB respondió con un error (HTTP ${respuesta.status}).`,
      );
    }

    try {
      return await respuesta.json();
    } catch {
      throw new ErrorDominio(
        'TMDB_NO_DISPONIBLE',
        'TMDB devolvió una respuesta que no se pudo interpretar.',
      );
    }
  }
}
