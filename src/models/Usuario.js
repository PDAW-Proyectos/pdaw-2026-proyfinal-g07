import {
  validarEmail,
  validarId,
  validarNombreUsuario,
  validarRol,
  validarTexto,
} from '../utils/validaciones.js';

/**
 * Cuenta de usuario del dominio.
 * Mantiene el hash de la contraseña fuera de las respuestas públicas.
 */
export class Usuario {
  #id;
  #nombre;
  #nombreUsuario;
  #email;
  #hashContrasena;
  #rol;

  /**
   * Construye un usuario validando sus datos e invariantes.
   */
  constructor({ id, nombre, nombreUsuario, email, hashContrasena, rol = 'usuario' }) {
    this.#id = validarId(id, 'id');
    this.#nombre = validarTexto(nombre, 'nombre', { max: 80 });
    this.#nombreUsuario = validarNombreUsuario(nombreUsuario);
    this.#email = validarEmail(email);
    this.#hashContrasena = validarTexto(hashContrasena, 'hashContrasena', {
      max: 500,
      recortar: false,
    });
    this.#rol = validarRol(rol);
  }

  /**
   * Devuelve el identificador interno del usuario.
   */
  get id() {
    return this.#id;
  }

  /**
   * Devuelve el nombre visible del usuario.
   */
  get nombre() {
    return this.#nombre;
  }

  /**
   * Devuelve el nombre de usuario único.
   */
  get nombreUsuario() {
    return this.#nombreUsuario;
  }

  /**
   * Devuelve el email normalizado, usado para iniciar sesión.
   */
  get email() {
    return this.#email;
  }

  /**
   * Devuelve el hash de la contraseña; nunca debe exponerse en una respuesta.
   */
  get hashContrasena() {
    return this.#hashContrasena;
  }

  /**
   * Devuelve el rol de la cuenta: `usuario` o `admin`.
   */
  get rol() {
    return this.#rol;
  }

  /**
   * Devuelve solo los datos que pueden mostrarse públicamente.
   */
  toPublicJSON() {
    return {
      id: this.#id,
      nombre: this.#nombre,
      nombreUsuario: this.#nombreUsuario,
    };
  }

  /**
   * Devuelve los datos de la propia cuenta, incluidos email y rol.
   * No incluye el hash de la contraseña.
   */
  toPrivateJSON() {
    return {
      ...this.toPublicJSON(),
      email: this.#email,
      rol: this.#rol,
    };
  }

  /**
   * Serializa el usuario completo para persistencia.
   */
  toJSON() {
    return {
      id: this.#id,
      nombre: this.#nombre,
      nombreUsuario: this.#nombreUsuario,
      email: this.#email,
      hashContrasena: this.#hashContrasena,
      rol: this.#rol,
    };
  }

  /**
   * Reconstruye un usuario a partir de datos persistidos.
   */
  static fromJSON(datos) {
    return new Usuario(datos);
  }
}
