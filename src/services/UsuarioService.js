import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Usuario } from '../models/Usuario.js';
import { ErrorDominio } from '../utils/ErrorDominio.js';
import { validarEmail, validarNombreUsuario, validarTexto } from '../utils/validaciones.js';

const CAMPOS_REGISTRO = new Set(['nombre', 'nombreUsuario', 'email', 'contrasena']);
const RONDAS_HASH_PREDETERMINADAS = 12;

export class UsuarioService {
  #usuarioRepository;
  #rondasHash;

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

  async buscarPorId(id) {
    return this.#usuarioRepository.buscarPorId(id);
  }

  #validarRegistro(datos) {
    if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
      throw new ErrorDominio('SOLICITUD_INVALIDA', 'El cuerpo debe ser un objeto JSON.');
    }

    const claves = Object.keys(datos);

    if (claves.length === 0) {
      throw new ErrorDominio(
        'SOLICITUD_INVALIDA',
        'El cuerpo de la solicitud no puede estar vacío.',
      );
    }

    const desconocidos = claves.filter((clave) => !CAMPOS_REGISTRO.has(clave));

    if (desconocidos.length > 0) {
      throw new ErrorDominio(
        'SOLICITUD_INVALIDA',
        `Campos desconocidos: ${desconocidos.join(', ')}.`,
        { campos: desconocidos },
      );
    }

    return {
      nombre: validarTexto(datos.nombre, 'nombre', { max: 80 }),
      nombreUsuario: validarNombreUsuario(datos.nombreUsuario),
      email: validarEmail(datos.email),
      contrasena: validarTexto(datos.contrasena, 'contrasena', {
        min: 8,
        max: 100,
        recortar: false,
      }),
    };
  }
}
