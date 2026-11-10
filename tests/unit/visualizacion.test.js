import { describe, expect, test } from '@jest/globals';
import { Visualizacion } from '../../src/models/Visualizacion.js';
import { ErrorDominio } from '../../src/utils/ErrorDominio.js';

const hoy = new Date(2026, 9, 30, 12, 0, 0);
const datosBase = {
  id: 'v1',
  usuarioId: 'u1',
  peliculaId: 'p1',
  fecha: '2026-10-30',
  puntuacion: 4,
};

describe('Visualizacion', () => {
  test('acepta una puntuación nula', () => {
    const visualizacion = new Visualizacion({ ...datosBase, puntuacion: null }, hoy);

    expect(visualizacion.puntuacion).toBeNull();
  });

  test('rechaza una fecha futura', () => {
    expect(() => new Visualizacion({ ...datosBase, fecha: '2026-10-31' }, hoy)).toThrow(
      ErrorDominio,
    );
  });

  test('rechaza una fecha que no existe en el calendario', () => {
    expect(() => new Visualizacion({ ...datosBase, fecha: '2026-02-30' }, hoy)).toThrow(
      ErrorDominio,
    );
  });

  test('rechaza puntuaciones fuera de 1 a 5 o no enteras', () => {
    for (const puntuacion of [0, 6, 1.5, '4']) {
      expect(() => new Visualizacion({ ...datosBase, puntuacion }, hoy)).toThrow(ErrorDominio);
    }
  });

  test('cambiarFecha valida la nueva fecha', () => {
    const visualizacion = new Visualizacion(datosBase, hoy);

    visualizacion.cambiarFecha('2026-10-29', hoy);
    expect(visualizacion.fecha).toBe('2026-10-29');

    expect(() => visualizacion.cambiarFecha('2026-11-01', hoy)).toThrow(ErrorDominio);
  });

  test('cambiarPuntuacion permite quitarla con null', () => {
    const visualizacion = new Visualizacion(datosBase, hoy);

    visualizacion.cambiarPuntuacion(null);

    expect(visualizacion.puntuacion).toBeNull();
  });

  test('toJSON y fromJSON conservan los datos', () => {
    const visualizacion = new Visualizacion(datosBase, hoy);
    const reconstruida = Visualizacion.fromJSON(visualizacion.toJSON(), hoy);

    expect(reconstruida.toJSON()).toEqual(visualizacion.toJSON());
  });
});
