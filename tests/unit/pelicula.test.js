import { describe, expect, test } from '@jest/globals';
import { Pelicula } from '../../src/models/Pelicula.js';
import { ErrorDominio } from '../../src/utils/ErrorDominio.js';

const datosBase = {
  id: 'p1',
  tmdbId: 603,
  titulo: 'Matrix',
  sinopsis: 'Un programador descubre la verdadera naturaleza de su realidad.',
  anioEstreno: 1999,
  generos: ['Acción', 'Ciencia ficción'],
  rutaPoster: '/matrix.jpg',
};

describe('Pelicula', () => {
  test('toJSON y fromJSON conservan los datos', () => {
    const pelicula = new Pelicula(datosBase);
    const reconstruida = Pelicula.fromJSON(pelicula.toJSON());

    expect(reconstruida.toJSON()).toEqual(pelicula.toJSON());
  });

  test('generos devuelve una copia y no expone el arreglo interno', () => {
    const pelicula = new Pelicula(datosBase);
    const generos = pelicula.generos;

    generos.push('Terror');

    expect(pelicula.generos).toEqual(['Acción', 'Ciencia ficción']);
  });

  test('acepta una película sin póster ni sinopsis', () => {
    const pelicula = new Pelicula({
      ...datosBase,
      sinopsis: '',
      rutaPoster: null,
    });

    expect(pelicula.sinopsis).toBe('');
    expect(pelicula.rutaPoster).toBeNull();
  });

  test('rechaza un tmdbId no positivo', () => {
    expect(() => new Pelicula({ ...datosBase, tmdbId: 0 })).toThrow(ErrorDominio);
  });

  test('rechaza un año de estreno fuera de rango', () => {
    expect(() => new Pelicula({ ...datosBase, anioEstreno: 1500 })).toThrow(ErrorDominio);
  });

  test('rechaza géneros que no sean un arreglo de textos', () => {
    expect(() => new Pelicula({ ...datosBase, generos: 'Acción' })).toThrow(ErrorDominio);
  });
});
