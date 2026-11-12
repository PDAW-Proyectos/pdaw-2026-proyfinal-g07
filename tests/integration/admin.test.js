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

const ADMIN = {
  email: 'admin@example.com',
  password: 'admin-secreto',
  nombre: 'Administrador',
  nombreUsuario: 'admin',
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
  const cuerpo = await response.json();

  return { cookie: obtenerCookie(response), usuario: cuerpo.usuario };
}

async function iniciarSesion(baseUrl, { identificador, contrasena }) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador, contrasena }),
  });
  const cuerpo = await response.json();

  return { cookie: obtenerCookie(response), usuario: cuerpo.usuario };
}

async function crearAdmin(container, overrides = {}) {
  return container.adminService.asegurarAdmin({ ...ADMIN, ...overrides });
}

async function guardarPelicula(container) {
  const pelicula = new Pelicula({
    id: 'p-admin',
    tmdbId: 603,
    titulo: 'Matrix',
    sinopsis: 'Un programador descubre que el mundo es una simulación.',
    anioEstreno: 1999,
    generos: ['Acción'],
    rutaPoster: '/matrix.jpg',
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

function crearVisualizacion(baseUrl, cookie, cuerpo) {
  return pedir(baseUrl, '/api/visualizaciones', { cookie, metodo: 'POST', cuerpo });
}

describe('administración', () => {
  test('crea el administrador desde el entorno sin duplicarlo', async () => {
    const { container, server } = await iniciarEntorno();

    try {
      const primero = await crearAdmin(container);
      expect(primero.estado).toBe('creado');
      expect(primero.usuario.rol).toBe('admin');

      const segundo = await crearAdmin(container);
      expect(segundo.estado).toBe('existente');

      const admins = (await container.usuarioRepository.listar()).filter((u) => u.rol === 'admin');
      expect(admins).toHaveLength(1);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('no promueve una cuenta existente y valida las variables del bootstrap', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      await registrar(baseUrl, { nombreUsuario: 'lucia', email: 'lucia@example.com' });

      const conflicto = await crearAdmin(container, {
        email: 'lucia@example.com',
        nombreUsuario: 'admin2',
      });
      expect(conflicto.estado).toBe('conflicto');
      expect(conflicto.usuario.rol).toBe('usuario');

      await expect(
        container.adminService.asegurarAdmin({ email: 'solo@example.com' }),
      ).rejects.toThrow();
      await expect(
        container.adminService.asegurarAdmin({ email: 'otro@example.com', password: 'corta' }),
      ).rejects.toMatchObject({ codigo: 'LONGITUD_INVALIDA' });
      expect(await container.adminService.asegurarAdmin({})).toBeNull();
    } finally {
      await detenerEntorno(server);
    }
  });

  test('exige rol admin y lista las cuentas sin el hash', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const lucia = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const admin = await crearAdmin(container);
      const sesionAdmin = await iniciarSesion(baseUrl, {
        identificador: ADMIN.email,
        contrasena: ADMIN.password,
      });

      expect((await pedir(baseUrl, '/api/admin/usuarios')).status).toBe(401);
      expect((await pedir(baseUrl, '/api/admin/usuarios', { cookie: lucia.cookie })).status).toBe(
        403,
      );
      expect(
        (
          await pedir(baseUrl, `/api/admin/usuarios/${lucia.usuario.id}`, {
            cookie: lucia.cookie,
            metodo: 'DELETE',
          })
        ).status,
      ).toBe(403);

      const respuesta = await pedir(baseUrl, '/api/admin/usuarios', { cookie: sesionAdmin.cookie });
      const cuerpo = await respuesta.json();

      expect(respuesta.status).toBe(200);
      expect(cuerpo).toMatchObject({ page: 1, limit: 20, total: 2 });

      const cuentas = Object.fromEntries(
        cuerpo.data.map((cuenta) => [cuenta.nombreUsuario, cuenta]),
      );
      expect(cuentas.admin).toMatchObject({ rol: 'admin', email: ADMIN.email });
      expect(cuentas.lucia).toMatchObject({ rol: 'usuario', email: 'lucia@example.com' });

      for (const cuenta of cuerpo.data) {
        expect(cuenta).not.toHaveProperty('hashContrasena');
        expect(cuenta).toHaveProperty('rol');
        expect(cuenta).toHaveProperty('email');
      }

      expect(admin.usuario.rol).toBe('admin');
      expect(
        (await pedir(baseUrl, '/api/admin/usuarios?page=0', { cookie: sesionAdmin.cookie })).status,
      ).toBe(400);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('el admin puede eliminar cualquier reseña', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const lucia = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const pelicula = await guardarPelicula(container);
      const resena = await (
        await crearResena(baseUrl, lucia.cookie, {
          peliculaId: pelicula.id,
          comentario: 'Una reseña para moderar.',
        })
      ).json();
      await crearAdmin(container);
      const sesionAdmin = await iniciarSesion(baseUrl, {
        identificador: ADMIN.email,
        contrasena: ADMIN.password,
      });

      const borrada = await pedir(baseUrl, `/api/admin/resenas/${resena.id}`, {
        cookie: sesionAdmin.cookie,
        metodo: 'DELETE',
      });
      expect(borrada.status).toBe(204);
      expect((await pedir(baseUrl, `/api/resenas/${resena.id}`)).status).toBe(404);

      const recientes = await (await pedir(baseUrl, '/api/resenas/recientes')).json();
      expect(recientes.total).toBe(0);

      expect(
        (
          await pedir(baseUrl, '/api/admin/resenas/no-existe', {
            cookie: sesionAdmin.cookie,
            metodo: 'DELETE',
          })
        ).status,
      ).toBe(404);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('elimina una cuenta en cascada e invalida su sesión', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const lucia = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const pelicula = await guardarPelicula(container);

      await crearResena(baseUrl, lucia.cookie, {
        peliculaId: pelicula.id,
        comentario: 'Reseña de Lucía.',
      });
      await crearVisualizacion(baseUrl, lucia.cookie, {
        peliculaId: pelicula.id,
        fecha: '2020-01-01',
      });

      await crearAdmin(container);
      const sesionAdmin = await iniciarSesion(baseUrl, {
        identificador: ADMIN.email,
        contrasena: ADMIN.password,
      });

      const borrado = await pedir(baseUrl, `/api/admin/usuarios/${lucia.usuario.id}`, {
        cookie: sesionAdmin.cookie,
        metodo: 'DELETE',
      });

      expect(borrado.status).toBe(204);
      expect(container.store.leer('usuarios').some((u) => u.id === lucia.usuario.id)).toBe(false);
      expect(container.store.leer('resenas')).toHaveLength(0);
      expect(container.store.leer('visualizaciones')).toHaveLength(0);

      // La cookie vieja ya no sirve para las rutas protegidas.
      expect((await pedir(baseUrl, '/api/resenas/mias', { cookie: lucia.cookie })).status).toBe(
        401,
      );
      expect((await pedir(baseUrl, '/api/visualizaciones', { cookie: lucia.cookie })).status).toBe(
        401,
      );

      const login = await iniciarSesion(baseUrl, {
        identificador: 'lucia@example.com',
        contrasena: 'secreto123',
      });
      expect(login.cookie).toBeNull();
    } finally {
      await detenerEntorno(server);
    }
  });

  test('el admin no puede eliminarse a sí mismo', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const admin = await crearAdmin(container);
      const sesionAdmin = await iniciarSesion(baseUrl, {
        identificador: ADMIN.email,
        contrasena: ADMIN.password,
      });

      const response = await pedir(baseUrl, `/api/admin/usuarios/${admin.usuario.id}`, {
        cookie: sesionAdmin.cookie,
        metodo: 'DELETE',
      });

      expect(response.status).toBe(403);
      expect(await container.usuarioRepository.buscarPorId(admin.usuario.id)).not.toBeNull();
    } finally {
      await detenerEntorno(server);
    }
  });

  test('responde 404 al eliminar una cuenta inexistente', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      await crearAdmin(container);
      const sesionAdmin = await iniciarSesion(baseUrl, {
        identificador: ADMIN.email,
        contrasena: ADMIN.password,
      });

      const response = await pedir(
        baseUrl,
        '/api/admin/usuarios/00000000-0000-4000-8000-000000000000',
        {
          cookie: sesionAdmin.cookie,
          metodo: 'DELETE',
        },
      );

      expect(response.status).toBe(404);
    } finally {
      await detenerEntorno(server);
    }
  });
});
