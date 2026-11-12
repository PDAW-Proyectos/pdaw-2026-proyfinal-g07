import { describe, expect, test } from '@jest/globals';
import { createApp } from '../../src/app.js';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import { ErrorDominio } from '../../src/utils/ErrorDominio.js';

const loggerSilencioso = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

async function iniciarApp() {
  const app = createApp({ logger: loggerSilencioso });
  const server = app.listen(0, '127.0.0.1');

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const { port } = server.address();

  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`,
  };
}

async function detenerApp(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

function crearRespuestaFalsa() {
  return {
    statusCode: undefined,
    tipo: undefined,
    cuerpo: undefined,
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    type(tipo) {
      this.tipo = tipo;
      return this;
    },
    json(cuerpo) {
      this.cuerpo = cuerpo;
      return this;
    },
  };
}

describe('base HTTP', () => {
  test('GET /api/salud responde el estado y devuelve un request id', async () => {
    const { server, baseUrl } = await iniciarApp();

    try {
      const response = await fetch(`${baseUrl}/api/salud`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(response.headers.get('x-request-id')).toBeTruthy();
      expect(await response.json()).toEqual({ estado: 'ok' });
    } finally {
      await detenerApp(server);
    }
  });

  test('reutiliza el X-Request-Id recibido', async () => {
    const { server, baseUrl } = await iniciarApp();

    try {
      const response = await fetch(`${baseUrl}/api/salud`, {
        headers: { 'X-Request-Id': 'prueba-123' },
      });

      expect(response.headers.get('x-request-id')).toBe('prueba-123');
    } finally {
      await detenerApp(server);
    }
  });

  test('agrega cabeceras de seguridad básicas', async () => {
    const { server, baseUrl } = await iniciarApp();

    try {
      const response = await fetch(`${baseUrl}/api/salud`);

      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    } finally {
      await detenerApp(server);
    }
  });

  test('una ruta inexistente responde problem details 404', async () => {
    const { server, baseUrl } = await iniciarApp();

    try {
      const response = await fetch(`${baseUrl}/api/ruta-inexistente`);
      const cuerpo = await response.json();

      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toContain('application/problem+json');
      expect(cuerpo).toMatchObject({
        type: 'about:blank',
        title: 'No encontrado',
        status: 404,
        instance: '/api/ruta-inexistente',
      });
      expect(cuerpo.requestId).toBe(response.headers.get('x-request-id'));
      expect(cuerpo).not.toHaveProperty('stack');
    } finally {
      await detenerApp(server);
    }
  });

  test('un cuerpo que no es JSON responde 415', async () => {
    const { server, baseUrl } = await iniciarApp();

    try {
      const response = await fetch(`${baseUrl}/api/salud`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'texto plano',
      });
      const cuerpo = await response.json();

      expect(response.status).toBe(415);
      expect(cuerpo.title).toBe('Tipo de contenido no soportado');
    } finally {
      await detenerApp(server);
    }
  });

  test('un JSON mal formado responde 400 sin exponer detalles internos', async () => {
    const { server, baseUrl } = await iniciarApp();

    try {
      const response = await fetch(`${baseUrl}/api/salud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      });
      const cuerpo = await response.json();

      expect(response.status).toBe(400);
      expect(cuerpo.title).toBe('Solicitud inválida');
      expect(cuerpo.detail).toBe('El cuerpo JSON no es válido.');
      expect(cuerpo).not.toHaveProperty('stack');
    } finally {
      await detenerApp(server);
    }
  });
});

describe('errorHandler', () => {
  test('traduce un ErrorDominio de validación a RFC 9457', () => {
    const req = { id: 'req-1', originalUrl: '/api/visualizaciones' };
    const res = crearRespuestaFalsa();

    errorHandler(loggerSilencioso)(
      new ErrorDominio('FORMATO_INVALIDO', 'El email no tiene un formato válido.', {
        campo: 'email',
      }),
      req,
      res,
      () => {},
    );

    expect(res.statusCode).toBe(400);
    expect(res.tipo).toBe('application/problem+json');
    expect(res.cuerpo).toMatchObject({
      type: 'about:blank',
      title: 'Datos inválidos',
      status: 400,
      detail: 'El email no tiene un formato válido.',
      instance: '/api/visualizaciones',
      requestId: 'req-1',
      errores: [{ campo: 'email', mensaje: 'El email no tiene un formato válido.' }],
    });
  });

  test('un error desconocido responde 500 con mensaje genérico', () => {
    const req = { id: 'req-2', originalUrl: '/api/desconocida' };
    const res = crearRespuestaFalsa();

    errorHandler(loggerSilencioso)(new Error('detalle interno'), req, res, () => {});

    expect(res.statusCode).toBe(500);
    expect(res.cuerpo).toMatchObject({
      type: 'about:blank',
      title: 'Error interno',
      status: 500,
      detail: 'Ocurrió un error inesperado.',
      instance: '/api/desconocida',
      requestId: 'req-2',
    });
    expect(res.cuerpo).not.toHaveProperty('stack');
    expect(res.cuerpo).not.toHaveProperty('errores');
  });
});
