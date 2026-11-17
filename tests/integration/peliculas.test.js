import { describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { createContainer } from '../../src/container.js';
import { Pelicula } from '../../src/models/Pelicula.js';
import { MemoryStore } from '../../src/repositories/JsonStore.js';
import { ErrorDominio } from '../../src/utils/ErrorDominio.js';

const loggerSilencioso = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

async function iniciarEntorno(opciones = {}) {
  const container = await createContainer({
    store: new MemoryStore(),
    rondasHash: 4,
    ...opciones,
  });
  const app = createApp({ logger: loggerSilencioso, container });
  const server = app.listen(0, '127.0.0.1');

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const { port } = server.address();

  return {
    container,
    server,
    baseUrl: `http://127.0.0.1:${port}`,
  };
}

async function detenerEntorno(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

function obtenerCookie(response) {
  const setCookie = response.headers.get('set-cookie');
  return setCookie ? setCookie.split(';')[0] : null;
}

async function registrar(baseUrl, { nombreUsuario, email }) {
  const response = await fetch(`${baseUrl}/api/auth/registro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: `Usuario ${nombreUsuario}`,
      nombreUsuario,
      email,
      contrasena: 'secreto123',
    }),
  });

  return obtenerCookie(response);
}

function pedir(baseUrl, ruta, { cookie, metodo = 'GET', cuerpo } = {}) {
  const headers = {};

  if (cookie) {
    headers.Cookie = cookie;
  }

  if (cuerpo !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${baseUrl}${ruta}`, {
    method: metodo,
    headers,
    ...(cuerpo !== undefined && { body: JSON.stringify(cuerpo) }),
  });
}

function crearPelicula(overrides = {}) {
  return new Pelicula({
    id: randomUUID(),
    tmdbId: 603,
    titulo: 'Matrix',
    sinopsis: 'Un programador descubre la verdadera naturaleza de su realidad.',
    anioEstreno: 1999,
    generos: ['Acción', 'Ciencia ficción'],
    rutaPoster: '/matrix.jpg',
    rutaBackdrop: '/matrix-backdrop.jpg',
    ...overrides,
  });
}

/**
 * Adaptador de TMDB falso: no toca la red y registra las consultas recibidas.
 */
function crearAdaptadorFalso() {
  return {
    falla: false,
    busquedas: [],
    consultasTendencias: [],
    consultasCatalogo: [],
    consultasTrailer: [],
    consultasRecomendaciones: [],
    trailerResultado: { youtubeKey: 'esOficial123', titulo: 'Trailer oficial', idioma: 'es' },

    async buscar({ q, page }) {
      if (this.falla) {
        throw new ErrorDominio('TMDB_NO_DISPONIBLE', 'TMDB no está disponible.');
      }

      this.busquedas.push({ q, page });

      return { peliculas: [crearPelicula()], page, total: 91 };
    },

    async tendencias({ page }) {
      if (this.falla) {
        throw new ErrorDominio('TMDB_NO_DISPONIBLE', 'TMDB no está disponible.');
      }

      this.consultasTendencias.push({ page });

      return {
        peliculas: [crearPelicula({ tmdbId: 604, titulo: 'Matrix Reloaded' })],
        page,
        total: 1,
      };
    },

    async catalogo({ page }) {
      if (this.falla) {
        throw new ErrorDominio('TMDB_NO_DISPONIBLE', 'TMDB no está disponible.');
      }

      this.consultasCatalogo.push({ page });

      return {
        peliculas: [crearPelicula({ tmdbId: 603, anioEstreno: 1999 })],
        page,
        total: 500,
      };
    },

    async trailer({ tmdbId }) {
      if (this.falla) {
        throw new ErrorDominio('TMDB_NO_DISPONIBLE', 'TMDB no está disponible.');
      }

      this.consultasTrailer.push({ tmdbId });

      return this.trailerResultado;
    },

    async recomendaciones({ tmdbId, page }) {
      if (this.falla) {
        throw new ErrorDominio('TMDB_NO_DISPONIBLE', 'TMDB no está disponible.');
      }

      this.consultasRecomendaciones.push({ tmdbId, page });

      return {
        // Incluye la semilla para comprobar que el servicio la descarta.
        peliculas: [
          crearPelicula({ tmdbId }),
          crearPelicula({ tmdbId: 604, titulo: 'Matrix Reloaded' }),
        ],
        page,
        total: 2,
      };
    },
  };
}

describe('peliculas', () => {
  test('busca en TMDB, guarda la copia local y devuelve el detalle por id', async () => {
    const adaptador = crearAdaptadorFalso();
    const { server, baseUrl } = await iniciarEntorno({ tmdbAdapter: adaptador });

    try {
      const busqueda = await pedir(baseUrl, '/api/peliculas/buscar?q=%20matrix%20');
      const coleccion = await busqueda.json();

      expect(busqueda.status).toBe(200);
      expect(coleccion).toMatchObject({ page: 1, limit: 20, total: 91 });
      expect(coleccion.data).toHaveLength(1);
      expect(coleccion.data[0]).toMatchObject({
        tmdbId: 603,
        titulo: 'Matrix',
        anioEstreno: 1999,
        generos: ['Acción', 'Ciencia ficción'],
        rutaPoster: '/matrix.jpg',
        rutaBackdrop: '/matrix-backdrop.jpg',
        puntuacionTmdb: null,
      });
      expect(coleccion.data[0]).not.toHaveProperty('sinopsis');
      expect(adaptador.busquedas).toEqual([{ q: 'matrix', page: 1 }]);

      const detalle = await pedir(baseUrl, `/api/peliculas/${coleccion.data[0].id}`);
      const pelicula = await detalle.json();

      expect(detalle.status).toBe(200);
      expect(pelicula).toMatchObject({
        id: coleccion.data[0].id,
        tmdbId: 603,
        titulo: 'Matrix',
        sinopsis: 'Un programador descubre la verdadera naturaleza de su realidad.',
        anioEstreno: 1999,
        generos: ['Acción', 'Ciencia ficción'],
        rutaPoster: '/matrix.jpg',
        rutaBackdrop: '/matrix-backdrop.jpg',
        promedioPuntuacion: null,
        totalPuntuaciones: 0,
      });

      const otraPagina = await (
        await pedir(baseUrl, '/api/peliculas/buscar?q=matrix&page=2')
      ).json();

      expect(otraPagina.data[0].id).toBe(coleccion.data[0].id);
      expect(adaptador.busquedas).toEqual([
        { q: 'matrix', page: 1 },
        { q: 'matrix', page: 2 },
      ]);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('valida la consulta y la página antes de llamar a TMDB', async () => {
    const adaptador = crearAdaptadorFalso();
    const { server, baseUrl } = await iniciarEntorno({ tmdbAdapter: adaptador });

    try {
      const rutas = [
        '/api/peliculas/buscar',
        '/api/peliculas/buscar?q=',
        '/api/peliculas/buscar?q=%20%20',
        `/api/peliculas/buscar?q=${'a'.repeat(101)}`,
        '/api/peliculas/buscar?q=matrix&page=0',
        '/api/peliculas/buscar?q=matrix&page=abc',
        '/api/peliculas/buscar?q=matrix&page=501',
      ];

      for (const ruta of rutas) {
        const response = await pedir(baseUrl, ruta);

        expect({ ruta, status: response.status }).toEqual({ ruta, status: 400 });
        expect((await response.json()).title).toBe('Datos inválidos');
      }

      expect(adaptador.busquedas).toHaveLength(0);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('devuelve las tendencias paginadas', async () => {
    const adaptador = crearAdaptadorFalso();
    const { server, baseUrl } = await iniciarEntorno({ tmdbAdapter: adaptador });

    try {
      const response = await pedir(baseUrl, '/api/peliculas/tendencias?page=2');
      const coleccion = await response.json();

      expect(response.status).toBe(200);
      expect(coleccion).toMatchObject({ page: 2, limit: 20, total: 1 });
      expect(coleccion.data[0]).toMatchObject({ tmdbId: 604, titulo: 'Matrix Reloaded' });
      expect(adaptador.consultasTendencias).toEqual([{ page: 2 }]);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('devuelve el catálogo amplio paginado', async () => {
    const adaptador = crearAdaptadorFalso();
    const { server, baseUrl } = await iniciarEntorno({ tmdbAdapter: adaptador });

    try {
      const response = await pedir(baseUrl, '/api/peliculas/catalogo?page=3');
      const coleccion = await response.json();

      expect(response.status).toBe(200);
      expect(coleccion).toMatchObject({ page: 3, limit: 20, total: 500 });
      expect(coleccion.data[0]).toMatchObject({ tmdbId: 603, anioEstreno: 1999 });
      expect(adaptador.consultasCatalogo).toEqual([{ page: 3 }]);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('devuelve el trailer oficial de una película guardada', async () => {
    const adaptador = crearAdaptadorFalso();
    const { container, server, baseUrl } = await iniciarEntorno({ tmdbAdapter: adaptador });

    try {
      const pelicula = await container.peliculaRepository.guardar(crearPelicula());
      const response = await pedir(baseUrl, `/api/peliculas/${pelicula.id}/trailer`);
      const cuerpo = await response.json();

      expect(response.status).toBe(200);
      expect(cuerpo).toEqual({
        trailer: { youtubeKey: 'esOficial123', titulo: 'Trailer oficial', idioma: 'es' },
      });
      expect(adaptador.consultasTrailer).toEqual([{ tmdbId: 603 }]);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('devuelve trailer null cuando la película no tiene uno', async () => {
    const adaptador = crearAdaptadorFalso();

    adaptador.trailerResultado = null;

    const { container, server, baseUrl } = await iniciarEntorno({ tmdbAdapter: adaptador });

    try {
      const pelicula = await container.peliculaRepository.guardar(crearPelicula());
      const response = await pedir(baseUrl, `/api/peliculas/${pelicula.id}/trailer`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ trailer: null });
    } finally {
      await detenerEntorno(server);
    }
  });

  test('responde 502 cuando TMDB no está disponible', async () => {
    const adaptador = crearAdaptadorFalso();

    adaptador.falla = true;

    const { server, baseUrl } = await iniciarEntorno({ tmdbAdapter: adaptador });

    try {
      for (const ruta of [
        '/api/peliculas/buscar?q=matrix',
        '/api/peliculas/tendencias',
        '/api/peliculas/catalogo',
      ]) {
        const response = await pedir(baseUrl, ruta);
        const problema = await response.json();

        expect({ ruta, status: response.status }).toEqual({ ruta, status: 502 });
        expect(problema).toMatchObject({
          title: 'Servicio externo no disponible',
          status: 502,
        });
      }
    } finally {
      await detenerEntorno(server);
    }
  });

  test('devuelve 404 para una película inexistente y para sus reseñas', async () => {
    const { server, baseUrl } = await iniciarEntorno({ tmdbAdapter: crearAdaptadorFalso() });

    try {
      for (const ruta of ['/api/peliculas/p-inexistente', '/api/peliculas/p-inexistente/resenas']) {
        const response = await pedir(baseUrl, ruta);

        expect({ ruta, status: response.status }).toEqual({ ruta, status: 404 });
        expect((await response.json()).title).toBe('Película no encontrada');
      }
    } finally {
      await detenerEntorno(server);
    }
  });

  test('lista las reseñas públicas de una película del catálogo', async () => {
    const { server, baseUrl } = await iniciarEntorno({ tmdbAdapter: crearAdaptadorFalso() });

    try {
      const peliculaId = (await (await pedir(baseUrl, '/api/peliculas/buscar?q=matrix')).json())
        .data[0].id;
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });

      const creada = await pedir(baseUrl, '/api/resenas', {
        cookie,
        metodo: 'POST',
        cuerpo: { peliculaId, comentario: 'Una película que invita a pensar.' },
      });

      expect(creada.status).toBe(201);

      const resenas = await (await pedir(baseUrl, `/api/peliculas/${peliculaId}/resenas`)).json();

      expect(resenas).toMatchObject({ page: 1, limit: 20, total: 1 });
      expect(resenas.data[0]).toMatchObject({
        comentario: 'Una película que invita a pensar.',
        autor: { nombre: 'Usuario lucia', nombreUsuario: 'lucia' },
        pelicula: { id: peliculaId, tmdbId: 603 },
      });

      const invalida = await pedir(baseUrl, `/api/peliculas/${peliculaId}/resenas?limit=51`);
      expect(invalida.status).toBe(400);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('la ficha incluye el promedio de las puntuaciones', async () => {
    const { server, baseUrl } = await iniciarEntorno({ tmdbAdapter: crearAdaptadorFalso() });

    try {
      const peliculaId = (await (await pedir(baseUrl, '/api/peliculas/buscar?q=matrix')).json())
        .data[0].id;
      const cookies = [];

      for (const [nombreUsuario, email] of [
        ['lucia', 'lucia@example.com'],
        ['tomas', 'tomas@example.com'],
        ['caro', 'caro@example.com'],
      ]) {
        cookies.push(await registrar(baseUrl, { nombreUsuario, email }));
      }

      const puntuaciones = [5, 4, null];

      for (const [indice, cookie] of cookies.entries()) {
        const response = await pedir(baseUrl, '/api/resenas', {
          cookie,
          metodo: 'POST',
          cuerpo: {
            peliculaId,
            comentario: `Reseña ${indice + 1}`,
            ...(puntuaciones[indice] !== null && { puntuacion: puntuaciones[indice] }),
          },
        });

        expect(response.status).toBe(201);
      }

      const detalle = await (await pedir(baseUrl, `/api/peliculas/${peliculaId}`)).json();

      expect(detalle.promedioPuntuacion).toBe(4.5);
      expect(detalle.totalPuntuaciones).toBe(2);

      const resenas = await (await pedir(baseUrl, `/api/peliculas/${peliculaId}/resenas`)).json();

      expect(resenas.total).toBe(3);
      expect(resenas.data.map((resena) => resena.puntuacion)).toEqual(
        expect.arrayContaining([4, 5, null]),
      );
    } finally {
      await detenerEntorno(server);
    }
  });

  test('la ficha suma las estrellas sin reseña una sola vez por usuario', async () => {
    const { server, baseUrl } = await iniciarEntorno({ tmdbAdapter: crearAdaptadorFalso() });

    try {
      const peliculaId = (await (await pedir(baseUrl, '/api/peliculas/buscar?q=matrix')).json())
        .data[0].id;
      const cookies = [];

      for (const [nombreUsuario, email] of [
        ['lucia', 'lucia@example.com'],
        ['tomas', 'tomas@example.com'],
        ['caro', 'caro@example.com'],
      ]) {
        cookies.push(await registrar(baseUrl, { nombreUsuario, email }));
      }

      await pedir(baseUrl, '/api/resenas', {
        cookie: cookies[0],
        metodo: 'POST',
        cuerpo: { peliculaId, comentario: 'Reseña puntuada.', puntuacion: 5 },
      });
      await pedir(baseUrl, '/api/visualizaciones', {
        cookie: cookies[1],
        metodo: 'POST',
        cuerpo: { peliculaId, fecha: '2020-01-01', puntuacion: 3 },
      });
      await pedir(baseUrl, '/api/visualizaciones', {
        cookie: cookies[2],
        metodo: 'POST',
        cuerpo: { peliculaId, fecha: '2020-01-02', puntuacion: 2 },
      });
      await pedir(baseUrl, '/api/resenas', {
        cookie: cookies[2],
        metodo: 'POST',
        cuerpo: { peliculaId, comentario: 'Cambié de opinión.', puntuacion: 4 },
      });

      const detalle = await (await pedir(baseUrl, `/api/peliculas/${peliculaId}`)).json();

      expect(detalle.promedioPuntuacion).toBe(4);
      expect(detalle.totalPuntuaciones).toBe(3);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('las recomendaciones requieren sesión', async () => {
    const adaptador = crearAdaptadorFalso();
    const { server, baseUrl } = await iniciarEntorno({ tmdbAdapter: adaptador });

    try {
      const response = await pedir(baseUrl, '/api/peliculas/recomendadas');

      expect(response.status).toBe(401);
      expect(adaptador.consultasRecomendaciones).toHaveLength(0);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('recomienda a partir de la última película de la watchlist', async () => {
    const adaptador = crearAdaptadorFalso();
    const { server, baseUrl } = await iniciarEntorno({ tmdbAdapter: adaptador });

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const peliculaId = (await (await pedir(baseUrl, '/api/peliculas/buscar?q=matrix')).json())
        .data[0].id;

      const agregada = await pedir(baseUrl, '/api/watchlist', {
        cookie,
        metodo: 'POST',
        cuerpo: { peliculaId },
      });

      expect(agregada.status).toBe(201);

      const response = await pedir(baseUrl, '/api/peliculas/recomendadas', { cookie });
      const coleccion = await response.json();

      expect(response.status).toBe(200);
      expect(adaptador.consultasRecomendaciones).toEqual([{ tmdbId: 603, page: 1 }]);
      expect(coleccion).toMatchObject({ page: 1, limit: 20, total: 1 });
      // La semilla se descarta aunque TMDB la devuelva entre las recomendaciones.
      expect(coleccion.data).toHaveLength(1);
      expect(coleccion.data[0]).toMatchObject({ tmdbId: 604, titulo: 'Matrix Reloaded' });
    } finally {
      await detenerEntorno(server);
    }
  });

  test('usa la última visualización si el usuario no tiene watchlist', async () => {
    const adaptador = crearAdaptadorFalso();
    const { server, baseUrl } = await iniciarEntorno({ tmdbAdapter: adaptador });

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'tomas',
        email: 'tomas@example.com',
      });
      const peliculaId = (await (await pedir(baseUrl, '/api/peliculas/buscar?q=matrix')).json())
        .data[0].id;

      const creada = await pedir(baseUrl, '/api/visualizaciones', {
        cookie,
        metodo: 'POST',
        cuerpo: { peliculaId, fecha: '2026-01-15' },
      });

      expect(creada.status).toBe(201);

      const response = await pedir(baseUrl, '/api/peliculas/recomendadas', { cookie });

      expect(response.status).toBe(200);
      expect(adaptador.consultasRecomendaciones).toEqual([{ tmdbId: 603, page: 1 }]);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('devuelve una colección vacía si el usuario no tiene actividad', async () => {
    const adaptador = crearAdaptadorFalso();
    const { server, baseUrl } = await iniciarEntorno({ tmdbAdapter: adaptador });

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'caro',
        email: 'caro@example.com',
      });

      const response = await pedir(baseUrl, '/api/peliculas/recomendadas', { cookie });
      const coleccion = await response.json();

      expect(response.status).toBe(200);
      expect(coleccion).toEqual({ data: [], page: 1, limit: 20, total: 0 });
      expect(adaptador.consultasRecomendaciones).toHaveLength(0);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('responde 502 si TMDB falla al buscar recomendaciones', async () => {
    const adaptador = crearAdaptadorFalso();
    const { server, baseUrl } = await iniciarEntorno({ tmdbAdapter: adaptador });

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const peliculaId = (await (await pedir(baseUrl, '/api/peliculas/buscar?q=matrix')).json())
        .data[0].id;

      await pedir(baseUrl, '/api/watchlist', {
        cookie,
        metodo: 'POST',
        cuerpo: { peliculaId },
      });

      adaptador.falla = true;

      const response = await pedir(baseUrl, '/api/peliculas/recomendadas', { cookie });

      expect(response.status).toBe(502);
      expect((await response.json()).title).toBe('Servicio externo no disponible');
    } finally {
      await detenerEntorno(server);
    }
  });
});
