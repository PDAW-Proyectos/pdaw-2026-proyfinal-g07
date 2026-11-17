import { describe, expect, test } from '@jest/globals';
import { Pelicula } from '../../src/models/Pelicula.js';
import { PeliculaService } from '../../src/services/PeliculaService.js';

function crearPelicula(overrides = {}) {
  return new Pelicula({
    id: 'p-matrix',
    tmdbId: 603,
    titulo: 'Matrix',
    sinopsis: 'Un programador descubre la verdadera naturaleza de su realidad.',
    anioEstreno: 1999,
    generos: ['Acción', 'Ciencia ficción'],
    rutaPoster: '/matrix.jpg',
    ...overrides,
  });
}

/**
 * Arma el servicio con dobles de prueba y registra las llamadas que recibe.
 */
function crearServicio({
  pelicula,
  peliculas = [crearPelicula()],
  ahora,
  watchlist = [],
  visualizaciones = [],
  detalleTmdb = null,
  recomendadas = [crearPelicula({ tmdbId: 604, titulo: 'Otra película' })],
  totalCatalogo = 91,
  trailer = { youtubeKey: 'esOficial123', titulo: 'Trailer oficial', idioma: 'es' },
} = {}) {
  const llamadas = {
    busquedas: [],
    tendencias: [],
    catalogo: [],
    trailers: [],
    guardadas: [],
    resenas: [],
    recomendaciones: [],
    detalles: [],
  };

  const tmdbAdapter = {
    async buscar({ q, page }) {
      llamadas.busquedas.push({ q, page });
      return { peliculas, page, total: 91 };
    },
    async tendencias({ page }) {
      llamadas.tendencias.push({ page });
      return { peliculas, page, total: 91 };
    },
    async catalogo({ page }) {
      llamadas.catalogo.push({ page });
      return { peliculas, page, total: totalCatalogo };
    },
    async trailer({ tmdbId }) {
      llamadas.trailers.push({ tmdbId });
      return trailer;
    },
    async recomendaciones({ tmdbId, page }) {
      llamadas.recomendaciones.push({ tmdbId, page });
      return { peliculas: recomendadas, page, total: recomendadas.length };
    },
    async obtenerDetalle({ tmdbId }) {
      llamadas.detalles.push({ tmdbId });

      if (!detalleTmdb) {
        throw new Error('TMDB no disponible');
      }

      return detalleTmdb;
    },
  };

  const peliculaRepository = {
    async guardarVarias(nuevas) {
      llamadas.guardadas.push(...nuevas);
      return nuevas;
    },
    async guardar(actualizada) {
      llamadas.guardadas.push(actualizada);
      return actualizada;
    },
    async buscarPorId() {
      return pelicula ?? null;
    },
  };

  const watchlistRepository = {
    async listarPorUsuario() {
      return watchlist;
    },
  };

  const visualizacionRepository = {
    async listarPorUsuario() {
      return visualizaciones;
    },
  };

  const resenaService = {
    async listarPorPelicula(peliculaId, paginacion) {
      llamadas.resenas.push({ peliculaId, paginacion });
      return { data: [], page: paginacion.page, limit: paginacion.limit, total: 0 };
    },
  };

  const puntuacionService = {
    async promedioPorPelicula(peliculaId) {
      llamadas.promedios = llamadas.promedios ?? [];
      llamadas.promedios.push({ peliculaId });
      return { promedioPuntuacion: 4.5, totalPuntuaciones: 2 };
    },
  };

  return {
    llamadas,
    service: new PeliculaService({
      peliculaRepository,
      tmdbAdapter,
      resenaService,
      puntuacionService,
      watchlistRepository,
      visualizacionRepository,
      ahora,
    }),
  };
}

/**
 * Reloj controlable para probar los TTL del cache.
 */
function crearReloj() {
  let instante = Date.parse('2026-01-01T00:00:00.000Z');

  return {
    ahora: () => new Date(instante),
    avanzar(ms) {
      instante += ms;
    },
  };
}

describe('PeliculaService', () => {
  test('busca, recorta la consulta y devuelve la colección del contrato', async () => {
    const { service, llamadas } = crearServicio();

    const resultado = await service.buscar({ q: '  matrix  ', page: 2 });

    expect(llamadas.busquedas).toEqual([{ q: 'matrix', page: 2 }]);
    expect(llamadas.guardadas).toHaveLength(1);
    expect(resultado).toMatchObject({ page: 2, limit: 20, total: 91 });
    expect(resultado.data[0]).toBe(llamadas.guardadas[0]);
    expect(resultado.data.map((pelicula) => pelicula.toJSON())).toEqual([crearPelicula().toJSON()]);
  });

  test('exige una consulta no vacía y de hasta 100 caracteres', async () => {
    const { service, llamadas } = crearServicio();

    for (const q of [undefined, '', '   ', 'a'.repeat(101), ['matrix']]) {
      await expect(service.buscar({ q })).rejects.toMatchObject({ codigo: 'VALIDACION_FALLIDA' });
    }

    expect(llamadas.busquedas).toHaveLength(0);
  });

  test('valida la página dentro del rango que admite TMDB', async () => {
    const { service, llamadas } = crearServicio();

    for (const page of [0, -1, 1.5, 501, '2']) {
      await expect(service.buscar({ q: 'matrix', page })).rejects.toMatchObject({
        codigo: 'VALIDACION_FALLIDA',
      });
    }

    expect(llamadas.busquedas).toHaveLength(0);
  });

  test('tendencias guarda la página y devuelve la colección', async () => {
    const { service, llamadas } = crearServicio();

    const resultado = await service.tendencias({ page: 3 });

    expect(llamadas.tendencias).toEqual([{ page: 3 }]);
    expect(llamadas.guardadas).toHaveLength(1);
    expect(resultado).toMatchObject({ page: 3, limit: 20, total: 91 });
  });

  test('catalogo guarda la página y devuelve la colección', async () => {
    const { service, llamadas } = crearServicio();

    const resultado = await service.catalogo({ page: 2 });

    expect(llamadas.catalogo).toEqual([{ page: 2 }]);
    expect(llamadas.guardadas).toHaveLength(1);
    expect(resultado).toMatchObject({ page: 2, limit: 20, total: 91 });
  });

  test('catalogo acota el total a las páginas que TMDB permite recorrer', async () => {
    const { service } = crearServicio({ totalCatalogo: 20001 });

    const resultado = await service.catalogo({ page: 1 });

    expect(resultado.total).toBe(10000);
  });

  test('trailer busca por tmdbId y reutiliza el cache', async () => {
    const { service, llamadas } = crearServicio({ pelicula: crearPelicula() });

    const primero = await service.trailer('p-matrix');
    const segundo = await service.trailer('p-matrix');

    expect(primero).toEqual({
      trailer: { youtubeKey: 'esOficial123', titulo: 'Trailer oficial', idioma: 'es' },
    });
    expect(segundo).toBe(primero);
    expect(llamadas.trailers).toEqual([{ tmdbId: 603 }]);
  });

  test('trailer devuelve null cuando TMDB no encuentra uno', async () => {
    const { service } = crearServicio({ pelicula: crearPelicula(), trailer: null });

    const resultado = await service.trailer('p-matrix');

    expect(resultado).toEqual({ trailer: null });
  });

  test('recomendadas usa la última entrada de la watchlist como semilla', async () => {
    const semilla = crearPelicula();
    const recomendada = crearPelicula({ tmdbId: 604, titulo: 'Otra película' });
    const { service, llamadas } = crearServicio({
      pelicula: semilla,
      watchlist: [
        { peliculaId: 'p-vieja', fechaAgregado: new Date('2026-01-01T00:00:00.000Z') },
        { peliculaId: 'p-matrix', fechaAgregado: new Date('2026-02-01T00:00:00.000Z') },
      ],
      visualizaciones: [{ peliculaId: 'p-vista', fecha: '2026-03-01' }],
      recomendadas: [semilla, recomendada],
    });

    const resultado = await service.recomendadas('u1');

    expect(llamadas.recomendaciones).toEqual([{ tmdbId: 603, page: 1 }]);
    expect(resultado.data).toEqual([recomendada]);
    expect(resultado).toMatchObject({ page: 1, limit: 20, total: 1 });
  });

  test('recomendadas usa la última visualización si no hay watchlist', async () => {
    const semilla = crearPelicula();
    const { service, llamadas } = crearServicio({
      pelicula: semilla,
      visualizaciones: [
        { peliculaId: 'p-vieja', fecha: '2026-01-01' },
        { peliculaId: 'p-matrix', fecha: '2026-05-01' },
      ],
    });

    await service.recomendadas('u1');

    expect(llamadas.recomendaciones).toEqual([{ tmdbId: 603, page: 1 }]);
  });

  test('recomendadas devuelve una colección vacía si no hay semilla', async () => {
    const { service, llamadas } = crearServicio();

    const resultado = await service.recomendadas('u1');

    expect(resultado).toEqual({ data: [], page: 1, limit: 20, total: 0 });
    expect(llamadas.recomendaciones).toHaveLength(0);
  });

  test('obtener devuelve la película del catálogo local', async () => {
    const pelicula = crearPelicula();
    const { service } = crearServicio({ pelicula });

    await expect(service.obtener('p-matrix')).resolves.toBe(pelicula);
  });

  test('obtener falla con PELICULA_NO_ENCONTRADA si no está en el catálogo', async () => {
    const { service } = crearServicio({ pelicula: null });

    await expect(service.obtener('p-inexistente')).rejects.toMatchObject({
      codigo: 'PELICULA_NO_ENCONTRADA',
    });
  });

  test('obtenerDetalle agrega el promedio de las puntuaciones de las reseñas', async () => {
    const pelicula = crearPelicula();
    const { service, llamadas } = crearServicio({ pelicula });

    await expect(service.obtenerDetalle('p-matrix')).resolves.toEqual({
      pelicula,
      promedioPuntuacion: 4.5,
      totalPuntuaciones: 2,
    });
    expect(llamadas.promedios).toEqual([{ peliculaId: 'p-matrix' }]);
  });

  test('obtenerDetalle completa y persiste el director y los datos de TMDB', async () => {
    const pelicula = crearPelicula();
    const detalleTmdb = {
      director: 'Lana Wachowski, Lilly Wachowski',
      puntuacionTmdb: 8.2,
      votosTmdb: 25_000,
    };
    const { service, llamadas } = crearServicio({ pelicula, detalleTmdb });

    const resultado = await service.obtenerDetalle('p-matrix');

    expect(llamadas.detalles).toEqual([{ tmdbId: 603 }]);
    expect(llamadas.guardadas).toHaveLength(1);
    expect(resultado.pelicula).toMatchObject(detalleTmdb);
    expect(resultado.promedioPuntuacion).toBe(4.5);
  });

  test('obtenerDetalle no vuelve a pedir TMDB si la película ya está completa', async () => {
    const pelicula = crearPelicula({
      director: 'Lana Wachowski, Lilly Wachowski',
      puntuacionTmdb: 8.2,
      votosTmdb: 25_000,
    });
    const { service, llamadas } = crearServicio({
      pelicula,
      detalleTmdb: { director: 'Otro', puntuacionTmdb: 1, votosTmdb: 1 },
    });

    const resultado = await service.obtenerDetalle('p-matrix');

    expect(resultado.pelicula).toBe(pelicula);
    expect(llamadas.detalles).toHaveLength(0);
    expect(llamadas.guardadas).toHaveLength(0);
  });

  test('obtenerDetalle conserva la ficha si TMDB falla', async () => {
    const pelicula = crearPelicula();
    const { service } = crearServicio({ pelicula });

    const resultado = await service.obtenerDetalle('p-matrix');

    expect(resultado.pelicula).toBe(pelicula);
  });

  test('listarResenas delega en el servicio de reseñas con la paginación pedida', async () => {
    const { service, llamadas } = crearServicio();

    const resultado = await service.listarResenas('p-matrix', { page: 2, limit: 5 });

    expect(llamadas.resenas).toEqual([
      { peliculaId: 'p-matrix', paginacion: { page: 2, limit: 5 } },
    ]);
    expect(resultado).toMatchObject({ page: 2, limit: 5, total: 0 });
  });

  test('reutiliza la búsqueda cacheada dentro del TTL', async () => {
    const reloj = crearReloj();
    const { service, llamadas } = crearServicio({ ahora: reloj.ahora });

    const primera = await service.buscar({ q: '  matrix  ', page: 1 });

    reloj.avanzar(59_000);

    const segunda = await service.buscar({ q: 'MATRIX', page: 1 });

    expect(llamadas.busquedas).toHaveLength(1);
    expect(segunda).toBe(primera);
  });

  test('vuelve a pedir a TMDB cuando vence el TTL de la búsqueda', async () => {
    const reloj = crearReloj();
    const { service, llamadas } = crearServicio({ ahora: reloj.ahora });

    await service.buscar({ q: 'matrix' });
    reloj.avanzar(60_000);
    await service.buscar({ q: 'matrix' });

    expect(llamadas.busquedas).toHaveLength(2);
  });

  test('separa el cache por consulta y página', async () => {
    const { service, llamadas } = crearServicio();

    await service.buscar({ q: 'matrix', page: 1 });
    await service.buscar({ q: 'matrix', page: 2 });
    await service.buscar({ q: 'otra', page: 1 });

    expect(llamadas.busquedas).toHaveLength(3);
  });

  test('cachea tendencias con su propio TTL', async () => {
    const reloj = crearReloj();
    const { service, llamadas } = crearServicio({ ahora: reloj.ahora });

    await service.tendencias({ page: 1 });
    reloj.avanzar(4 * 60 * 1000);
    await service.tendencias({ page: 1 });

    expect(llamadas.tendencias).toHaveLength(1);

    reloj.avanzar(2 * 60 * 1000);
    await service.tendencias({ page: 1 });

    expect(llamadas.tendencias).toHaveLength(2);
  });
});
