import { randomUUID } from 'node:crypto';
import { Pelicula } from '../models/Pelicula.js';
import { ErrorDominio } from '../utils/ErrorDominio.js';

const IDIOMA = 'es-AR';
const LIMITE_TIEMPO_MS = 8000;
const RUTA_GENEROS = '/genre/movie/list';
const BASE_PREDETERMINADA = 'https://api.themoviedb.org/3';
const ANIO_MINIMO = 1800;
const ANIO_MAXIMO = 2100;

/**
 * Extrae el año de una fecha `YYYY-MM-DD`. Devuelve null si falta o está fuera de rango.
 */
function leerAnioEstreno(fecha) {
  const anio = Number((fecha ?? '').slice(0, 4));

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
    const peliculas = (datos.results ?? [])
      .map((resultado) => this.#aPelicula(resultado, generos))
      .filter(Boolean);

    return {
      peliculas,
      page: Number(datos.page) || 1,
      total: Number(datos.total_results) || peliculas.length,
    };
  }

  #aPelicula(datos, generos) {
    const titulo = datos.title?.trim() || datos.original_title?.trim();
    const anio = leerAnioEstreno(datos.release_date);

    if (!titulo || !Number.isInteger(datos.id) || anio === null) {
      return null;
    }

    return new Pelicula({
      id: randomUUID(),
      tmdbId: datos.id,
      titulo,
      sinopsis: datos.overview ?? '',
      anioEstreno: anio,
      generos: (datos.genre_ids ?? []).map((id) => generos.get(id)).filter(Boolean),
      rutaPoster: datos.poster_path ?? null,
    });
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

      this.#generos = new Map((datos.genres ?? []).map((genero) => [genero.id, genero.name]));
    } catch {
      this.#generos = new Map();
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
