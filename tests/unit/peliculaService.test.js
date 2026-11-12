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
function crearServicio({ pelicula, peliculas = [crearPelicula()], ahora } = {}) {
  const llamadas = {
    busquedas: [],
    tendencias: [],
    guardadas: [],
    resenas: [],
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
  };

  const peliculaRepository = {
    async guardarVarias(nuevas) {
      llamadas.guardadas.push(...nuevas);
      return nuevas;
    },
    async buscarPorId() {
      return pelicula ?? null;
    },
  };

  const resenaService = {
    async listarPorPelicula(peliculaId, paginacion) {
      llamadas.resenas.push({ peliculaId, paginacion });
      return { data: [], page: paginacion.page, limit: paginacion.limit, total: 0 };
    },
  };

  return {
    llamadas,
    service: new PeliculaService({ peliculaRepository, tmdbAdapter, resenaService, ahora }),
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
