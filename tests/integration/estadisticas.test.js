import { describe, expect, test } from '@jest/globals';
import { createApp } from '../../src/app.js';
import { createContainer } from '../../src/container.js';
import { Pelicula } from '../../src/models/Pelicula.js';
import { MemoryStore } from '../../src/repositories/JsonStore.js';

const loggerSilencioso = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

async function iniciarEntorno() {
  const container = await createContainer({ store: new MemoryStore(), rondasHash: 4 });
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

async function registrar(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/registro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: 'Lucía Gómez',
      nombreUsuario: 'lucia',
      email: 'lucia@example.com',
      contrasena: 'secreto123',
    }),
  });

  return obtenerCookie(response);
}

async function guardarPelicula(container, overrides = {}) {
  const pelicula = new Pelicula({
    id: 'p-matrix',
    tmdbId: 603,
    titulo: 'Matrix',
    sinopsis: 'Un programador descubre que el mundo es una simulación.',
    anioEstreno: 1999,
    generos: ['Acción', 'Ciencia ficción'],
    rutaPoster: '/matrix.jpg',
    rutaBackdrop: '/matrix-backdrop.jpg',
    ...overrides,
  });

  await container.peliculaRepository.guardar(pelicula);

  return pelicula;
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

describe('estadísticas', () => {
  test('exige sesión', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      const response = await pedir(baseUrl, '/api/estadisticas/me');

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ title: 'Sesión requerida', status: 401 });
    } finally {
      await detenerEntorno(server);
    }
  });

  test('devuelve las métricas del usuario autenticado', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const cookie = await registrar(baseUrl);
      const matrix = await guardarPelicula(container);
      const otra = await guardarPelicula(container, {
        id: 'p-otra',
        tmdbId: 604,
        titulo: 'Otra película',
      });
      const tercera = await guardarPelicula(container, {
        id: 'p-tercera',
        tmdbId: 605,
        titulo: 'Tercera película',
      });

      await pedir(baseUrl, '/api/visualizaciones', {
        cookie,
        metodo: 'POST',
        cuerpo: { peliculaId: matrix.id, fecha: '2020-01-01', puntuacion: 4 },
      });
      await pedir(baseUrl, '/api/visualizaciones', {
        cookie,
        metodo: 'POST',
        cuerpo: { peliculaId: otra.id, fecha: '2020-02-01', puntuacion: 5 },
      });
      await pedir(baseUrl, '/api/visualizaciones', {
        cookie,
        metodo: 'POST',
        cuerpo: { peliculaId: matrix.id, fecha: '2020-03-01' },
      });
      await pedir(baseUrl, '/api/resenas', {
        cookie,
        metodo: 'POST',
        cuerpo: { peliculaId: matrix.id, comentario: 'Excelente.', puntuacion: 5 },
      });
      await pedir(baseUrl, '/api/resenas', {
        cookie,
        metodo: 'POST',
        cuerpo: { peliculaId: otra.id, comentario: 'Muy buena.' },
      });
      await pedir(baseUrl, '/api/resenas', {
        cookie,
        metodo: 'POST',
        cuerpo: { peliculaId: tercera.id, comentario: 'Correcta.', puntuacion: 3 },
      });

      const response = await pedir(baseUrl, '/api/estadisticas/me', { cookie });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        totalVisualizaciones: 3,
        peliculasUnicas: 2,
        promedioPuntuacion: 4.3,
        totalResenas: 3,
        distribucionPuntuacion: {
          1: 0,
          2: 0,
          3: 1,
          4: 0,
          5: 2,
        },
      });
    } finally {
      await detenerEntorno(server);
    }
  });
});
