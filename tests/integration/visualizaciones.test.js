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

async function guardarPelicula(container, overrides = {}) {
  const pelicula = new Pelicula({
    id: 'p-matrix',
    tmdbId: 603,
    titulo: 'Matrix',
    sinopsis: 'Un programador descubre que el mundo es una simulación.',
    anioEstreno: 1999,
    generos: ['Acción', 'Ciencia ficción'],
    rutaPoster: '/matrix.jpg',
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

function crearVisualizacion(baseUrl, cookie, cuerpo) {
  return pedir(baseUrl, '/api/visualizaciones', { cookie, metodo: 'POST', cuerpo });
}

describe('visualizaciones', () => {
  test('exige sesión en todas las rutas', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      const respuestas = await Promise.all([
        pedir(baseUrl, '/api/visualizaciones'),
        pedir(baseUrl, '/api/visualizaciones', {
          metodo: 'POST',
          cuerpo: { peliculaId: 'p1', fecha: '2020-01-01' },
        }),
        pedir(baseUrl, '/api/visualizaciones/v1'),
        pedir(baseUrl, '/api/visualizaciones/v1', { metodo: 'PATCH', cuerpo: { puntuacion: 3 } }),
        pedir(baseUrl, '/api/visualizaciones/v1', { metodo: 'DELETE' }),
      ]);

      for (const respuesta of respuestas) {
        expect(respuesta.status).toBe(401);
        expect(await respuesta.json()).toMatchObject({ title: 'Sesión requerida', status: 401 });
      }
    } finally {
      await detenerEntorno(server);
    }
  });

  test('crea una visualización y devuelve la película resumida', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const pelicula = await guardarPelicula(container);

      const response = await crearVisualizacion(baseUrl, cookie, {
        peliculaId: pelicula.id,
        fecha: '2020-05-01',
        puntuacion: 4,
      });
      const cuerpo = await response.json();

      expect(response.status).toBe(201);
      expect(response.headers.get('location')).toMatch(/^\/api\/visualizaciones\/[0-9a-f-]{36}$/);
      expect(cuerpo).toEqual({
        id: expect.any(String),
        fecha: '2020-05-01',
        puntuacion: 4,
        pelicula: {
          id: 'p-matrix',
          tmdbId: 603,
          titulo: 'Matrix',
          anioEstreno: 1999,
          rutaPoster: '/matrix.jpg',
        },
      });
      expect(cuerpo).not.toHaveProperty('usuarioId');
    } finally {
      await detenerEntorno(server);
    }
  });

  test('rechaza películas inexistentes y datos inválidos al crear', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const pelicula = await guardarPelicula(container);

      const casos = [
        {
          nombre: 'película inexistente',
          cuerpo: { peliculaId: 'no-existe', fecha: '2020-01-01' },
          status: 404,
          title: 'Película no encontrada',
        },
        {
          nombre: 'fecha futura',
          cuerpo: { peliculaId: pelicula.id, fecha: '2999-01-01' },
          status: 400,
          title: 'Datos inválidos',
        },
        {
          nombre: 'puntuación fuera de rango',
          cuerpo: { peliculaId: pelicula.id, fecha: '2020-01-01', puntuacion: 9 },
          status: 400,
          title: 'Datos inválidos',
        },
        {
          nombre: 'campo desconocido',
          cuerpo: { peliculaId: pelicula.id, fecha: '2020-01-01', usuarioId: 'otro' },
          status: 400,
          title: 'Solicitud inválida',
        },
      ];

      for (const caso of casos) {
        const response = await crearVisualizacion(baseUrl, cookie, caso.cuerpo);
        const cuerpo = await response.json();

        expect({ caso: caso.nombre, status: response.status }).toEqual({
          caso: caso.nombre,
          status: caso.status,
        });
        expect(cuerpo.title).toBe(caso.title);
      }
    } finally {
      await detenerEntorno(server);
    }
  });

  test('lista el historial propio con orden y paginación', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const pelicula = await guardarPelicula(container);

      await crearVisualizacion(baseUrl, cookie, {
        peliculaId: pelicula.id,
        fecha: '2020-01-01',
        puntuacion: 4,
      });
      await crearVisualizacion(baseUrl, cookie, {
        peliculaId: pelicula.id,
        fecha: '2020-03-01',
      });
      await crearVisualizacion(baseUrl, cookie, {
        peliculaId: pelicula.id,
        fecha: '2020-02-01',
        puntuacion: 5,
      });

      const porDefecto = await (await pedir(baseUrl, '/api/visualizaciones', { cookie })).json();
      expect(porDefecto).toMatchObject({ page: 1, limit: 20, total: 3 });
      expect(porDefecto.data.map((item) => item.fecha)).toEqual([
        '2020-03-01',
        '2020-02-01',
        '2020-01-01',
      ]);
      expect(porDefecto.data[0].pelicula.titulo).toBe('Matrix');
      expect(porDefecto.data[0]).not.toHaveProperty('usuarioId');

      const ascendente = await (
        await pedir(baseUrl, '/api/visualizaciones?orden=fecha_asc', { cookie })
      ).json();
      expect(ascendente.data.map((item) => item.fecha)).toEqual([
        '2020-01-01',
        '2020-02-01',
        '2020-03-01',
      ]);

      const porPuntuacion = await (
        await pedir(baseUrl, '/api/visualizaciones?orden=puntuacion_desc', { cookie })
      ).json();
      expect(porPuntuacion.data.map((item) => item.puntuacion)).toEqual([5, 4, null]);

      const segundaPagina = await (
        await pedir(baseUrl, '/api/visualizaciones?page=2&limit=2', { cookie })
      ).json();
      expect(segundaPagina).toMatchObject({ page: 2, limit: 2, total: 3 });
      expect(segundaPagina.data).toHaveLength(1);
      expect(segundaPagina.data[0].fecha).toBe('2020-01-01');
    } finally {
      await detenerEntorno(server);
    }
  });

  test('rechaza paginación y orden inválidos', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });

      for (const query of ['page=0', 'page=abc', 'limit=51', 'orden=otro']) {
        const response = await pedir(baseUrl, `/api/visualizaciones?${query}`, { cookie });

        expect({ query, status: response.status }).toEqual({ query, status: 400 });
        expect((await response.json()).title).toBe('Datos inválidos');
      }
    } finally {
      await detenerEntorno(server);
    }
  });

  test('aísla el historial entre usuarios', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const cookieLucia = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const cookieTomas = await registrar(baseUrl, {
        nombreUsuario: 'tomas',
        email: 'tomas@example.com',
      });
      const pelicula = await guardarPelicula(container);

      const creada = await (
        await crearVisualizacion(baseUrl, cookieLucia, {
          peliculaId: pelicula.id,
          fecha: '2020-01-01',
        })
      ).json();

      const ruta = `/api/visualizaciones/${creada.id}`;

      expect((await pedir(baseUrl, ruta, { cookie: cookieLucia })).status).toBe(200);
      expect((await pedir(baseUrl, ruta, { cookie: cookieTomas })).status).toBe(404);
      expect(
        (
          await pedir(baseUrl, ruta, {
            cookie: cookieTomas,
            metodo: 'PATCH',
            cuerpo: { puntuacion: 1 },
          })
        ).status,
      ).toBe(404);
      expect((await pedir(baseUrl, ruta, { cookie: cookieTomas, metodo: 'DELETE' })).status).toBe(
        404,
      );

      const historialTomas = await (
        await pedir(baseUrl, '/api/visualizaciones', { cookie: cookieTomas })
      ).json();
      expect(historialTomas).toEqual({ data: [], page: 1, limit: 20, total: 0 });
    } finally {
      await detenerEntorno(server);
    }
  });

  test('actualiza fecha y puntuación de una visualización propia', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const pelicula = await guardarPelicula(container);

      const creada = await (
        await crearVisualizacion(baseUrl, cookie, {
          peliculaId: pelicula.id,
          fecha: '2020-01-01',
          puntuacion: 3,
        })
      ).json();

      const conFecha = await pedir(baseUrl, `/api/visualizaciones/${creada.id}`, {
        cookie,
        metodo: 'PATCH',
        cuerpo: { fecha: '2020-02-02' },
      });
      const cuerpoFecha = await conFecha.json();

      expect(conFecha.status).toBe(200);
      expect(cuerpoFecha.fecha).toBe('2020-02-02');
      expect(cuerpoFecha.puntuacion).toBe(3);

      const sinPuntuacion = await pedir(baseUrl, `/api/visualizaciones/${creada.id}`, {
        cookie,
        metodo: 'PATCH',
        cuerpo: { puntuacion: null },
      });

      expect(sinPuntuacion.status).toBe(200);
      expect((await sinPuntuacion.json()).puntuacion).toBeNull();

      const invalidos = [
        { cuerpo: {}, title: 'Solicitud inválida' },
        { cuerpo: { usuarioId: 'otro' }, title: 'Solicitud inválida' },
        { cuerpo: { fecha: '2999-01-01' }, title: 'Datos inválidos' },
        { cuerpo: { puntuacion: 0 }, title: 'Datos inválidos' },
      ];

      for (const caso of invalidos) {
        const response = await pedir(baseUrl, `/api/visualizaciones/${creada.id}`, {
          cookie,
          metodo: 'PATCH',
          cuerpo: caso.cuerpo,
        });

        expect({ cuerpo: caso.cuerpo, status: response.status }).toEqual({
          cuerpo: caso.cuerpo,
          status: 400,
        });
        expect((await response.json()).title).toBe(caso.title);
      }
    } finally {
      await detenerEntorno(server);
    }
  });

  test('elimina una visualización propia', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const pelicula = await guardarPelicula(container);

      const creada = await (
        await crearVisualizacion(baseUrl, cookie, {
          peliculaId: pelicula.id,
          fecha: '2020-01-01',
        })
      ).json();

      const borrada = await pedir(baseUrl, `/api/visualizaciones/${creada.id}`, {
        cookie,
        metodo: 'DELETE',
      });

      expect(borrada.status).toBe(204);

      expect((await pedir(baseUrl, `/api/visualizaciones/${creada.id}`, { cookie })).status).toBe(
        404,
      );
    } finally {
      await detenerEntorno(server);
    }
  });
});
