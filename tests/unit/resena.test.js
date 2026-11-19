import { describe, expect, test } from '@jest/globals';
import { Resena } from '../../src/models/Resena.js';
import { ErrorDominio } from '../../src/utils/ErrorDominio.js';

const fechaPublicacion = new Date('2026-10-30T12:00:00.000Z');
const datosBase = {
  id: 'r1',
  usuarioId: 'u1',
  peliculaId: 'p1',
  comentario: '  Una película que invita a pensar.  ',
  fechaPublicacion,
};

describe('Resena', () => {
  test('recorta el comentario', () => {
    const resena = new Resena(datosBase);

    expect(resena.comentario).toBe('Una película que invita a pensar.');
  });

  test('rechaza comentarios vacíos o con solo espacios', () => {
    expect(() => new Resena({ ...datosBase, comentario: '   ' })).toThrow(ErrorDominio);
  });

  test('editar cambia el comentario y conserva la fecha de publicación', () => {
    const resena = new Resena(datosBase);

    resena.editar('  Cambio de opinión.  ');

    expect(resena.comentario).toBe('Cambio de opinión.');
    expect(resena.fechaPublicacion.toISOString()).toBe(fechaPublicacion.toISOString());
  });

  test('rechaza comentarios de más de 5000 caracteres', () => {
    expect(() => new Resena({ ...datosBase, comentario: 'a'.repeat(5001) })).toThrow(ErrorDominio);
  });

  test('toJSON y fromJSON conservan los datos y la fecha', () => {
    const resena = new Resena(datosBase);
    const reconstruida = Resena.fromJSON(resena.toJSON());

    expect(reconstruida.toJSON()).toEqual(resena.toJSON());
    expect(reconstruida.fechaPublicacion.toISOString()).toBe(fechaPublicacion.toISOString());
  });

  test('la puntuación es opcional y por defecto queda en null', () => {
    const resena = new Resena(datosBase);

    expect(resena.puntuacion).toBeNull();
    expect(resena.toJSON().puntuacion).toBeNull();
  });

  test('acepta una puntuación entera entre 1 y 5', () => {
    const resena = new Resena({ ...datosBase, puntuacion: 4 });

    expect(resena.puntuacion).toBe(4);
    expect(Resena.fromJSON(resena.toJSON()).puntuacion).toBe(4);
  });

  test('rechaza puntuaciones fuera de rango o con decimales', () => {
    for (const puntuacion of [0, 6, 3.5, '4']) {
      expect(() => new Resena({ ...datosBase, puntuacion })).toThrow(ErrorDominio);
    }
  });

  test('cambiarPuntuacion actualiza el valor y admite null para quitarla', () => {
    const resena = new Resena({ ...datosBase, puntuacion: 5 });

    resena.cambiarPuntuacion(2);
    expect(resena.puntuacion).toBe(2);

    resena.cambiarPuntuacion(null);
    expect(resena.puntuacion).toBeNull();
  });
});
