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
        rutaPoster: '/matrix.jpg',
      });
      expect(coleccion.data[0]).not.toHaveProperty('sinopsis');
      expect(coleccion.data[0]).not.toHaveProperty('generos');
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

  test('responde 502 cuando TMDB no está disponible', async () => {
    const adaptador = crearAdaptadorFalso();

    adaptador.falla = true;

    const { server, baseUrl } = await iniciarEntorno({ tmdbAdapter: adaptador });

    try {
      for (const ruta of ['/api/peliculas/buscar?q=matrix', '/api/peliculas/tendencias']) {
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
});
