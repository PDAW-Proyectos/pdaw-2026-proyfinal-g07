import { ErrorDominio } from './ErrorDominio.js';

const PAGINA_PREDETERMINADA = 1;
const LIMITE_PREDETERMINADO = 20;
const LIMITE_MAXIMO = 50;

/**
 * Lee un entero positivo de la query y falla con VALIDACION_FALLIDA si no lo es.
 */
function leerEntero(valor, campo, { min, max }) {
  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) {
    throw new ErrorDominio(
      'VALIDACION_FALLIDA',
      `El parámetro ${campo} debe ser un número entero.`,
      { campo },
    );
  }

  const numero = Number(valor);

  if (!Number.isSafeInteger(numero) || numero < min || numero > max) {
    throw new ErrorDominio(
      'VALIDACION_FALLIDA',
      `El parámetro ${campo} debe estar entre ${min} y ${max}.`,
      { campo, min, max },
    );
  }

  return numero;
}

/**
 * Normaliza los parámetros de paginación de una colección.
 */
export function leerPaginacion(query = {}) {
  return {
    page:
      query.page === undefined
        ? PAGINA_PREDETERMINADA
        : leerEntero(query.page, 'page', { min: 1, max: Number.MAX_SAFE_INTEGER }),
    limit:
      query.limit === undefined
        ? LIMITE_PREDETERMINADO
        : leerEntero(query.limit, 'limit', { min: 1, max: LIMITE_MAXIMO }),
  };
}

/**
 * Devuelve la página pedida junto con el total, sin mutar el arreglo original.
 */
export function paginar(elementos, { page, limit }) {
  const inicio = (page - 1) * limit;

  return {
    data: elementos.slice(inicio, inicio + limit),
    page,
    limit,
    total: elementos.length,
  };
}
