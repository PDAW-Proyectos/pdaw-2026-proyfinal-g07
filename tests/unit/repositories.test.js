import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContainer } from '../../src/container.js';
import { Usuario } from '../../src/models/Usuario.js';
import { Pelicula } from '../../src/models/Pelicula.js';
import { Visualizacion } from '../../src/models/Visualizacion.js';
import { Resena } from '../../src/models/Resena.js';
import { JsonStore, MemoryStore } from '../../src/repositories/JsonStore.js';

function crearUsuario(overrides = {}) {
  return new Usuario({
    id: 'u1',
    nombre: 'Lucía',
    nombreUsuario: 'lucia',
    email: 'lucia@example.com',
    hashContrasena: 'hash',
    ...overrides,
  });
}

function crearPelicula(overrides = {}) {
  return new Pelicula({
    id: 'p1',
    tmdbId: 603,
    titulo: 'Matrix',
    sinopsis: 'Un programador descubre la verdadera naturaleza de su realidad.',
    anioEstreno: 1999,
    generos: ['Acción', 'Ciencia ficción'],
    rutaPoster: '/matrix.jpg',
    ...overrides,
  });
}

function crearVisualizacion(overrides = {}) {
  return new Visualizacion(
    {
      id: 'v1',
      usuarioId: 'u1',
      peliculaId: 'p1',
      fecha: '2020-01-01',
      puntuacion: 4,
      ...overrides,
    },
    new Date(2026, 9, 30, 12, 0, 0),
  );
}

function crearResena(overrides = {}) {
  return new Resena({
    id: 'r1',
    usuarioId: 'u1',
    peliculaId: 'p1',
    comentario: 'Una película que invita a pensar.',
    fechaPublicacion: new Date('2020-01-01T12:00:00.000Z'),
    ...overrides,
  });
}

/**
 * Ejecuta la misma suite de contrato contra distintos stores.
 */
function suiteRepositorios(nombre, crearRecurso) {
  describe(nombre, () => {
    let usuarioRepository;
    let peliculaRepository;
    let visualizacionRepository;
    let resenaRepository;
    let limpiar;

    beforeEach(async () => {
      const recurso = await crearRecurso();
      limpiar = recurso.limpiar;

      const contenedor = await createContainer({ store: recurso.store, rondasHash: 4 });
      usuarioRepository = contenedor.usuarioRepository;
      peliculaRepository = contenedor.peliculaRepository;
      visualizacionRepository = contenedor.visualizacionRepository;
      resenaRepository = contenedor.resenaRepository;
    });

    afterEach(async () => {
      if (limpiar) {
        await limpiar();
      }
    });

    test('UsuarioRepository crea y busca por id, email, nombre de usuario e identificador', async () => {
      const usuario = crearUsuario();

      await usuarioRepository.crear(usuario);

      expect((await usuarioRepository.buscarPorId('u1')).toJSON()).toEqual(usuario.toJSON());
      expect((await usuarioRepository.buscarPorEmail('LUCIA@EXAMPLE.COM')).id).toBe('u1');
      expect((await usuarioRepository.buscarPorNombreUsuario('LUCIA')).id).toBe('u1');
      expect((await usuarioRepository.buscarPorIdentificador('lucia@example.com')).id).toBe('u1');
      expect((await usuarioRepository.buscarPorIdentificador('lucia')).id).toBe('u1');
    });

    test('UsuarioRepository rechaza email y nombre de usuario duplicados sin distinguir mayúsculas', async () => {
      await usuarioRepository.crear(crearUsuario());

      await expect(
        usuarioRepository.crear(
          crearUsuario({
            id: 'u2',
            nombreUsuario: 'otra',
            email: 'LUCIA@EXAMPLE.COM',
          }),
        ),
      ).rejects.toMatchObject({ codigo: 'EMAIL_DUPLICADO' });

      await expect(
        usuarioRepository.crear(
          crearUsuario({
            id: 'u3',
            nombreUsuario: 'LUCIA',
            email: 'otra@example.com',
          }),
        ),
      ).rejects.toMatchObject({ codigo: 'NOMBRE_USUARIO_DUPLICADO' });
    });

    test('PeliculaRepository guarda y recupera por id y tmdbId', async () => {
      const pelicula = crearPelicula();

      await peliculaRepository.guardar(pelicula);

      expect((await peliculaRepository.buscarPorId('p1')).toJSON()).toEqual(pelicula.toJSON());
      expect((await peliculaRepository.buscarPorTmdbId(603)).id).toBe('p1');
    });

    test('PeliculaRepository actualiza por tmdbId sin cambiar el id interno', async () => {
      await peliculaRepository.guardar(crearPelicula());

      const actualizada = await peliculaRepository.guardar(
        crearPelicula({
          id: 'p2',
          titulo: 'Matrix Reloaded',
          tmdbId: 603,
        }),
      );

      expect(actualizada.id).toBe('p1');
      expect((await peliculaRepository.buscarPorTmdbId(603)).titulo).toBe('Matrix Reloaded');
      expect(await peliculaRepository.listar()).toHaveLength(1);
    });

    test('PeliculaRepository rechaza un id interno duplicado con otro tmdbId', async () => {
      await peliculaRepository.guardar(crearPelicula());

      await expect(
        peliculaRepository.guardar(crearPelicula({ tmdbId: 604 })),
      ).rejects.toMatchObject({ codigo: 'ID_DUPLICADO' });
    });

    test('VisualizacionRepository lista solo las visualizaciones del usuario', async () => {
      await visualizacionRepository.crear(crearVisualizacion());
      await visualizacionRepository.crear(crearVisualizacion({ id: 'v2', usuarioId: 'u2' }));

      const visualizaciones = await visualizacionRepository.listarPorUsuario('u1');

      expect(visualizaciones.map((visualizacion) => visualizacion.id)).toEqual(['v1']);
    });

    test('VisualizacionRepository actualiza y elimina registros', async () => {
      await visualizacionRepository.crear(crearVisualizacion());

      const visualizacion = await visualizacionRepository.buscarPorId('v1');
      visualizacion.cambiarPuntuacion(5);
      await visualizacionRepository.actualizar(visualizacion);

      expect((await visualizacionRepository.buscarPorId('v1')).puntuacion).toBe(5);
      expect(await visualizacionRepository.eliminar('v1')).toBe(true);
      expect(await visualizacionRepository.buscarPorId('v1')).toBeNull();
    });

    test('ResenaRepository crea, busca y rechaza duplicados por usuario y película', async () => {
      await resenaRepository.crear(crearResena());

      expect((await resenaRepository.buscarPorUsuarioYPelicula('u1', 'p1')).id).toBe('r1');

      await expect(resenaRepository.crear(crearResena({ id: 'r2' }))).rejects.toMatchObject({
        codigo: 'RESENA_DUPLICADA',
      });
    });

    test('ResenaRepository actualiza, lista y elimina reseñas', async () => {
      await resenaRepository.crear(crearResena());

      const resena = await resenaRepository.buscarPorId('r1');
      resena.editar('Cambio de opinión.');
      await resenaRepository.actualizar(resena);

      expect((await resenaRepository.buscarPorId('r1')).comentario).toBe('Cambio de opinión.');
      expect(await resenaRepository.listarPorPelicula('p1')).toHaveLength(1);
      expect(await resenaRepository.listarPorUsuario('u1')).toHaveLength(1);
      expect(await resenaRepository.eliminar('r1')).toBe(true);
      expect(await resenaRepository.buscarPorId('r1')).toBeNull();
    });
  });
}

suiteRepositorios('Repositorios con MemoryStore', async () => ({
  store: new MemoryStore(),
  limpiar: null,
}));

suiteRepositorios('Repositorios con JsonStore', async () => {
  const directorio = await mkdtemp(join(tmpdir(), 'fotograma-repos-'));
  const store = new JsonStore({ archivo: join(directorio, 'datos.json') });

  return {
    store,
    limpiar: () => rm(directorio, { recursive: true, force: true }),
  };
});
