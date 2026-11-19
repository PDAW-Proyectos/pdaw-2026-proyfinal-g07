const BASE_API = '/api';

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
 * Envía una solicitud a /api. La cookie de sesión viaja sola porque
 * la API y los archivos estáticos se sirven desde el mismo origen.
 * `parametros` se agrega como query string y omite los valores nulos.
 */
export async function solicitar(ruta, { metodo = 'GET', cuerpo, parametros = {} } = {}) {
  const url = new URL(`${BASE_API}${ruta}`, window.location.origin);

  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null) {
      url.searchParams.set(clave, String(valor));
    }
  }

  const opciones = {
    method: metodo,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  };

  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }

  const respuesta = await fetch(url, opciones);

  if (respuesta.status === 204) {
    return null;
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new ErrorApi({ status: respuesta.status, ...datos });
  }

  return datos;
}
