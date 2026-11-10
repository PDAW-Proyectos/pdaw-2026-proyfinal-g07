import { Usuario } from '../models/Usuario.js';
import { ErrorDominio } from '../utils/ErrorDominio.js';

const COLECCION = 'usuarios';

/**
 * Normaliza un texto para comparaciones sin distinguir mayúsculas.
 */
function normalizar(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase();
}

/**
 * Repositorio de usuarios sobre un store inyectado.
 */
export class UsuarioRepository {
  #store;

  /**
   * Recibe el store que provee las colecciones.
   */
  constructor({ store }) {
    this.#store = store;
  }

  /**
   * Guarda un usuario nuevo verificando que email y nombre de usuario sean únicos.
   */
  async crear(usuario) {
    return this.#store.actualizar(COLECCION, (registros) => {
      const hayEmailDuplicado = registros.some(
        (registro) => normalizar(registro.email) === normalizar(usuario.email),
      );

      if (hayEmailDuplicado) {
        throw new ErrorDominio('EMAIL_DUPLICADO', 'Ya existe una cuenta con ese email.', {
          campo: 'email',
        });
      }

      const hayNombreUsuarioDuplicado = registros.some(
        (registro) => normalizar(registro.nombreUsuario) === normalizar(usuario.nombreUsuario),
      );

      if (hayNombreUsuarioDuplicado) {
        throw new ErrorDominio(
          'NOMBRE_USUARIO_DUPLICADO',
          'Ya existe una cuenta con ese nombre de usuario.',
          { campo: 'nombreUsuario' },
        );
      }

      registros.push(usuario.toJSON());
      return usuario;
    });
  }

  /**
   * Busca un usuario por su identificador interno.
   */
  async buscarPorId(id) {
    const registro = this.#store.leer(COLECCION).find((candidato) => candidato.id === id);

    return registro ? Usuario.fromJSON(registro) : null;
  }

  /**
   * Busca un usuario por email, sin distinguir mayúsculas.
   */
  async buscarPorEmail(email) {
    const buscado = normalizar(email);
    const registro = this.#store
      .leer(COLECCION)
      .find((candidato) => normalizar(candidato.email) === buscado);

    return registro ? Usuario.fromJSON(registro) : null;
  }

  /**
   * Busca un usuario por nombre de usuario, sin distinguir mayúsculas.
   */
  async buscarPorNombreUsuario(nombreUsuario) {
    const buscado = normalizar(nombreUsuario);
    const registro = this.#store
      .leer(COLECCION)
      .find((candidato) => normalizar(candidato.nombreUsuario) === buscado);

    return registro ? Usuario.fromJSON(registro) : null;
  }

  /**
   * Busca un usuario por email o nombre de usuario, según lo usado para iniciar sesión.
   */
  async buscarPorIdentificador(identificador) {
    const buscado = normalizar(identificador);
    const registro = this.#store
      .leer(COLECCION)
      .find(
        (candidato) =>
          normalizar(candidato.email) === buscado ||
          normalizar(candidato.nombreUsuario) === buscado,
      );

    return registro ? Usuario.fromJSON(registro) : null;
  }

  /**
   * Devuelve todos los usuarios como instancias del modelo.
   */
  async listar() {
    return this.#store.leer(COLECCION).map((registro) => Usuario.fromJSON(registro));
  }
}
