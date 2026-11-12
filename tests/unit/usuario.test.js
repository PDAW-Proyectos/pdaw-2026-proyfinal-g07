import { describe, expect, test } from '@jest/globals';
import { Usuario } from '../../src/models/Usuario.js';
import { ErrorDominio } from '../../src/utils/ErrorDominio.js';

const datosBase = {
  id: 'u1',
  nombre: 'Lucía',
  nombreUsuario: 'lucia',
  email: 'Lucia@Example.com',
  hashContrasena: 'hash-seguro',
};

describe('Usuario', () => {
  test('normaliza el email y el nombre de usuario', () => {
    const usuario = new Usuario({ ...datosBase, nombreUsuario: '  lucia_99 ' });

    expect(usuario.email).toBe('lucia@example.com');
    expect(usuario.nombreUsuario).toBe('lucia_99');
  });

  test('toPublicJSON excluye email y hash', () => {
    const usuario = new Usuario(datosBase);

    expect(usuario.toPublicJSON()).toEqual({
      id: 'u1',
      nombre: 'Lucía',
      nombreUsuario: 'lucia',
    });
  });

  test('toPrivateJSON incluye el email y el rol pero no el hash', () => {
    const usuario = new Usuario(datosBase);

    expect(usuario.toPrivateJSON()).toEqual({
      id: 'u1',
      nombre: 'Lucía',
      nombreUsuario: 'lucia',
      email: 'lucia@example.com',
      rol: 'usuario',
    });
    expect(usuario.toPrivateJSON()).not.toHaveProperty('hashContrasena');
  });

  test('asigna rol usuario por defecto y admite admin', () => {
    expect(new Usuario(datosBase).rol).toBe('usuario');
    expect(new Usuario({ ...datosBase, rol: 'admin' }).rol).toBe('admin');
  });

  test('toPublicJSON no incluye el rol', () => {
    const usuario = new Usuario({ ...datosBase, rol: 'admin' });

    expect(usuario.toPublicJSON()).not.toHaveProperty('rol');
  });

  test('rechaza un rol inválido', () => {
    expect(() => new Usuario({ ...datosBase, rol: 'superadmin' })).toThrow(ErrorDominio);
  });

  test('fromJSON interpreta los registros viejos sin rol como usuario', () => {
    expect(Usuario.fromJSON(datosBase).rol).toBe('usuario');
  });

  test('toJSON y fromJSON conservan los datos', () => {
    const usuario = new Usuario(datosBase);
    const reconstruido = Usuario.fromJSON(usuario.toJSON());

    expect(reconstruido.toJSON()).toEqual(usuario.toJSON());
  });

  test('rechaza un email inválido', () => {
    expect(() => new Usuario({ ...datosBase, email: 'lucia' })).toThrow(ErrorDominio);
  });

  test('rechaza un nombre de usuario con espacios', () => {
    expect(() => new Usuario({ ...datosBase, nombreUsuario: 'lucia perez' })).toThrow(ErrorDominio);
  });

  test('rechaza un nombre vacío', () => {
    expect(() => new Usuario({ ...datosBase, nombre: '   ' })).toThrow(ErrorDominio);
  });
});
