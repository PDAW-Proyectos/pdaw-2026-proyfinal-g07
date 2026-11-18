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
  const cuerpo = await response.json();

  return { cookie: obtenerCookie(response), usuario: cuerpo.usuario };
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

function peliculaResumen(pelicula) {
  return pelicula.toResumenJSON();
}

describe('perfiles públicos', () => {
  test('devuelve datos públicos, métricas y favoritas sin exponer información privada', async () => {
    const reloj = crearReloj();
    const { container, server, baseUrl } = await iniciarEntorno({ ahora: reloj.ahora });

    try {
      const lucia = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const matrix = await guardarPelicula(container);
      const inception = await guardarPelicula(container, {
        id: 'p-inception',
        tmdbId: 27205,
        titulo: 'Inception',
        anioEstreno: 2010,
        generos: ['Ciencia ficción', 'Suspenso'],
      });
      const alien = await guardarPelicula(container, {
        id: 'p-alien',
        tmdbId: 348,
        titulo: 'Alien',
        anioEstreno: 1979,
        generos: ['Terror'],
      });

      await crearResena(baseUrl, lucia.cookie, {
        peliculaId: matrix.id,
        comentario: 'Una de mis favoritas.',
        puntuacion: 5,
      });
      reloj.avanzar(1_000);
      await crearResena(baseUrl, lucia.cookie, {
        peliculaId: inception.id,
        comentario: 'Muy buena.',
        puntuacion: 4,
      });
      reloj.avanzar(1_000);
      await crearResena(baseUrl, lucia.cookie, {
        peliculaId: alien.id,
        comentario: 'Sin nota.',
      });
      reloj.avanzar(1_000);

      const actualizacion = await pedir(baseUrl, `/api/usuarios/${lucia.usuario.id}/favoritas`, {
        cookie: lucia.cookie,
        metodo: 'PUT',
        cuerpo: { favoritas: [matrix.id, inception.id] },
      });

      expect(actualizacion.status).toBe(200);
      expect(await actualizacion.json()).toEqual({
        favoritas: [peliculaResumen(matrix), peliculaResumen(inception)],
      });

      const response = await pedir(baseUrl, `/api/usuarios/${lucia.usuario.id}`);
      const cuerpo = await response.json();

      expect(response.status).toBe(200);
      expect(cuerpo).toEqual({
        usuario: {
          id: lucia.usuario.id,
          nombre: 'Usuario lucia',
          nombreUsuario: 'lucia',
        },
        esPropio: false,
        estadisticas: {
          totalResenas: 3,
          peliculasResenadas: 3,
          totalPuntuadas: 2,
          promedioPuntuacion: 4.5,
          distribucionPuntuacion: {
            1: 0,
            2: 0,
            3: 0,
            4: 1,
            5: 1,
          },
        },
        favoritas: [peliculaResumen(matrix), peliculaResumen(inception)],
        mejorPuntuadas: [
          {
            ...peliculaResumen(matrix),
            puntuacion: 5,
          },
          {
            ...peliculaResumen(inception),
            puntuacion: 4,
          },
        ],
        afinidad: null,
      });
      expect(cuerpo.usuario).not.toHaveProperty('email');
      expect(cuerpo.usuario).not.toHaveProperty('hashContrasena');
      expect(cuerpo.usuario).not.toHaveProperty('rol');
      expect(cuerpo).not.toHaveProperty('visualizaciones');
      expect(cuerpo).not.toHaveProperty('watchlist');

      const resenas = await (
        await pedir(baseUrl, `/api/usuarios/${lucia.usuario.id}/resenas?page=1&limit=2`)
      ).json();

      expect(resenas).toMatchObject({ page: 1, limit: 2, total: 3 });
      expect(resenas.data).toHaveLength(2);
      expect(resenas.data[0].pelicula.id).toBe(alien.id);
      expect(resenas.data[1].pelicula.id).toBe(inception.id);
      expect(resenas.data[0].autor).toEqual(cuerpo.usuario);

      const segundaPagina = await (
        await pedir(baseUrl, `/api/usuarios/${lucia.usuario.id}/resenas?page=2&limit=2`)
      ).json();

      expect(segundaPagina.data).toHaveLength(1);
      expect(segundaPagina.data[0].pelicula.id).toBe(matrix.id);

      const pagina = await fetch(`${baseUrl}/usuario.html`);
      expect(pagina.status).toBe(200);
      expect(pagina.headers.get('content-type')).toContain('text/html');
    } finally {
      await detenerEntorno(server);
    }
  });

  test('calcula la afinidad con un mínimo de películas en común y la oculta en el perfil propio', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const lucia = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const tomas = await registrar(baseUrl, {
        nombreUsuario: 'tomas',
        email: 'tomas@example.com',
      });
      const caro = await registrar(baseUrl, {
        nombreUsuario: 'caro',
        email: 'caro@example.com',
      });
      const matrix = await guardarPelicula(container);
      const inception = await guardarPelicula(container, {
        id: 'p-inception',
        tmdbId: 27205,
        titulo: 'Inception',
        anioEstreno: 2010,
      });
      const alien = await guardarPelicula(container, {
        id: 'p-alien',
        tmdbId: 348,
        titulo: 'Alien',
        anioEstreno: 1979,
      });

      for (const [cookie, puntuaciones] of [
        [lucia.cookie, [5, 4, 3]],
        [tomas.cookie, [5, 2, 4]],
        [caro.cookie, [5, 4]],
      ]) {
        const peliculas = [matrix, inception, alien];

        for (const [indice, puntuacion] of puntuaciones.entries()) {
          await crearResena(baseUrl, cookie, {
            peliculaId: peliculas[indice].id,
            comentario: `Nota ${puntuacion}.`,
            puntuacion,
          });
        }
      }

      const perfilTomas = await (
        await pedir(baseUrl, `/api/usuarios/${tomas.usuario.id}`, { cookie: lucia.cookie })
      ).json();

      expect(perfilTomas.esPropio).toBe(false);
      expect(perfilTomas.afinidad).toEqual({
        porcentaje: 75,
        peliculasEnComun: 3,
        coincidencias: 1,
        minimoRequerido: 3,
        favoritasEnComun: 0,
        porcentajePuntuaciones: 75,
        porcentajeFavoritas: null,
      });

      const perfilCaro = await (
        await pedir(baseUrl, `/api/usuarios/${caro.usuario.id}`, { cookie: lucia.cookie })
      ).json();

      expect(perfilCaro.afinidad).toEqual({
        porcentaje: null,
        peliculasEnComun: 2,
        coincidencias: null,
        minimoRequerido: 3,
        favoritasEnComun: 0,
        porcentajePuntuaciones: null,
        porcentajeFavoritas: null,
      });

      const perfilPropio = await (
        await pedir(baseUrl, `/api/usuarios/${lucia.usuario.id}`, { cookie: lucia.cookie })
      ).json();

      expect(perfilPropio.esPropio).toBe(true);
      expect(perfilPropio.afinidad).toBeNull();

      const perfilInvitado = await (
        await pedir(baseUrl, `/api/usuarios/${tomas.usuario.id}`)
      ).json();

      expect(perfilInvitado.esPropio).toBe(false);
      expect(perfilInvitado.afinidad).toBeNull();
    } finally {
      await detenerEntorno(server);
    }
  });

  test('valida, autoriza y persiste la selección de hasta cinco favoritas', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const lucia = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const tomas = await registrar(baseUrl, {
        nombreUsuario: 'tomas',
        email: 'tomas@example.com',
      });
      const peliculas = [];

      for (let indice = 1; indice <= 6; indice += 1) {
        peliculas.push(
          await guardarPelicula(container, {
            id: `p-${indice}`,
            tmdbId: indice,
            titulo: `Película ${indice}`,
          }),
        );
      }

      const rutaLucia = `/api/usuarios/${lucia.usuario.id}/favoritas`;
      const rutaTomas = `/api/usuarios/${tomas.usuario.id}/favoritas`;

      const sinSesion = await pedir(baseUrl, rutaLucia, {
        metodo: 'PUT',
        cuerpo: { favoritas: [peliculas[0].id] },
      });

      expect(sinSesion.status).toBe(401);
      expect(await sinSesion.json()).toMatchObject({ title: 'Sesión requerida' });

      const ajena = await pedir(baseUrl, rutaTomas, {
        cookie: lucia.cookie,
        metodo: 'PUT',
        cuerpo: { favoritas: [peliculas[0].id] },
      });

      expect(ajena.status).toBe(403);
      expect(await ajena.json()).toMatchObject({ title: 'Acceso denegado' });

      const inexistente = await pedir(baseUrl, rutaLucia, {
        cookie: lucia.cookie,
        metodo: 'PUT',
        cuerpo: { favoritas: ['p-no-existe'] },
      });

      expect(inexistente.status).toBe(404);
      expect(await inexistente.json()).toMatchObject({
        title: 'Película no encontrada',
        detail: 'Una de las películas favoritas no existe.',
      });

      const exceso = await pedir(baseUrl, rutaLucia, {
        cookie: lucia.cookie,
        metodo: 'PUT',
        cuerpo: { favoritas: peliculas.map((pelicula) => pelicula.id) },
      });

      expect(exceso.status).toBe(400);
      expect(await exceso.json()).toMatchObject({ title: 'Datos inválidos' });

      const repetidas = await pedir(baseUrl, rutaLucia, {
        cookie: lucia.cookie,
        metodo: 'PUT',
        cuerpo: { favoritas: [peliculas[0].id, peliculas[0].id] },
      });

      expect(repetidas.status).toBe(400);
      expect(await repetidas.json()).toMatchObject({ title: 'Datos inválidos' });

      const tipoInvalido = await pedir(baseUrl, rutaLucia, {
        cookie: lucia.cookie,
        metodo: 'PUT',
        cuerpo: { favoritas: peliculas[0].id },
      });

      expect(tipoInvalido.status).toBe(400);

      const campoDesconocido = await pedir(baseUrl, rutaLucia, {
        cookie: lucia.cookie,
        metodo: 'PUT',
        cuerpo: { favoritas: [peliculas[0].id], otra: true },
      });

      expect(campoDesconocido.status).toBe(400);
      expect(await campoDesconocido.json()).toMatchObject({ title: 'Solicitud inválida' });

      const valida = await pedir(baseUrl, rutaLucia, {
        cookie: lucia.cookie,
        metodo: 'PUT',
        cuerpo: { favoritas: [peliculas[0].id, peliculas[1].id] },
      });

      expect(valida.status).toBe(200);
      expect(await valida.json()).toEqual({
        favoritas: [peliculaResumen(peliculas[0]), peliculaResumen(peliculas[1])],
      });

      const perfil = await (await pedir(baseUrl, `/api/usuarios/${lucia.usuario.id}`)).json();

      expect(perfil.favoritas).toEqual([
        peliculaResumen(peliculas[0]),
        peliculaResumen(peliculas[1]),
      ]);

      const vaciar = await pedir(baseUrl, rutaLucia, {
        cookie: lucia.cookie,
        metodo: 'PUT',
        cuerpo: { favoritas: [] },
      });

      expect(vaciar.status).toBe(200);
      expect(await vaciar.json()).toEqual({ favoritas: [] });
    } finally {
      await detenerEntorno(server);
    }
  });

  test('calcula afinidad con favoritas y la combina con las notas', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const lucia = await registrar(baseUrl, {
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
      });
      const tomas = await registrar(baseUrl, {
        nombreUsuario: 'tomas',
        email: 'tomas@example.com',
      });
      const caro = await registrar(baseUrl, {
        nombreUsuario: 'caro',
        email: 'caro@example.com',
      });
      const matrix = await guardarPelicula(container);
      const inception = await guardarPelicula(container, {
        id: 'p-inception',
        tmdbId: 27205,
        titulo: 'Inception',
        anioEstreno: 2010,
      });
      const alien = await guardarPelicula(container, {
        id: 'p-alien',
        tmdbId: 348,
        titulo: 'Alien',
        anioEstreno: 1979,
      });

      for (const [cookie, puntuaciones] of [
        [lucia.cookie, [5, 4, 3]],
        [tomas.cookie, [5, 2, 4]],
      ]) {
        for (const [indice, puntuacion] of puntuaciones.entries()) {
          await crearResena(baseUrl, cookie, {
            peliculaId: [matrix, inception, alien][indice].id,
            comentario: `Nota ${puntuacion}.`,
            puntuacion,
          });
        }
      }

      await pedir(baseUrl, `/api/usuarios/${lucia.usuario.id}/favoritas`, {
        cookie: lucia.cookie,
        metodo: 'PUT',
        cuerpo: { favoritas: [matrix.id, inception.id, alien.id] },
      });
      await pedir(baseUrl, `/api/usuarios/${tomas.usuario.id}/favoritas`, {
        cookie: tomas.cookie,
        metodo: 'PUT',
        cuerpo: { favoritas: [matrix.id, inception.id] },
      });
      await pedir(baseUrl, `/api/usuarios/${caro.usuario.id}/favoritas`, {
        cookie: caro.cookie,
        metodo: 'PUT',
        cuerpo: { favoritas: [matrix.id] },
      });

      const perfilTomas = await (
        await pedir(baseUrl, `/api/usuarios/${tomas.usuario.id}`, { cookie: lucia.cookie })
      ).json();

      expect(perfilTomas.afinidad).toEqual({
        porcentaje: 83,
        peliculasEnComun: 3,
        coincidencias: 1,
        minimoRequerido: 3,
        favoritasEnComun: 2,
        porcentajePuntuaciones: 75,
        porcentajeFavoritas: 100,
      });

      const perfilCaro = await (
        await pedir(baseUrl, `/api/usuarios/${caro.usuario.id}`, { cookie: lucia.cookie })
      ).json();

      expect(perfilCaro.afinidad).toEqual({
        porcentaje: 100,
        peliculasEnComun: 0,
        coincidencias: null,
        minimoRequerido: 3,
        favoritasEnComun: 1,
        porcentajePuntuaciones: null,
        porcentajeFavoritas: 100,
      });
    } finally {
      await detenerEntorno(server);
    }
  });

  test('responde 404 si el usuario no existe y valida la paginación de sus reseñas', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      const inexistente = await pedir(baseUrl, '/api/usuarios/no-existe');
      expect(inexistente.status).toBe(404);
      expect(await inexistente.json()).toMatchObject({
        title: 'No encontrado',
        status: 404,
        detail: 'El usuario no existe.',
      });

      const resenasInexistentes = await pedir(baseUrl, '/api/usuarios/no-existe/resenas');
      expect(resenasInexistentes.status).toBe(404);

      for (const query of ['page=0', 'page=abc', 'limit=51']) {
        const response = await pedir(baseUrl, `/api/usuarios/no-existe/resenas?${query}`);

        expect({ query, status: response.status }).toEqual({ query, status: 400 });
        expect((await response.json()).title).toBe('Datos inválidos');
      }
    } finally {
      await detenerEntorno(server);
    }
  });
});
