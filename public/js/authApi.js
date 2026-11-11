const BASE_AUTH = '/api/auth';

/**
 * Error devuelto por la API con el formato application/problem+json.
 * `errores` lista los campos inválidos como { campo, mensaje }.
 */
export class ErrorApi extends Error {
  constructor({ status, title, detail, errores = [] }) {
    super(detail ?? title ?? 'Ocurrió un error inesperado.');
    this.name = 'ErrorApi';
    this.status = status;
    this.errores = errores;
  }
}

/**
 * Envía una solicitud a /api/auth. La cookie de sesión viaja sola porque
 * la API y los archivos estáticos se sirven desde el mismo origen.
 */
async function solicitar(ruta, { metodo = 'GET', cuerpo } = {}) {
  const opciones = {
    method: metodo,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  };

  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }

  const respuesta = await fetch(`${BASE_AUTH}${ruta}`, opciones);

  if (respuesta.status === 204) {
    return null;
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new ErrorApi({ status: respuesta.status, ...datos });
  }

  return datos;
}

/**
 * Consulta si hay una sesión activa: { autenticado, usuario }.
 */
export function obtenerSesion() {
  return solicitar('/sesion');
}

/**
 * Inicia sesión con { identificador, contrasena }. Devuelve { usuario }.
 */
export function iniciarSesion(credenciales) {
  return solicitar('/login', { metodo: 'POST', cuerpo: credenciales });
}

/**
 * Crea la cuenta e inicia sesión. Recibe { nombre, nombreUsuario, email, contrasena }.
 */
export function registrarUsuario(datos) {
  return solicitar('/registro', { metodo: 'POST', cuerpo: datos });
}

/**
 * Cierra la sesión actual.
 */
export function cerrarSesion() {
  return solicitar('/logout', { metodo: 'POST' });
}
