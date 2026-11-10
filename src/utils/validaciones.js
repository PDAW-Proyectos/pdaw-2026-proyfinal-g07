import { ErrorDominio } from './ErrorDominio.js';

const BYTES_MAXIMOS_CONTRASENA = 72;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_NOMBRE_USUARIO = /^[\p{L}\p{N}._-]{3,30}$/u;
const REGEX_FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Valida que un identificador sea un texto no vacío y lo devuelve recortado.
 */
export function validarId(valor, campo) {
  return validarTexto(valor, campo, { max: 100 });
}

/**
 * Valida que un valor sea texto y respete la longitud indicada.
 * Por defecto recorta los espacios exteriores antes de medir.
 */
export function validarTexto(valor, campo, { min = 1, max = Infinity, recortar = true } = {}) {
  if (typeof valor !== 'string') {
    throw new ErrorDominio('TIPO_INVALIDO', `El campo ${campo} debe ser texto.`, { campo });
  }

  const texto = recortar ? valor.trim() : valor;

  if (texto.length < min) {
    throw new ErrorDominio(
      'LONGITUD_INVALIDA',
      `El campo ${campo} debe tener al menos ${min} caracteres.`,
      { campo, min, max },
    );
  }

  if (Number.isFinite(max) && texto.length > max) {
    throw new ErrorDominio(
      'LONGITUD_INVALIDA',
      `El campo ${campo} no puede superar los ${max} caracteres.`,
      { campo, min, max },
    );
  }

  return texto;
}

/**
 * Valida una contraseña de registro.
 * El máximo se mide en bytes UTF-8 porque bcrypt ignora lo que supere los 72 bytes,
 * y se exige al menos un carácter que no sea espacio.
 */
export function validarContrasena(valor, campo = 'contrasena') {
  const contrasena = validarTexto(valor, campo, { min: 8, max: 100, recortar: false });

  if (!/\S/.test(contrasena)) {
    throw new ErrorDominio(
      'FORMATO_INVALIDO',
      'La contraseña no puede estar compuesta solo por espacios.',
      { campo },
    );
  }

  if (Buffer.byteLength(contrasena, 'utf8') > BYTES_MAXIMOS_CONTRASENA) {
    throw new ErrorDominio(
      'LONGITUD_INVALIDA',
      `El campo ${campo} no puede superar los ${BYTES_MAXIMOS_CONTRASENA} bytes.`,
      { campo, max: BYTES_MAXIMOS_CONTRASENA },
    );
  }

  return contrasena;
}

/**
 * Normaliza a minúsculas, recorta y valida un email.
 */
export function validarEmail(valor) {
  const email = typeof valor === 'string' ? valor.trim().toLowerCase() : '';

  if (email.length > 254 || !REGEX_EMAIL.test(email)) {
    throw new ErrorDominio('FORMATO_INVALIDO', 'El email no tiene un formato válido.', {
      campo: 'email',
    });
  }

  return email;
}

/**
 * Normaliza y valida un nombre de usuario sin espacios.
 * Admite letras, números, punto, guion y guion bajo.
 */
export function validarNombreUsuario(valor) {
  const nombreUsuario = typeof valor === 'string' ? valor.trim() : '';

  if (!REGEX_NOMBRE_USUARIO.test(nombreUsuario)) {
    throw new ErrorDominio(
      'FORMATO_INVALIDO',
      'El nombre de usuario debe tener entre 3 y 30 caracteres y solo puede contener letras, números, punto, guion o guion bajo.',
      { campo: 'nombreUsuario' },
    );
  }

  return nombreUsuario;
}

/**
 * Valida que un valor sea un número entero dentro del rango indicado.
 */
export function validarEntero(valor, campo, { min = -Infinity, max = Infinity } = {}) {
  if (!Number.isInteger(valor)) {
    throw new ErrorDominio('TIPO_INVALIDO', `El campo ${campo} debe ser un número entero.`, {
      campo,
    });
  }

  if (valor < min || valor > max) {
    throw new ErrorDominio(
      'VALOR_FUERA_DE_RANGO',
      `El campo ${campo} debe estar entre ${min} y ${max}.`,
      { campo, min, max },
    );
  }

  return valor;
}

/**
 * Valida una puntuación opcional: null o un entero entre 1 y 5.
 */
export function validarPuntuacion(valor) {
  if (valor === null || valor === undefined) {
    return null;
  }

  if (!Number.isInteger(valor)) {
    throw new ErrorDominio(
      'PUNTUACION_INVALIDA',
      'La puntuación debe ser un número entero entre 1 y 5.',
      { campo: 'puntuacion' },
    );
  }

  if (valor < 1 || valor > 5) {
    throw new ErrorDominio('PUNTUACION_INVALIDA', 'La puntuación debe estar entre 1 y 5.', {
      campo: 'puntuacion',
    });
  }

  return valor;
}

/**
 * Valida una fecha en formato YYYY-MM-DD y que exista en el calendario.
 * Devuelve el mismo texto normalizado.
 */
export function validarFechaISO(valor, campo) {
  if (typeof valor !== 'string') {
    throw new ErrorDominio(
      'TIPO_INVALIDO',
      `El campo ${campo} debe ser una fecha en formato YYYY-MM-DD.`,
      { campo },
    );
  }

  const coincidencia = REGEX_FECHA_ISO.exec(valor);

  if (!coincidencia) {
    throw new ErrorDominio(
      'FORMATO_INVALIDO',
      `El campo ${campo} debe tener el formato YYYY-MM-DD.`,
      { campo },
    );
  }

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    throw new ErrorDominio(
      'FORMATO_INVALIDO',
      `El campo ${campo} no corresponde a una fecha real.`,
      { campo },
    );
  }

  return valor;
}

/**
 * Devuelve la fecha local de referencia en formato YYYY-MM-DD.
 */
export function fechaLocalISO(fecha = new Date()) {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
    throw new ErrorDominio('FECHA_INVALIDA', 'La fecha de referencia no es válida.', {
      campo: 'hoy',
    });
  }

  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}

/**
 * Valida que una fecha YYYY-MM-DD no sea posterior a la fecha de referencia.
 */
export function validarFechaNoFutura(fecha, hoy = new Date()) {
  const fechaValidada = validarFechaISO(fecha, 'fecha');
  const fechaActual = fechaLocalISO(hoy);

  if (fechaValidada > fechaActual) {
    throw new ErrorDominio('FECHA_FUTURA', 'La fecha no puede ser posterior a hoy.', {
      campo: 'fecha',
      fecha: fechaValidada,
      hoy: fechaActual,
    });
  }

  return fechaValidada;
}

/**
 * Normaliza una fecha u hora a una instancia de Date y valida que sea real.
 */
export function validarFechaHora(valor, campo) {
  if (valor === null || valor === undefined) {
    throw new ErrorDominio('TIPO_INVALIDO', `El campo ${campo} debe ser una fecha válida.`, {
      campo,
    });
  }

  const fecha = valor instanceof Date ? new Date(valor.getTime()) : new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    throw new ErrorDominio(
      'FORMATO_INVALIDO',
      `El campo ${campo} no corresponde a una fecha válida.`,
      { campo },
    );
  }

  return fecha;
}

/**
 * Valida un arreglo de textos y devuelve una copia recortada de sus elementos.
 */
export function validarArrayTexto(valor, campo, { min = 0 } = {}) {
  if (!Array.isArray(valor)) {
    throw new ErrorDominio('TIPO_INVALIDO', `El campo ${campo} debe ser un arreglo.`, { campo });
  }

  if (valor.length < min) {
    throw new ErrorDominio(
      'LONGITUD_INVALIDA',
      `El campo ${campo} debe tener al menos ${min} elementos.`,
      { campo, min },
    );
  }

  return valor.map((elemento, indice) =>
    validarTexto(elemento, `${campo}[${indice}]`, { max: 100 }),
  );
}

/**
 * Valida la ruta del póster, admitiendo null cuando la película no tiene imagen.
 */
export function validarRutaPoster(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }

  return validarTexto(valor, 'rutaPoster', { max: 500 });
}
