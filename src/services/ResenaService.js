import { randomUUID } from 'node:crypto';
import { Resena } from '../models/Resena.js';
import { ErrorDominio } from '../utils/ErrorDominio.js';
import { paginar } from '../utils/paginacion.js';
import { validarCuerpo, validarId, validarTexto } from '../utils/validaciones.js';

const CAMPOS_CREACION = new Set(['peliculaId', 'comentario']);
const CAMPOS_ACTUALIZACION = new Set(['comentario']);

function porFechaDescendente(a, b) {
  return b.fechaPublicacion.getTime() - a.fechaPublicacion.getTime();
}

/**
 * Casos de uso de las reseñas públicas.
 * La lectura es libre; crear, editar y eliminar exigen ser el autor.
 */
export class ResenaService {
  #resenaRepository;
  #peliculaRepository;
  #usuarioRepository;
  #ahora;

  constructor({
    resenaRepository,
    peliculaRepository,
    usuarioRepository,
    ahora = () => new Date(),
  }) {
    this.#resenaRepository = resenaRepository;
    this.#peliculaRepository = peliculaRepository;
    this.#usuarioRepository = usuarioRepository;
    this.#ahora = ahora;
  }

  async crear(usuarioId, datos) {
    validarCuerpo(datos, CAMPOS_CREACION);

    const peliculaId = validarId(datos.peliculaId, 'peliculaId');
    const pelicula = await this.#buscarPelicula(peliculaId);
    const comentario = validarTexto(datos.comentario, 'comentario', { max: 5000 });

    const resena = new Resena({
      id: randomUUID(),
      usuarioId,
      peliculaId,
      comentario,
      fechaPublicacion: this.#ahora(),
    });

    await this.#resenaRepository.crear(resena);

    const autor = await this.#buscarAutor(usuarioId);

    return { resena, autor, pelicula };
  }

  async listarRecientes({ page = 1, limit = 20 } = {}) {
    const resenas = await this.#resenaRepository.listarTodas();

    resenas.sort(porFechaDescendente);

    return this.#paginarConDatos(resenas, { page, limit });
  }

  async listarMias(usuarioId, { page = 1, limit = 20 } = {}) {
    const resenas = await this.#resenaRepository.listarPorUsuario(usuarioId);

    resenas.sort(porFechaDescendente);

    return this.#paginarConDatos(resenas, { page, limit });
  }

  async obtener(id) {
    const resena = await this.#resenaRepository.buscarPorId(id);

    if (!resena) {
      throw new ErrorDominio('NO_ENCONTRADO', 'La reseña no existe.');
    }

    return this.#componer(resena);
  }

  async actualizar(usuarioId, id, datos) {
    validarCuerpo(datos, CAMPOS_ACTUALIZACION);

    const resena = await this.#buscarPropia(usuarioId, id);

    resena.editar(datos.comentario);
    await this.#resenaRepository.actualizar(resena);

    return this.#componer(resena);
  }

  async eliminar(usuarioId, id) {
    await this.#buscarPropia(usuarioId, id);
    await this.#resenaRepository.eliminar(id);
  }

  async #paginarConDatos(resenas, { page, limit }) {
    const pagina = paginar(resenas, { page, limit });

    return { ...pagina, data: await this.#componerVarias(pagina.data) };
  }

  /**
   * Resuelve autor y película de cada reseña con una sola lectura por colección.
   */
  async #componerVarias(resenas) {
    if (resenas.length === 0) {
      return [];
    }

    const [usuarios, peliculas] = await Promise.all([
      this.#usuarioRepository.listar(),
      this.#peliculaRepository.listar(),
    ]);
    const autores = new Map(usuarios.map((usuario) => [usuario.id, usuario]));
    const peliculasPorId = new Map(peliculas.map((pelicula) => [pelicula.id, pelicula]));

    return resenas.map((resena) => ({
      resena,
      autor: autores.get(resena.usuarioId),
      pelicula: peliculasPorId.get(resena.peliculaId),
    }));
  }

  async #componer(resena) {
    const [autor, pelicula] = await Promise.all([
      this.#usuarioRepository.buscarPorId(resena.usuarioId),
      this.#peliculaRepository.buscarPorId(resena.peliculaId),
    ]);

    if (!autor || !pelicula) {
      throw new ErrorDominio('NO_ENCONTRADO', 'La reseña no existe.');
    }

    return { resena, autor, pelicula };
  }

  /**
   * Devuelve la reseña solo si existe y pertenece al usuario; si no, 404 o 403.
   */
  async #buscarPropia(usuarioId, id) {
    const resena = await this.#resenaRepository.buscarPorId(id);

    if (!resena) {
      throw new ErrorDominio('NO_ENCONTRADO', 'La reseña no existe.');
    }

    if (resena.usuarioId !== usuarioId) {
      throw new ErrorDominio('NO_AUTORIZADO', 'Solo el autor puede modificar su reseña.');
    }

    return resena;
  }

  async #buscarPelicula(peliculaId) {
    const pelicula = await this.#peliculaRepository.buscarPorId(peliculaId);

    if (!pelicula) {
      throw new ErrorDominio(
        'PELICULA_NO_ENCONTRADA',
        'No existe una película con ese identificador.',
        { campo: 'peliculaId' },
      );
    }

    return pelicula;
  }

  async #buscarAutor(usuarioId) {
    const autor = await this.#usuarioRepository.buscarPorId(usuarioId);

    if (!autor) {
      throw new ErrorDominio('NO_ENCONTRADO', 'El usuario no existe.');
    }

    return autor;
  }
}
