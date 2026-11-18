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

function agregarAWatchlist(baseUrl, cookie, cuerpo) {
  return pedir(baseUrl, '/api/watchlist', { cookie, metodo: 'POST', cuerpo });
}

describe('watchlist', () => {
  test('exige sesión en todas las rutas', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      const respuestas = await Promise.all([
        pedir(baseUrl, '/api/watchlist'),
        pedir(baseUrl, '/api/watchlist', {
          metodo: 'POST',
          cuerpo: { peliculaId: 'p1' },
        }),
        pedir(baseUrl, '/api/watchlist/p1'),
        pedir(baseUrl, '/api/watchlist/p1', { metodo: 'DELETE' }),
      ]);

      for (const respuesta of respuestas) {
        expect(respuesta.status).toBe(401);
        expect(await respuesta.json()).toMatchObject({ title: 'Sesión requerida', status: 401 });
      }
    } finally {
      await detenerEntorno(server);
    }
  });

  test('agrega una película y devuelve la representación de la watchlist', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const pelicula = await guardarPelicula(container);

      const response = await agregarAWatchlist(baseUrl, cookie, { peliculaId: pelicula.id });
      const cuerpo = await response.json();

      expect(response.status).toBe(201);
      expect(response.headers.get('location')).toBe('/api/watchlist/p-matrix');
      expect(cuerpo).toEqual({
        id: expect.any(String),
        fechaAgregado: expect.any(String),
        vista: false,
        pelicula: {
          id: 'p-matrix',
          tmdbId: 603,
          titulo: 'Matrix',
          anioEstreno: 1999,
          generos: ['Acción', 'Ciencia ficción'],
          puntuacionTmdb: null,
          rutaPoster: '/matrix.jpg',
          rutaBackdrop: '/matrix-backdrop.jpg',
        },
      });
      expect(Number.isNaN(Date.parse(cuerpo.fechaAgregado))).toBe(false);
      expect(cuerpo).not.toHaveProperty('usuarioId');
    } finally {
      await detenerEntorno(server);
    }
  });

  test('sincroniza el estado de vista con las visualizaciones del usuario', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const pelicula = await guardarPelicula(container);

      await agregarAWatchlist(baseUrl, cookie, { peliculaId: pelicula.id });

      const antes = await (await pedir(baseUrl, '/api/watchlist', { cookie })).json();
      expect(antes.data[0].vista).toBe(false);

      const visualizacion = await pedir(baseUrl, '/api/visualizaciones', {
        cookie,
        metodo: 'POST',
        cuerpo: { peliculaId: pelicula.id, fecha: '2020-05-01' },
      });
      expect(visualizacion.status).toBe(201);

      const despues = await (await pedir(baseUrl, '/api/watchlist', { cookie })).json();
      expect(despues.data[0].vista).toBe(true);

      const estado = await (
        await pedir(baseUrl, `/api/watchlist/${pelicula.id}`, { cookie })
      ).json();
      expect(estado.entrada.vista).toBe(true);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('rechaza películas inexistentes, datos inválidos y duplicados', async () => {
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
          cuerpo: { peliculaId: 'no-existe' },
          status: 404,
          title: 'Película no encontrada',
        },
        {
          nombre: 'cuerpo vacío',
          cuerpo: {},
          status: 400,
          title: 'Solicitud inválida',
        },
        {
          nombre: 'campo desconocido',
          cuerpo: { peliculaId: pelicula.id, usuarioId: 'otro' },
          status: 400,
          title: 'Solicitud inválida',
        },
        {
          nombre: 'identificador vacío',
          cuerpo: { peliculaId: '   ' },
          status: 400,
          title: 'Datos inválidos',
        },
      ];

      for (const caso of casos) {
        const response = await agregarAWatchlist(baseUrl, cookie, caso.cuerpo);
        const cuerpo = await response.json();

        expect({ caso: caso.nombre, status: response.status }).toEqual({
          caso: caso.nombre,
          status: caso.status,
        });
        expect(cuerpo.title).toBe(caso.title);
      }

      const primera = await agregarAWatchlist(baseUrl, cookie, { peliculaId: pelicula.id });
      expect(primera.status).toBe(201);

      const duplicada = await agregarAWatchlist(baseUrl, cookie, { peliculaId: pelicula.id });

      expect(duplicada.status).toBe(409);
      expect(await duplicada.json()).toMatchObject({
        title: 'Conflicto con el estado actual',
        status: 409,
      });
      expect(container.store.leer('watchlist')).toHaveLength(1);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('lista la watchlist propia con orden y paginación', async () => {
    let instante = Date.parse('2026-10-01T12:00:00.000Z');
    const container = await createContainer({
      store: new MemoryStore(),
      rondasHash: 4,
      ahora: () => new Date((instante += 60_000)),
    });
    const app = createApp({ logger: loggerSilencioso, container });
    const server = app.listen(0, '127.0.0.1');

    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const primera = await guardarPelicula(container);
      const segunda = await guardarPelicula(container, {
        id: 'p-arrival',
        tmdbId: 329865,
        titulo: 'La llegada',
        anioEstreno: 2016,
        rutaPoster: '/arrival.jpg',
        rutaBackdrop: null,
      });
      const tercera = await guardarPelicula(container, {
        id: 'p-dune',
        tmdbId: 438631,
        titulo: 'Dune',
        anioEstreno: 2021,
        rutaPoster: '/dune.jpg',
        rutaBackdrop: null,
      });

      await agregarAWatchlist(baseUrl, cookie, { peliculaId: primera.id });
      await agregarAWatchlist(baseUrl, cookie, { peliculaId: segunda.id });
      await agregarAWatchlist(baseUrl, cookie, { peliculaId: tercera.id });

      const porDefecto = await (await pedir(baseUrl, '/api/watchlist', { cookie })).json();

      expect(porDefecto).toMatchObject({ page: 1, limit: 20, total: 3 });
      expect(porDefecto.data.map((item) => item.pelicula.id)).toEqual([
        'p-dune',
        'p-arrival',
        'p-matrix',
      ]);
      expect(porDefecto.data[0]).not.toHaveProperty('usuarioId');

      const segundaPagina = await (
        await pedir(baseUrl, '/api/watchlist?page=2&limit=2', { cookie })
      ).json();

      expect(segundaPagina).toMatchObject({ page: 2, limit: 2, total: 3 });
      expect(segundaPagina.data).toHaveLength(1);
      expect(segundaPagina.data[0].pelicula.id).toBe('p-matrix');
    } finally {
      await detenerEntorno(server);
    }
  });

  test('rechaza paginación inválida', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });

      for (const query of ['page=0', 'page=abc', 'limit=0', 'limit=51']) {
        const response = await pedir(baseUrl, `/api/watchlist?${query}`, { cookie });

        expect({ query, status: response.status }).toEqual({ query, status: 400 });
        expect((await response.json()).title).toBe('Datos inválidos');
      }
    } finally {
      await detenerEntorno(server);
    }
  });

  test('consulta y quita una película de la watchlist', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const pelicula = await guardarPelicula(container);

      const antes = await (
        await pedir(baseUrl, `/api/watchlist/${pelicula.id}`, { cookie })
      ).json();
      expect(antes).toEqual({ enWatchlist: false });

      await agregarAWatchlist(baseUrl, cookie, { peliculaId: pelicula.id });

      const despues = await (
        await pedir(baseUrl, `/api/watchlist/${pelicula.id}`, { cookie })
      ).json();
      expect(despues).toMatchObject({
        enWatchlist: true,
        entrada: { id: expect.any(String), pelicula: { id: 'p-matrix' } },
      });

      const borrada = await pedir(baseUrl, `/api/watchlist/${pelicula.id}`, {
        cookie,
        metodo: 'DELETE',
      });
      expect(borrada.status).toBe(204);

      const final = await (
        await pedir(baseUrl, `/api/watchlist/${pelicula.id}`, { cookie })
      ).json();
      expect(final).toEqual({ enWatchlist: false });

      const repetida = await pedir(baseUrl, `/api/watchlist/${pelicula.id}`, {
        cookie,
        metodo: 'DELETE',
      });
      expect(repetida.status).toBe(404);
      expect((await repetida.json()).title).toBe('No encontrado');
    } finally {
      await detenerEntorno(server);
    }
  });

  test('aísla la watchlist entre usuarios', async () => {
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

      await agregarAWatchlist(baseUrl, cookieLucia, { peliculaId: pelicula.id });

      const watchlistTomas = await (
        await pedir(baseUrl, '/api/watchlist', { cookie: cookieTomas })
      ).json();
      expect(watchlistTomas).toEqual({ data: [], page: 1, limit: 20, total: 0 });

      const estadoTomas = await (
        await pedir(baseUrl, `/api/watchlist/${pelicula.id}`, { cookie: cookieTomas })
      ).json();
      expect(estadoTomas).toEqual({ enWatchlist: false });

      const borradoAjeno = await pedir(baseUrl, `/api/watchlist/${pelicula.id}`, {
        cookie: cookieTomas,
        metodo: 'DELETE',
      });
      expect(borradoAjeno.status).toBe(404);

      const watchlistLucia = await (
        await pedir(baseUrl, '/api/watchlist', { cookie: cookieLucia })
      ).json();
      expect(watchlistLucia.total).toBe(1);
      expect(watchlistLucia.data[0].pelicula.id).toBe('p-matrix');
    } finally {
      await detenerEntorno(server);
    }
  });
});
