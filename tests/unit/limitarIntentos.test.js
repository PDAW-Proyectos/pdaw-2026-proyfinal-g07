import { describe, expect, test } from '@jest/globals';
import { limitarIntentos } from '../../src/middlewares/limitarIntentos.js';
import { ErrorDominio } from '../../src/utils/ErrorDominio.js';

function crearContexto({ ip = '10.0.0.1', identificador = 'lucia' } = {}) {
  const cabeceras = {};
  let alTerminar = null;

  const res = {
    statusCode: 200,
    set(nombre, valor) {
      cabeceras[nombre] = valor;
    },
    on(evento, manejador) {
      if (evento === 'finish') {
        alTerminar = manejador;
      }
    },
  };

  return {
    req: { ip, body: { identificador } },
    res,
    cabeceras,
    responder(statusCode) {
      res.statusCode = statusCode;
      alTerminar?.();
    },
  };
}

function ejecutar(middleware, contexto) {
  return new Promise((resolve) => {
    middleware(contexto.req, contexto.res, (error) => resolve(error ?? null));
  });
}

describe('limitarIntentos', () => {
  test('bloquea tras superar el máximo de fallos y envía Retry-After', async () => {
    let reloj = 0;
    const middleware = limitarIntentos({ max: 2, ventanaMs: 60_000, ahora: () => reloj });

    for (let intento = 0; intento < 2; intento += 1) {
      const contexto = crearContexto();

      expect(await ejecutar(middleware, contexto)).toBeNull();
      contexto.responder(401);
      reloj += 1_000;
    }

    const bloqueado = crearContexto();
    const error = await ejecutar(middleware, bloqueado);

    expect(error).toBeInstanceOf(ErrorDominio);
    expect(error.codigo).toBe('DEMASIADOS_INTENTOS');
    expect(bloqueado.cabeceras['Retry-After']).toBe('58');
  });

  test('vuelve a permitir intentos cuando vence la ventana', async () => {
    let reloj = 0;
    const middleware = limitarIntentos({ max: 1, ventanaMs: 1_000, ahora: () => reloj });

    const primero = crearContexto();
    expect(await ejecutar(middleware, primero)).toBeNull();
    primero.responder(401);

    const bloqueado = await ejecutar(middleware, crearContexto());
    expect(bloqueado.codigo).toBe('DEMASIADOS_INTENTOS');

    reloj = 1_000;

    expect(await ejecutar(middleware, crearContexto())).toBeNull();
  });

  test('un intento exitoso reinicia el contador', async () => {
    const middleware = limitarIntentos({ max: 2, ventanaMs: 60_000, ahora: () => 0 });

    const falloPrevio = crearContexto();
    expect(await ejecutar(middleware, falloPrevio)).toBeNull();
    falloPrevio.responder(401);

    const exitoso = crearContexto();
    expect(await ejecutar(middleware, exitoso)).toBeNull();
    exitoso.responder(200);

    for (let intento = 0; intento < 2; intento += 1) {
      const contexto = crearContexto();

      expect(await ejecutar(middleware, contexto)).toBeNull();
      contexto.responder(401);
    }

    expect((await ejecutar(middleware, crearContexto())).codigo).toBe('DEMASIADOS_INTENTOS');
  });

  test('no cuenta las respuestas de validación', async () => {
    const middleware = limitarIntentos({ max: 1, ventanaMs: 60_000, ahora: () => 0 });

    for (let intento = 0; intento < 5; intento += 1) {
      const contexto = crearContexto();

      expect(await ejecutar(middleware, contexto)).toBeNull();
      contexto.responder(400);
    }
  });

  test('acepta una función de clave asíncrona', async () => {
    const middleware = limitarIntentos({
      max: 1,
      ventanaMs: 60_000,
      ahora: () => 0,
      clave: async (req) => `cuenta:${req.body.identificador}`,
    });

    const primero = crearContexto({ identificador: 'lucia' });
    expect(await ejecutar(middleware, primero)).toBeNull();
    primero.responder(401);

    const bloqueado = await ejecutar(middleware, crearContexto({ identificador: 'lucia' }));

    expect(bloqueado.codigo).toBe('DEMASIADOS_INTENTOS');
  });

  test('separa los contadores por IP e identificador normalizado', async () => {
    const middleware = limitarIntentos({ max: 1, ventanaMs: 60_000, ahora: () => 0 });
    const fallido = crearContexto({ ip: '10.0.0.1', identificador: 'lucia' });

    expect(await ejecutar(middleware, fallido)).toBeNull();
    fallido.responder(401);

    const mismoIdentificador = crearContexto({ ip: '10.0.0.1', identificador: '  LUCIA ' });
    expect((await ejecutar(middleware, mismoIdentificador)).codigo).toBe('DEMASIADOS_INTENTOS');

    expect(
      await ejecutar(middleware, crearContexto({ ip: '10.0.0.2', identificador: 'lucia' })),
    ).toBeNull();

    expect(
      await ejecutar(middleware, crearContexto({ ip: '10.0.0.1', identificador: 'otra' })),
    ).toBeNull();
  });
});
