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
 * Arma la URL de la página pública de un usuario.
 */
export function urlPerfilUsuario(usuarioId) {
  const destino = new URL('usuario.html', window.location.href);

  destino.searchParams.set('id', usuarioId);

  return destino;
}

/**
 * Hace que una tarjeta de reseña navegue al perfil del autor al tocarla,
 * salvo que el clic sea sobre otro enlace o botón.
 */
export function enlazarResenaAPerfil(elemento, autor) {
  if (!elemento) {
    return;
  }

  const destino = urlPerfilUsuario(autor.id);

  elemento.classList.add('resena-enlazable');
  elemento.title = `Ver perfil de ${autor.nombre}`;
  elemento.addEventListener('click', (evento) => {
    if (evento.defaultPrevented || evento.target.closest('a, button')) {
      return;
    }

    if (window.getSelection()?.toString()) {
      return;
    }

    window.location.href = destino;
  });
}

/**
 * Convierte una fecha ISO 8601 en texto legible, por ejemplo "30 de octubre de 2026".
 */
export function formatearFecha(iso) {
  const fecha = new Date(iso);

  return Number.isNaN(fecha.getTime()) ? '' : formateadorFecha.format(fecha);
}

/**
 * Devuelve la fecha local de hoy en formato `YYYY-MM-DD`, que es el que espera la API.
 */
export function fechaDeHoy() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');

  return `${ahora.getFullYear()}-${mes}-${dia}`;
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
