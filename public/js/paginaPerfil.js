import { obtenerSesion } from './authApi.js';
import { listarMisResenas } from './resenasApi.js';
import { listarVisualizaciones } from './visualizacionesApi.js';
import { formatearFecha, mensajeDeError, mostrarPoster } from './utilidades.js';

const CANTIDAD_RECIENTES = 6;
const CANTIDAD_RESENAS = 6;
const LIMITE_RESENAS = 50;

/**
 * Perfil del usuario: métricas, últimas películas reseñadas y últimas reseñas.
 * La watchlist queda pendiente de implementación y solo se informa en su sección.
 */
class PaginaPerfil {
  #elementos;
  #resenas = [];
  #totalResenas = 0;
  #totalVisualizaciones = 0;

  /**
   * `elementos` reúne los nodos del DOM que usa el perfil.
   */
  constructor({ elementos }) {
    this.#elementos = elementos;
  }

  async iniciar() {
    const [sesion, resenas, visualizaciones] = await Promise.allSettled([
      obtenerSesion(),
      listarMisResenas({ page: 1, limit: LIMITE_RESENAS }),
      listarVisualizaciones({ page: 1, limit: 1 }),
    ]);

    if (sesion.status === 'fulfilled' && sesion.value.autenticado) {
      this.#mostrarUsuario(sesion.value.usuario);
    }

    if (resenas.status === 'fulfilled') {
      this.#resenas = resenas.value.data;
      this.#totalResenas = resenas.value.total;
      this.#mostrarRecientes();
      this.#mostrarResenas();
    } else {
      this.#mostrarErrorResenas(resenas.reason);
    }

    if (visualizaciones.status === 'fulfilled') {
      this.#totalVisualizaciones = visualizaciones.value.total;
    }

    this.#mostrarMetricas();
    this.#mostrarWatchlistPendiente();
  }

  #mostrarUsuario(usuario) {
    this.#elementos.nombre.textContent = usuario.nombre;
    this.#elementos.desde.textContent = `@${usuario.nombreUsuario}`;
  }

  #mostrarMetricas() {
    this.#elementos.statPeliculas.textContent = String(this.#totalVisualizaciones);
    this.#elementos.statListas.textContent = '0';
    this.#elementos.statResenas.textContent = String(this.#totalResenas);
  }

  /**
   * Muestra hasta seis películas distintas entre las reseñas más recientes.
   */
  #mostrarRecientes() {
    const { contenedorRecientes, plantillaPelicula } = this.#elementos;
    const peliculas = this.#peliculasUnicas().slice(0, CANTIDAD_RECIENTES);

    if (peliculas.length === 0) {
      contenedorRecientes.replaceChildren(
        this.#crearMensaje('Todavía no reseñaste ninguna película.'),
      );
      return;
    }

    contenedorRecientes.replaceChildren(
      ...peliculas.map((pelicula) => this.#crearTarjetaPelicula(pelicula, plantillaPelicula)),
    );
  }

  #mostrarResenas() {
    const { contenedorResenas, plantillaResena } = this.#elementos;
    const resenas = this.#resenas.slice(0, CANTIDAD_RESENAS);

    if (resenas.length === 0) {
      contenedorResenas.replaceChildren(
        this.#crearMensaje(
          'Todavía no escribiste reseñas. Buscá una película y compartí tu opinión.',
        ),
      );
      return;
    }

    contenedorResenas.replaceChildren(
      ...resenas.map((resena) => this.#crearTarjetaResena(resena, plantillaResena)),
    );
  }

  /**
   * La watchlist todavía no tiene API: se deja su sección con un aviso claro.
   */
  #mostrarWatchlistPendiente() {
    this.#elementos.contenedorWatchlist.replaceChildren(
      this.#crearMensaje('La watchlist va a estar disponible próximamente.'),
    );
  }

  #mostrarErrorResenas(error) {
    const mensaje = mensajeDeError(error);

    this.#elementos.contenedorRecientes.replaceChildren(this.#crearMensaje(mensaje));
    this.#elementos.contenedorResenas.replaceChildren(this.#crearMensaje(mensaje));
  }

  /**
   * Devuelve las películas de las reseñas sin repetir, en el orden en que aparecen.
   */
  #peliculasUnicas() {
    const vistas = new Set();
    const peliculas = [];

    for (const resena of this.#resenas) {
      if (!vistas.has(resena.pelicula.id)) {
        vistas.add(resena.pelicula.id);
        peliculas.push(resena.pelicula);
      }
    }

    return peliculas;
  }

  #crearMensaje(texto) {
    const mensaje = document.createElement('div');

    mensaje.className = 'text-secondary py-3 text-center w-100';
    mensaje.textContent = texto;

    return mensaje;
  }

  #crearTarjetaPelicula(pelicula, plantilla) {
    const tarjeta = plantilla.content.cloneNode(true);
    const destino = new URL('pelicula.html', window.location.href);

    destino.searchParams.set('id', pelicula.id);
    tarjeta.querySelector('a').href = destino;
    tarjeta.querySelector('.recent-title').textContent = pelicula.titulo;
    tarjeta.querySelector('.recent-meta').textContent = pelicula.anioEstreno;

    mostrarPoster(
      {
        imagen: tarjeta.querySelector('.recent-poster'),
        marcador: tarjeta.querySelector('.poster-placeholder'),
      },
      pelicula.rutaPoster,
      pelicula.titulo,
    );

    return tarjeta;
  }

  #crearTarjetaResena(resena, plantilla) {
    const tarjeta = plantilla.content.cloneNode(true);
    const destino = new URL('pelicula.html', window.location.href);

    destino.searchParams.set('id', resena.pelicula.id);

    for (const enlace of tarjeta.querySelectorAll('a')) {
      enlace.href = destino;
    }

    tarjeta.querySelector('.movie-title-rev').textContent = resena.pelicula.titulo;
    tarjeta.querySelector('.movie-year-rev').textContent = resena.pelicula.anioEstreno;
    tarjeta.querySelector('.review-date').textContent = formatearFecha(resena.fechaPublicacion);
    tarjeta.querySelector('.review-content').textContent = resena.comentario;

    mostrarPoster(
      {
        imagen: tarjeta.querySelector('.review-poster'),
        marcador: tarjeta.querySelector('.resena-poster-marcador'),
      },
      resena.pelicula.rutaPoster,
      resena.pelicula.titulo,
    );

    return tarjeta;
  }
}

const perfil = new PaginaPerfil({
  elementos: {
    nombre: document.getElementById('user-display-name'),
    desde: document.getElementById('user-member-since'),
    statPeliculas: document.getElementById('stat-movies-count'),
    statListas: document.getElementById('stat-lists-count'),
    statResenas: document.getElementById('stat-reviews-count'),
    contenedorRecientes: document.getElementById('recent-movies-container'),
    contenedorWatchlist: document.getElementById('watchlists-container'),
    contenedorResenas: document.getElementById('user-reviews-container'),
    plantillaPelicula: document.getElementById('tpl-recent-movie'),
    plantillaResena: document.getElementById('tpl-user-review-card'),
  },
});

await perfil.iniciar();
