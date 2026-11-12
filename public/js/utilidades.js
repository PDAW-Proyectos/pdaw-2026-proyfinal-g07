import { ErrorApi } from './apiCliente.js';

const BASE_IMAGENES_TMDB = 'https://image.tmdb.org/t/p';

const formateadorFecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' });

/**
 * Arma la URL de una imagen de TMDB a partir de la ruta del contrato.
 * Devuelve null si la película no tiene imagen.
 */
export function urlImagen(ruta, tamano = 'w342') {
  return ruta ? `${BASE_IMAGENES_TMDB}/${tamano}${ruta}` : null;
}

/**
 * Arma la URL del póster a partir de la `rutaPoster` del contrato.
 */
export function urlPoster(rutaPoster, tamano = 'w342') {
  return urlImagen(rutaPoster, tamano);
}

/**
 * Muestra el póster en la imagen y oculta el marcador. Si la película no tiene póster
 * o la imagen no carga, deja visible el marcador.
 */
export function mostrarPoster({ imagen, marcador }, rutaPoster, titulo, tamano) {
  const url = urlPoster(rutaPoster, tamano);

  imagen.classList.add('d-none');
  marcador.classList.remove('d-none');

  if (!url) {
    return;
  }

  imagen.addEventListener(
    'load',
    () => {
      imagen.classList.remove('d-none');
      marcador.classList.add('d-none');
    },
    { once: true },
  );
  imagen.alt = `Póster de ${titulo}`;
  imagen.src = url;
}

/**
 * Convierte una fecha ISO 8601 en texto legible, por ejemplo "30 de octubre de 2026".
 */
export function formatearFecha(iso) {
  const fecha = new Date(iso);

  return Number.isNaN(fecha.getTime()) ? '' : formateadorFecha.format(fecha);
}

/**
 * Lee un entero positivo de un parámetro de la URL; si no es válido devuelve 1.
 */
export function leerPagina(valor) {
  return /^\d+$/.test(valor ?? '') && Number(valor) >= 1 ? Number(valor) : 1;
}

/**
 * Mensaje para mostrar al usuario cuando falla una solicitud a la API.
 */
export function mensajeDeError(error) {
  return error instanceof ErrorApi
    ? error.message
    : 'No pudimos conectar con el servidor. Intentá de nuevo.';
}
