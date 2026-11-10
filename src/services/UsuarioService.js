import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Usuario } from '../models/Usuario.js';
import { ErrorDominio } from '../utils/ErrorDominio.js';
import {
  validarContrasena,
  validarCuerpo,
  validarEmail,
  validarNombreUsuario,
  validarTexto,
} from '../utils/validaciones.js';

const CAMPOS_REGISTRO = new Set(['nombre', 'nombreUsuario', 'email', 'contrasena']);
const CAMPOS_LOGIN = new Set(['identificador', 'contrasena']);
const RONDAS_HASH_PREDETERMINADAS = 12;

export class UsuarioService {
  #usuarioRepository;
  #rondasHash;
  #hashDummy;

  constructor({ usuarioRepository, rondasHash = RONDAS_HASH_PREDETERMINADAS }) {
    this.#usuarioRepository = usuarioRepository;
    this.#rondasHash = rondasHash;
  }

  async registrar(datos) {
    const registro = this.#validarRegistro(datos);

    const emailExistente = await this.#usuarioRepository.buscarPorEmail(registro.email);

    if (emailExistente) {
      throw new ErrorDominio('EMAIL_DUPLICADO', 'Ya existe una cuenta con ese email.', {
        campo: 'email',
      });
    }

    const usuarioExistente = await this.#usuarioRepository.buscarPorNombreUsuario(
      registro.nombreUsuario,
    );

    if (usuarioExistente) {
      throw new ErrorDominio(
        'NOMBRE_USUARIO_DUPLICADO',
        'Ya existe una cuenta con ese nombre de usuario.',
        { campo: 'nombreUsuario' },
      );
    }

    const hashContrasena = await bcrypt.hash(registro.contrasena, this.#rondasHash);
    const usuario = new Usuario({
      id: randomUUID(),
      nombre: registro.nombre,
      nombreUsuario: registro.nombreUsuario,
      email: registro.email,
      hashContrasena,
    });

    return this.#usuarioRepository.crear(usuario);
  }

  async autenticar(datos) {
    validarCuerpo(datos, CAMPOS_LOGIN);

    const identificador = validarTexto(datos.identificador, 'identificador', { max: 254 });
    // En el login solo se exige que la clave tenga contenido: la política de
    // registro puede endurecerse sin dejar afuera a las cuentas existentes.
    const contrasena = validarTexto(datos.contrasena, 'contrasena', { recortar: false });

    const usuario = await this.#usuarioRepository.buscarPorIdentificador(identificador);
    const coincide = await this.#compararContrasena(contrasena, usuario);

    if (!usuario || !coincide) {
      throw new ErrorDominio(
        'CREDENCIALES_INVALIDAS',
        'El identificador o la contraseña son incorrectos.',
      );
    }

    return usuario;
  }

  async buscarPorIdentificador(identificador) {
    return this.#usuarioRepository.buscarPorIdentificador(identificador);
  }

  async buscarPorId(id) {
    return this.#usuarioRepository.buscarPorId(id);
  }

  /**
   * Precalcula el hash de comparación para que el primer login de una cuenta
   * inexistente no tarde más que los siguientes.
   */
  async calentar() {
    this.#hashDummy ??= bcrypt.hash(randomUUID(), this.#rondasHash);
    await this.#hashDummy;
  }

  /**
   * Compara la contraseña con bcrypt aunque el usuario no exista,
   * para que el tiempo de respuesta no revele si la cuenta está registrada.
   */
  async #compararContrasena(contrasena, usuario) {
    if (usuario) {
      return bcrypt.compare(contrasena, usuario.hashContrasena);
    }

    this.#hashDummy ??= bcrypt.hash(randomUUID(), this.#rondasHash);
    await bcrypt.compare(contrasena, await this.#hashDummy);

    return false;
  }

  #validarRegistro(datos) {
    validarCuerpo(datos, CAMPOS_REGISTRO);

    return {
      nombre: validarTexto(datos.nombre, 'nombre', { max: 80 }),
      nombreUsuario: validarNombreUsuario(datos.nombreUsuario),
      email: validarEmail(datos.email),
      contrasena: validarContrasena(datos.contrasena),
    };
  }
}
