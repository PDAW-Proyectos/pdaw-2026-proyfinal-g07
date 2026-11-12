import { describe, expect, test } from '@jest/globals';
import { TMDBAdapter } from '../../src/integrations/TMDBAdapter.js';

function respuestaJson(cuerpo, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => cuerpo,
  };
}

/**
 * Ruta pedida a la API, sin el prefijo `/3` de la versión.
 */
function rutaDe(url) {
  return new URL(url).pathname.replace(/^\/3(?=\/)/, '');
}

/**
 * Cliente HTTP falso: responde según la ruta pedida y registra las URLs recibidas.
 */
function crearFetchFalso(respuestas) {
  const llamadas = [];
  const fetchFalso = async (url) => {
    const ruta = rutaDe(url);

    llamadas.push(String(url));

    if (!(ruta in respuestas)) {
      throw new Error(`Ruta inesperada: ${ruta}`);
    }

    return respuestas[ruta];
  };

  return { fetchFalso, llamadas };
}

const GENEROS = respuestaJson({
  genres: [
    { id: 28, name: 'Acción' },
    { id: 878, name: 'Ciencia ficción' },
  ],
});

const BUSQUEDA = respuestaJson({
  page: 2,
  total_results: 1,
  results: [
    {
      id: 603,
      title: '  Matrix  ',
      overview: 'Un programador descubre la verdadera naturaleza de su realidad.',
      release_date: '1999-03-31',
      poster_path: '/matrix.jpg',
      genre_ids: [28, 878, 999],
    },
    {
      id: 604,
      title: 'Estreno sin fecha',
      overview: '',
      release_date: '',
      poster_path: null,
      genre_ids: [],
    },
  ],
});

describe('TMDBAdapter', () => {
  test('normaliza la búsqueda, mapea géneros y descarta películas sin fecha', async () => {
    const { fetchFalso, llamadas } = crearFetchFalso({
      '/search/movie': BUSQUEDA,
      '/genre/movie/list': GENEROS,
    });
    const adaptador = new TMDBAdapter({ apiKey: 'clave-de-prueba', fetchImpl: fetchFalso });

    const resultado = await adaptador.buscar({ q: 'matrix', page: 2 });

    expect(resultado.page).toBe(2);
    expect(resultado.total).toBe(1);
    expect(resultado.peliculas).toHaveLength(1);

    const [pelicula] = resultado.peliculas;

    expect(pelicula.toJSON()).toMatchObject({
      tmdbId: 603,
      titulo: 'Matrix',
      sinopsis: 'Un programador descubre la verdadera naturaleza de su realidad.',
      anioEstreno: 1999,
      generos: ['Acción', 'Ciencia ficción'],
      rutaPoster: '/matrix.jpg',
    });
    expect(pelicula.id).toMatch(/^[0-9a-f-]{36}$/);

    const url = new URL(llamadas[0]);
    expect(rutaDe(llamadas[0])).toBe('/search/movie');
    expect(url.searchParams.get('api_key')).toBe('clave-de-prueba');
    expect(url.searchParams.get('language')).toBe('es-AR');
    expect(url.searchParams.get('query')).toBe('matrix');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('include_adult')).toBe('false');
  });

  test('usa el endpoint de tendencias y reutiliza la lista de géneros', async () => {
    const { fetchFalso, llamadas } = crearFetchFalso({
      '/trending/movie/week': respuestaJson({ page: 3, total_results: 1, results: [] }),
      '/search/movie': BUSQUEDA,
      '/genre/movie/list': GENEROS,
    });
    const adaptador = new TMDBAdapter({ apiKey: 'clave', fetchImpl: fetchFalso });

    await adaptador.buscar({ q: 'matrix' });
    await adaptador.tendencias({ page: 3 });

    const generosPedidos = llamadas.filter((url) => rutaDe(url) === '/genre/movie/list');

    expect(generosPedidos).toHaveLength(1);
    expect(rutaDe(llamadas[2])).toBe('/trending/movie/week');
    expect(new URL(llamadas[2]).searchParams.get('page')).toBe('3');
  });

  test('normaliza un error HTTP de TMDB sin exponer la API key', async () => {
    const { fetchFalso } = crearFetchFalso({
      '/search/movie': respuestaJson({}, { ok: false, status: 401 }),
    });
    const adaptador = new TMDBAdapter({ apiKey: 'clave-secreta', fetchImpl: fetchFalso });

    await expect(adaptador.buscar({ q: 'matrix' })).rejects.toMatchObject({
      codigo: 'TMDB_NO_DISPONIBLE',
      message: 'TMDB respondió con un error (HTTP 401).',
    });
    await expect(adaptador.buscar({ q: 'matrix' })).rejects.not.toThrow(/clave-secreta/);
  });

  test('normaliza un fallo de red', async () => {
    const adaptador = new TMDBAdapter({
      apiKey: 'clave',
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    });

    await expect(adaptador.buscar({ q: 'matrix' })).rejects.toMatchObject({
      codigo: 'TMDB_NO_DISPONIBLE',
      message: 'No se pudo contactar a TMDB.',
    });
  });

  test('normaliza una respuesta que no es JSON', async () => {
    const adaptador = new TMDBAdapter({
      apiKey: 'clave',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('JSON inválido');
        },
      }),
    });

    await expect(adaptador.buscar({ q: 'matrix' })).rejects.toMatchObject({
      codigo: 'TMDB_NO_DISPONIBLE',
      message: 'TMDB devolvió una respuesta que no se pudo interpretar.',
    });
  });

  test('falla sin API key y no llama al proveedor', async () => {
    let llamadas = 0;
    const adaptador = new TMDBAdapter({
      apiKey: '',
      fetchImpl: async () => {
        llamadas += 1;
        return respuestaJson({});
      },
    });

    await expect(adaptador.buscar({ q: 'matrix' })).rejects.toMatchObject({
      codigo: 'TMDB_NO_DISPONIBLE',
      message: 'Falta configurar la API key de TMDB en el servidor.',
    });
    expect(llamadas).toBe(0);
  });

  test('si falla la lista de géneros, guarda la película sin géneros', async () => {
    const { fetchFalso } = crearFetchFalso({
      '/search/movie': BUSQUEDA,
      '/genre/movie/list': respuestaJson({}, { ok: false, status: 500 }),
    });
    const adaptador = new TMDBAdapter({ apiKey: 'clave', fetchImpl: fetchFalso });

    const resultado = await adaptador.buscar({ q: 'matrix' });

    expect(resultado.peliculas[0].generos).toEqual([]);
  });
});
