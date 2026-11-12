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

function crearResena(baseUrl, cookie, cuerpo) {
  return pedir(baseUrl, '/api/resenas', { cookie, metodo: 'POST', cuerpo });
}

function crearReloj() {
  let instante = new Date('2026-01-01T00:00:00.000Z');

  return {
    ahora: () => new Date(instante),
    avanzar(ms) {
      instante = new Date(instante.getTime() + ms);
    },
  };
}

describe('resenas', () => {
  test('crea una reseña y la expone públicamente sin datos privados', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const pelicula = await guardarPelicula(container);

      const response = await crearResena(baseUrl, cookie, {
        peliculaId: pelicula.id,
        comentario: '  Una película que invita a pensar.  ',
      });
      const cuerpo = await response.json();

      expect(response.status).toBe(201);
      expect(response.headers.get('location')).toMatch(/^\/api\/resenas\/[0-9a-f-]{36}$/);
      expect(cuerpo).toEqual({
        id: expect.any(String),
        comentario: 'Una película que invita a pensar.',
        fechaPublicacion: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        autor: {
          id: expect.any(String),
          nombre: 'Usuario lucia',
          nombreUsuario: 'lucia',
        },
        pelicula: {
          id: 'p-matrix',
          tmdbId: 603,
          titulo: 'Matrix',
          anioEstreno: 1999,
          rutaPoster: '/matrix.jpg',
          rutaBackdrop: '/matrix-backdrop.jpg',
        },
      });
      expect(cuerpo.autor).not.toHaveProperty('email');
      expect(cuerpo.autor).not.toHaveProperty('hashContrasena');
      expect(cuerpo).not.toHaveProperty('usuarioId');

      const publica = await pedir(baseUrl, `/api/resenas/${cuerpo.id}`);
      expect(publica.status).toBe(200);
      expect((await publica.json()).comentario).toBe('Una película que invita a pensar.');

      const recientes = await (await pedir(baseUrl, '/api/resenas/recientes')).json();
      expect(recientes).toMatchObject({ page: 1, limit: 20, total: 1 });
      expect(recientes.data[0].autor).toEqual(cuerpo.autor);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('exige sesión para las operaciones privadas', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      const respuestas = await Promise.all([
        crearResena(baseUrl, null, { peliculaId: 'p1', comentario: 'Hola' }),
        pedir(baseUrl, '/api/resenas/mias'),
        pedir(baseUrl, '/api/resenas/v1', { metodo: 'PATCH', cuerpo: { comentario: 'Hola' } }),
        pedir(baseUrl, '/api/resenas/v1', { metodo: 'DELETE' }),
      ]);

      for (const respuesta of respuestas) {
        expect(respuesta.status).toBe(401);
        expect(await respuesta.json()).toMatchObject({ title: 'Sesión requerida', status: 401 });
      }
    } finally {
      await detenerEntorno(server);
    }
  });

  test('valida el comentario, la película y la reseña única', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const pelicula = await guardarPelicula(container);

      const casos = [
        {
          nombre: 'comentario en blanco',
          cuerpo: { peliculaId: pelicula.id, comentario: '   ' },
          status: 400,
          title: 'Datos inválidos',
        },
        {
          nombre: 'comentario demasiado largo',
          cuerpo: { peliculaId: pelicula.id, comentario: 'a'.repeat(5001) },
          status: 400,
          title: 'Datos inválidos',
        },
        {
          nombre: 'película inexistente',
          cuerpo: { peliculaId: 'no-existe', comentario: 'Hola' },
          status: 404,
          title: 'Película no encontrada',
        },
        {
          nombre: 'campo desconocido',
          cuerpo: { peliculaId: pelicula.id, comentario: 'Hola', autor: 'otro' },
          status: 400,
          title: 'Solicitud inválida',
        },
      ];

      for (const caso of casos) {
        const response = await crearResena(baseUrl, cookie, caso.cuerpo);
        const cuerpo = await response.json();

        expect({ caso: caso.nombre, status: response.status }).toEqual({
          caso: caso.nombre,
          status: caso.status,
        });
        expect(cuerpo.title).toBe(caso.title);
      }

      const primera = await crearResena(baseUrl, cookie, {
        peliculaId: pelicula.id,
        comentario: 'Primera reseña',
      });
      expect(primera.status).toBe(201);

      const duplicada = await crearResena(baseUrl, cookie, {
        peliculaId: pelicula.id,
        comentario: 'Segunda reseña',
      });
      const cuerpoDuplicada = await duplicada.json();

      expect(duplicada.status).toBe(409);
      expect(cuerpoDuplicada.title).toBe('Conflicto con el estado actual');
      expect(cuerpoDuplicada.errores).toEqual([
        { campo: 'peliculaId', mensaje: 'Ya existe una reseña de este usuario para la película.' },
      ]);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('lista solo las reseñas propias y protege la autoría', async () => {
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

      const deLucia = await (
        await crearResena(baseUrl, cookieLucia, {
          peliculaId: pelicula.id,
          comentario: 'De Lucía',
        })
      ).json();
      const deTomas = await (
        await crearResena(baseUrl, cookieTomas, {
          peliculaId: pelicula.id,
          comentario: 'De Tomás',
        })
      ).json();

      const miasDeLucia = await (
        await pedir(baseUrl, '/api/resenas/mias', { cookie: cookieLucia })
      ).json();
      expect(miasDeLucia.total).toBe(1);
      expect(miasDeLucia.data[0].id).toBe(deLucia.id);

      const miasDeTomas = await (
        await pedir(baseUrl, '/api/resenas/mias', { cookie: cookieTomas })
      ).json();
      expect(miasDeTomas.total).toBe(1);
      expect(miasDeTomas.data[0].id).toBe(deTomas.id);

      const patchAjeno = await pedir(baseUrl, `/api/resenas/${deTomas.id}`, {
        cookie: cookieLucia,
        metodo: 'PATCH',
        cuerpo: { comentario: 'Hackeada' },
      });
      expect(patchAjeno.status).toBe(403);
      expect((await patchAjeno.json()).title).toBe('Acceso denegado');

      const deleteAjeno = await pedir(baseUrl, `/api/resenas/${deTomas.id}`, {
        cookie: cookieLucia,
        metodo: 'DELETE',
      });
      expect(deleteAjeno.status).toBe(403);

      const patchPropio = await pedir(baseUrl, `/api/resenas/${deLucia.id}`, {
        cookie: cookieLucia,
        metodo: 'PATCH',
        cuerpo: { comentario: 'Editada por su autora' },
      });
      expect(patchPropio.status).toBe(200);
      expect((await patchPropio.json()).comentario).toBe('Editada por su autora');

      const deletePropio = await pedir(baseUrl, `/api/resenas/${deLucia.id}`, {
        cookie: cookieLucia,
        metodo: 'DELETE',
      });
      expect(deletePropio.status).toBe(204);

      expect((await pedir(baseUrl, `/api/resenas/${deLucia.id}`)).status).toBe(404);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('valida la edición de una reseña', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const cookie = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const pelicula = await guardarPelicula(container);

      const creada = await (
        await crearResena(baseUrl, cookie, {
          peliculaId: pelicula.id,
          comentario: 'Original',
        })
      ).json();

      const invalidos = [
        { cuerpo: {}, title: 'Solicitud inválida' },
        { cuerpo: { autor: 'otro' }, title: 'Solicitud inválida' },
        { cuerpo: { comentario: '   ' }, title: 'Datos inválidos' },
        { cuerpo: { comentario: 'a'.repeat(5001) }, title: 'Datos inválidos' },
      ];

      for (const caso of invalidos) {
        const response = await pedir(baseUrl, `/api/resenas/${creada.id}`, {
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

      const inexistente = await pedir(baseUrl, '/api/resenas/no-existe', {
        cookie,
        metodo: 'PATCH',
        cuerpo: { comentario: 'Hola' },
      });
      expect(inexistente.status).toBe(404);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('ordena las recientes por fecha y pagina', async () => {
    const reloj = crearReloj();
    const { container, server, baseUrl } = await iniciarEntorno({ ahora: reloj.ahora });

    try {
      const pelicula = await guardarPelicula(container);
      const cookies = [];

      for (const [nombreUsuario, email] of [
        ['lucia', 'lucia@example.com'],
        ['tomas', 'tomas@example.com'],
        ['caro', 'caro@example.com'],
      ]) {
        cookies.push(await registrar(baseUrl, { nombreUsuario, email }));
      }

      const ids = [];

      for (const cookie of cookies) {
        const creada = await (
          await crearResena(baseUrl, cookie, {
            peliculaId: pelicula.id,
            comentario: `Reseña ${ids.length + 1}`,
          })
        ).json();

        ids.push(creada.id);
        reloj.avanzar(1_000);
      }

      const recientes = await (await pedir(baseUrl, '/api/resenas/recientes')).json();

      expect(recientes.total).toBe(3);
      expect(recientes.data.map((resena) => resena.id)).toEqual([ids[2], ids[1], ids[0]]);

      const segundaPagina = await (
        await pedir(baseUrl, '/api/resenas/recientes?page=2&limit=2')
      ).json();
      expect(segundaPagina).toMatchObject({ page: 2, limit: 2, total: 3 });
      expect(segundaPagina.data).toHaveLength(1);
      expect(segundaPagina.data[0].id).toBe(ids[0]);

      for (const query of ['page=0', 'page=abc', 'limit=51']) {
        const response = await pedir(baseUrl, `/api/resenas/recientes?${query}`);

        expect({ query, status: response.status }).toEqual({ query, status: 400 });
        expect((await response.json()).title).toBe('Datos inválidos');
      }
    } finally {
      await detenerEntorno(server);
    }
  });
});
