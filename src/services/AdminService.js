import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Usuario } from '../models/Usuario.js';
import { ErrorDominio } from '../utils/ErrorDominio.js';
import { paginar } from '../utils/paginacion.js';
import {
  validarContrasena,
  validarEmail,
  validarNombreUsuario,
  validarTexto,
} from '../utils/validaciones.js';

const RONDAS_HASH_PREDETERMINADAS = 12;

/**
 * Casos de uso de administración: listar cuentas, eliminarlas con su contenido
 * y moderar reseñas. También crea el administrador inicial desde el entorno.
 */
export class AdminService {
  #usuarioRepository;
  #resenaRepository;
  #visualizacionRepository;
  #rondasHash;

  constructor({
    usuarioRepository,
    resenaRepository,
    visualizacionRepository,
    rondasHash = RONDAS_HASH_PREDETERMINADAS,
  }) {
    this.#usuarioRepository = usuarioRepository;
    this.#resenaRepository = resenaRepository;
    this.#visualizacionRepository = visualizacionRepository;
    this.#rondasHash = rondasHash;
  }

  /**
   * Devuelve las cuentas con email y rol, ordenadas por nombre de usuario.
   * No incluye el hash de la contraseña.
   */
  async listarUsuarios({ page = 1, limit = 20 } = {}) {
    const usuarios = await this.#usuarioRepository.listar();

    usuarios.sort((a, b) => a.nombreUsuario.localeCompare(b.nombreUsuario));

    const pagina = paginar(usuarios, { page, limit });

    return { ...pagina, data: pagina.data.map((usuario) => usuario.toPrivateJSON()) };
  }

  /**
   * Elimina una cuenta y, en cascada, sus visualizaciones y reseñas.
   */
  async eliminarUsuario(adminId, id) {
    const usuario = await this.#usuarioRepository.buscarPorId(id);

    if (!usuario) {
      throw new ErrorDominio('NO_ENCONTRADO', 'El usuario no existe.');
    }

    if (usuario.id === adminId) {
      throw new ErrorDominio('NO_AUTORIZADO', 'No podés eliminar tu propia cuenta.');
    }

    if (usuario.rol === 'admin') {
      const admins = (await this.#usuarioRepository.listar()).filter(
        (candidato) => candidato.rol === 'admin',
      );

      if (admins.length <= 1) {
        throw new ErrorDominio('ULTIMO_ADMIN', 'No se puede eliminar al último administrador.');
      }
    }

    const visualizacionesEliminadas = await this.#visualizacionRepository.eliminarPorUsuario(id);
    const resenasEliminadas = await this.#resenaRepository.eliminarPorUsuario(id);

    await this.#usuarioRepository.eliminar(id);

    return { visualizacionesEliminadas, resenasEliminadas };
  }

  /**
   * Elimina cualquier reseña, sin comprobar autoría.
   */
  async eliminarResena(id) {
    const resena = await this.#resenaRepository.buscarPorId(id);

    if (!resena) {
      throw new ErrorDominio('NO_ENCONTRADO', 'La reseña no existe.');
    }

    await this.#resenaRepository.eliminar(id);
  }

  /**
   * Crea el administrador inicial a partir de las variables de entorno.
   * Si ya existe una cuenta con ese email no se promueve ni se le cambia la clave:
   * se devuelve `conflicto` para que el arranque lo registre.
   */
  async asegurarAdmin(opciones = {}) {
    const datos = this.#validarAdmin(opciones);

    if (!datos) {
      return null;
    }

    const existente = await this.#usuarioRepository.buscarPorEmail(datos.email);

    if (existente) {
      return {
        estado: existente.rol === 'admin' ? 'existente' : 'conflicto',
        usuario: existente,
      };
    }

    const hashContrasena = await bcrypt.hash(datos.password, this.#rondasHash);
    const usuario = new Usuario({
      id: randomUUID(),
      nombre: datos.nombre,
      nombreUsuario: datos.nombreUsuario,
      email: datos.email,
      hashContrasena,
      rol: 'admin',
    });

    try {
      await this.#usuarioRepository.crear(usuario);
    } catch (error) {
      if (error.codigo === 'NOMBRE_USUARIO_DUPLICADO') {
        throw new Error(
          `El nombre de usuario "${datos.nombreUsuario}" ya está en uso. Definí otro ADMIN_USUARIO.`,
        );
      }

      throw error;
    }

    return { estado: 'creado', usuario };
  }

  #validarAdmin({ email, password, nombre = 'Administrador', nombreUsuario = 'admin' }) {
    if (!email && !password) {
      return null;
    }

    if (!email || !password) {
      throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD deben definirse juntos.');
    }

    return {
      email: validarEmail(email),
      password: validarContrasena(password),
      nombre: validarTexto(nombre, 'nombre', { max: 80 }),
      nombreUsuario: validarNombreUsuario(nombreUsuario),
    };
  }
}
