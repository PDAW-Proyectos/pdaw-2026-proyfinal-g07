import { describe, expect, test } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { createApp } from '../../src/app.js';
import { createContainer } from '../../src/container.js';
import { Usuario } from '../../src/models/Usuario.js';
import { MemoryStore } from '../../src/repositories/JsonStore.js';

const loggerSilencioso = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

function datosRegistro(overrides = {}) {
  return {
    nombre: 'Lucía Gómez',
    nombreUsuario: 'lucia',
    email: 'lucia@example.com',
    contrasena: 'secreto123',
    ...overrides,
  };
}

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

function datosLogin(overrides = {}) {
  return {
    identificador: 'lucia@example.com',
    contrasena: 'secreto123',
    ...overrides,
  };
}

function enviarRegistro(baseUrl, datos = datosRegistro()) {
  return fetch(`${baseUrl}/api/auth/registro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
}

function enviarLogin(baseUrl, datos = datosLogin()) {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
}

function obtenerCookie(response) {
  const setCookie = response.headers.get('set-cookie');
  return setCookie ? setCookie.split(';')[0] : null;
}

describe('auth', () => {
  test('registra un usuario, inicia sesión y no expone el hash', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      const response = await enviarRegistro(baseUrl);

      expect(response.status).toBe(201);
      expect(response.headers.get('location')).toBe('/api/auth/sesion');

      const cookie = response.headers.get('set-cookie');
      expect(cookie).toContain('fg_sesion=');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Expires=');

      const cuerpo = await response.json();
      expect(cuerpo.usuario).toEqual({
        id: expect.any(String),
        nombre: 'Lucía Gómez',
        nombreUsuario: 'lucia',
        email: 'lucia@example.com',
        rol: 'usuario',
      });
      expect(cuerpo.usuario).not.toHaveProperty('hashContrasena');

      const [usuario] = await container.usuarioRepository.listar();
      expect(usuario.hashContrasena).not.toBe('secreto123');
      expect(await bcrypt.compare('secreto123', usuario.hashContrasena)).toBe(true);

      const sesion = await fetch(`${baseUrl}/api/auth/sesion`, {
        headers: { Cookie: obtenerCookie(response) },
      });

      expect(await sesion.json()).toEqual({
        autenticado: true,
        usuario: cuerpo.usuario,
      });
    } finally {
      await detenerEntorno(server);
    }
  });

  test('inicia sesión con email y devuelve una cookie nueva', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      const registro = await enviarRegistro(baseUrl);
      const usuario = (await registro.json()).usuario;

      const respuesta = await enviarLogin(baseUrl);

      expect(respuesta.status).toBe(200);
      expect(respuesta.headers.get('set-cookie')).toContain('fg_sesion=');
      expect(await respuesta.json()).toEqual({ usuario });

      const sesion = await fetch(`${baseUrl}/api/auth/sesion`, {
        headers: { Cookie: obtenerCookie(respuesta) },
      });

      expect(await sesion.json()).toEqual({ autenticado: true, usuario });
    } finally {
      await detenerEntorno(server);
    }
  });

  test('inicia sesión con nombre de usuario sin distinguir mayúsculas', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      await enviarRegistro(baseUrl);

      const respuesta = await enviarLogin(baseUrl, datosLogin({ identificador: 'LUCIA' }));

      expect(respuesta.status).toBe(200);
      expect((await respuesta.json()).usuario.nombreUsuario).toBe('lucia');
    } finally {
      await detenerEntorno(server);
    }
  });

  test('rechaza credenciales inválidas sin revelar cuál falló', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      await enviarRegistro(baseUrl);

      const contrasenaIncorrecta = await enviarLogin(
        baseUrl,
        datosLogin({ contrasena: 'incorrecta' }),
      );
      const usuarioInexistente = await enviarLogin(
        baseUrl,
        datosLogin({ identificador: 'nadie@example.com' }),
      );

      for (const response of [contrasenaIncorrecta, usuarioInexistente]) {
        const cuerpo = await response.json();

        expect(response.status).toBe(401);
        expect(cuerpo).toMatchObject({
          type: 'about:blank',
          title: 'Credenciales inválidas',
          status: 401,
          detail: 'El identificador o la contraseña son incorrectos.',
        });
        expect(cuerpo).not.toHaveProperty('errores');
      }
    } finally {
      await detenerEntorno(server);
    }
  });

  test('GET /api/auth/sesion sin cookie responde sin autenticación', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      const response = await fetch(`${baseUrl}/api/auth/sesion`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ autenticado: false, usuario: null });
    } finally {
      await detenerEntorno(server);
    }
  });

  test('logout destruye la sesión y borra la cookie', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      const registro = await enviarRegistro(baseUrl);
      const cookie = obtenerCookie(registro);

      const logout = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Cookie: cookie },
      });

      expect(logout.status).toBe(204);
      expect(logout.headers.get('set-cookie')).toContain('fg_sesion=;');

      const sesion = await fetch(`${baseUrl}/api/auth/sesion`, {
        headers: { Cookie: cookie },
      });

      expect(await sesion.json()).toEqual({ autenticado: false, usuario: null });
    } finally {
      await detenerEntorno(server);
    }
  });

  test('rechaza un email duplicado sin distinguir mayúsculas', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      await enviarRegistro(baseUrl);

      const response = await enviarRegistro(
        baseUrl,
        datosRegistro({ email: 'LUCIA@example.com', nombreUsuario: 'otra-lucia' }),
      );
      const cuerpo = await response.json();

      expect(response.status).toBe(409);
      expect(cuerpo.title).toBe('Conflicto con el estado actual');
      expect(cuerpo.errores).toEqual([
        { campo: 'email', mensaje: 'Ya existe una cuenta con ese email.' },
      ]);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('rechaza un nombre de usuario duplicado', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      await enviarRegistro(baseUrl);

      const response = await enviarRegistro(
        baseUrl,
        datosRegistro({ email: 'otra@example.com', nombreUsuario: 'LUCIA' }),
      );
      const cuerpo = await response.json();

      expect(response.status).toBe(409);
      expect(cuerpo.errores).toEqual([
        { campo: 'nombreUsuario', mensaje: 'Ya existe una cuenta con ese nombre de usuario.' },
      ]);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('rechaza campos desconocidos', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      const response = await enviarRegistro(baseUrl, datosRegistro({ rol: 'admin' }));
      const cuerpo = await response.json();

      expect(response.status).toBe(400);
      expect(cuerpo.title).toBe('Solicitud inválida');
      expect(cuerpo.detail).toContain('Campos desconocidos: rol');
    } finally {
      await detenerEntorno(server);
    }
  });

  test('rechaza una contraseña demasiado corta', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      const response = await enviarRegistro(baseUrl, datosRegistro({ contrasena: 'corta' }));
      const cuerpo = await response.json();

      expect(response.status).toBe(400);
      expect(cuerpo.title).toBe('Datos inválidos');
      expect(cuerpo.errores[0].campo).toBe('contrasena');
    } finally {
      await detenerEntorno(server);
    }
  });

  test('rechaza una contraseña compuesta solo por espacios', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      const response = await enviarRegistro(baseUrl, datosRegistro({ contrasena: '        ' }));
      const cuerpo = await response.json();

      expect(response.status).toBe(400);
      expect(cuerpo.errores[0]).toMatchObject({ campo: 'contrasena' });
    } finally {
      await detenerEntorno(server);
    }
  });

  test('rechaza una contraseña de más de 72 bytes', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      const response = await enviarRegistro(baseUrl, datosRegistro({ contrasena: 'a'.repeat(73) }));
      const cuerpo = await response.json();

      expect(response.status).toBe(400);
      expect(cuerpo.errores[0]).toMatchObject({ campo: 'contrasena' });
      expect(cuerpo.detail).toContain('72');
    } finally {
      await detenerEntorno(server);
    }
  });

  test('mide la contraseña en bytes con caracteres multibyte', async () => {
    const { server, baseUrl } = await iniciarEntorno();
    const contrasena = 'ñ'.repeat(36);

    try {
      const registro = await enviarRegistro(
        baseUrl,
        datosRegistro({ nombreUsuario: 'ene', email: 'ene@example.com', contrasena }),
      );

      expect(registro.status).toBe(201);

      const correcta = await enviarLogin(baseUrl, datosLogin({ identificador: 'ene', contrasena }));
      expect(correcta.status).toBe(200);

      const demasiadoLarga = await enviarRegistro(
        baseUrl,
        datosRegistro({
          nombreUsuario: 'ene2',
          email: 'ene2@example.com',
          contrasena: 'ñ'.repeat(40),
        }),
      );

      expect(demasiadoLarga.status).toBe(400);
      expect((await demasiadoLarga.json()).detail).toContain('72');
    } finally {
      await detenerEntorno(server);
    }
  });

  test('mide los emojis por bytes y no por longitud de texto', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      const registro = await enviarRegistro(
        baseUrl,
        datosRegistro({
          nombreUsuario: 'emoji',
          email: 'emoji@example.com',
          contrasena: '😀'.repeat(18),
        }),
      );

      expect(registro.status).toBe(201);

      const demasiadoLarga = await enviarRegistro(
        baseUrl,
        datosRegistro({
          nombreUsuario: 'emoji2',
          email: 'emoji2@example.com',
          contrasena: '😀'.repeat(19),
        }),
      );

      expect(demasiadoLarga.status).toBe(400);
      expect((await demasiadoLarga.json()).detail).toContain('72');
    } finally {
      await detenerEntorno(server);
    }
  });

  test('no confunde dos contraseñas que comparten los primeros 72 bytes', async () => {
    const { server, baseUrl } = await iniciarEntorno();
    const contrasena = 'a'.repeat(72);

    try {
      const registro = await enviarRegistro(baseUrl, datosRegistro({ contrasena }));
      expect(registro.status).toBe(201);

      const correcta = await enviarLogin(
        baseUrl,
        datosLogin({ identificador: 'lucia', contrasena }),
      );
      expect(correcta.status).toBe(200);

      const distinta = await enviarLogin(
        baseUrl,
        datosLogin({ identificador: 'lucia', contrasena: 'a'.repeat(71) + 'b' }),
      );
      expect(distinta.status).toBe(401);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('bloquea los intentos después de cinco fallos de login', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      await enviarRegistro(baseUrl);

      for (let intento = 0; intento < 5; intento += 1) {
        const fallido = await enviarLogin(baseUrl, datosLogin({ contrasena: 'incorrecta' }));

        expect(fallido.status).toBe(401);
      }

      const bloqueado = await enviarLogin(baseUrl, datosLogin({ contrasena: 'incorrecta' }));

      expect(bloqueado.status).toBe(429);
      expect(bloqueado.headers.get('retry-after')).toMatch(/^\d+$/);
      expect(await bloqueado.json()).toMatchObject({
        title: 'Demasiadas solicitudes',
        status: 429,
      });
    } finally {
      await detenerEntorno(server);
    }
  });

  test('comparte el contador entre email y nombre de usuario', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      await enviarRegistro(baseUrl);

      for (let intento = 0; intento < 3; intento += 1) {
        const fallido = await enviarLogin(baseUrl, datosLogin({ contrasena: 'incorrecta' }));

        expect(fallido.status).toBe(401);
      }

      for (let intento = 0; intento < 2; intento += 1) {
        const fallido = await enviarLogin(
          baseUrl,
          datosLogin({ identificador: 'lucia', contrasena: 'incorrecta' }),
        );

        expect(fallido.status).toBe(401);
      }

      const bloqueado = await enviarLogin(
        baseUrl,
        datosLogin({ identificador: 'lucia', contrasena: 'incorrecta' }),
      );

      expect(bloqueado.status).toBe(429);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('bloquea identificadores que no corresponden a una cuenta', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      for (let intento = 0; intento < 5; intento += 1) {
        const fallido = await enviarLogin(
          baseUrl,
          datosLogin({ identificador: 'nadie@example.com', contrasena: 'incorrecta' }),
        );

        expect(fallido.status).toBe(401);
      }

      const bloqueado = await enviarLogin(
        baseUrl,
        datosLogin({ identificador: 'nadie@example.com', contrasena: 'incorrecta' }),
      );

      expect(bloqueado.status).toBe(429);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('un login exitoso reinicia el contador de intentos fallidos', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      await enviarRegistro(baseUrl);

      for (let intento = 0; intento < 4; intento += 1) {
        const fallido = await enviarLogin(baseUrl, datosLogin({ contrasena: 'incorrecta' }));

        expect(fallido.status).toBe(401);
      }

      expect((await enviarLogin(baseUrl)).status).toBe(200);

      for (let intento = 0; intento < 4; intento += 1) {
        const fallido = await enviarLogin(baseUrl, datosLogin({ contrasena: 'incorrecta' }));

        expect(fallido.status).toBe(401);
      }

      expect((await enviarLogin(baseUrl)).status).toBe(200);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('no aplica la longitud máxima de registro al login', async () => {
    const { server, baseUrl } = await iniciarEntorno();

    try {
      await enviarRegistro(baseUrl);

      const response = await enviarLogin(baseUrl, datosLogin({ contrasena: 'x'.repeat(101) }));

      expect(response.status).toBe(401);
    } finally {
      await detenerEntorno(server);
    }
  });

  test('permite iniciar sesión aunque la contraseña no cumpla la política actual', async () => {
    const { container, server, baseUrl } = await iniciarEntorno();

    try {
      await container.usuarioRepository.crear(
        new Usuario({
          id: 'u-vieja',
          nombre: 'Cuenta anterior',
          nombreUsuario: 'veterana',
          email: 'veterana@example.com',
          hashContrasena: await bcrypt.hash('clave', 4),
        }),
      );

      const response = await enviarLogin(
        baseUrl,
        datosLogin({ identificador: 'veterana', contrasena: 'clave' }),
      );

      expect(response.status).toBe(200);
      expect((await response.json()).usuario.nombreUsuario).toBe('veterana');
    } finally {
      await detenerEntorno(server);
    }
  });
});
