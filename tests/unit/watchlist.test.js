import { describe, expect, test } from '@jest/globals';
import { EntradaWatchlist } from '../../src/models/EntradaWatchlist.js';
import { ErrorDominio } from '../../src/utils/ErrorDominio.js';

const fechaAgregado = new Date('2026-10-30T12:00:00.000Z');
const datosBase = {
  id: 'w1',
  usuarioId: 'u1',
  peliculaId: 'p1',
  fechaAgregado,
};

describe('EntradaWatchlist', () => {
  test('serializa la fecha de agregado en ISO 8601', () => {
    const entrada = new EntradaWatchlist(datosBase);

    expect(entrada.toJSON()).toEqual({
      id: 'w1',
      usuarioId: 'u1',
      peliculaId: 'p1',
      fechaAgregado: '2026-10-30T12:00:00.000Z',
    });
  });

  test('reconstruye la entrada desde datos persistidos', () => {
    const entrada = EntradaWatchlist.fromJSON({
      ...datosBase,
      fechaAgregado: '2026-10-30T12:00:00.000Z',
    });

    expect(entrada.id).toBe('w1');
    expect(entrada.usuarioId).toBe('u1');
    expect(entrada.peliculaId).toBe('p1');
    expect(entrada.fechaAgregado.toISOString()).toBe('2026-10-30T12:00:00.000Z');
  });

  test('devuelve una copia de la fecha para evitar mutaciones externas', () => {
    const entrada = new EntradaWatchlist(datosBase);
    const copia = entrada.fechaAgregado;

    copia.setUTCFullYear(2000);

    expect(entrada.fechaAgregado.toISOString()).toBe('2026-10-30T12:00:00.000Z');
  });

  test('rechaza fechas inválidas', () => {
    expect(() => new EntradaWatchlist({ ...datosBase, fechaAgregado: 'no-es-fecha' })).toThrow(
      ErrorDominio,
    );
  });

  test('rechaza películas vacías', () => {
    expect(() => new EntradaWatchlist({ ...datosBase, peliculaId: '   ' })).toThrow(ErrorDominio);
  });
});
