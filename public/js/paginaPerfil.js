import { obtenerSesion } from './authApi.js';
import { listarMisResenas } from './resenasApi.js';
import { listarVisualizaciones } from './visualizacionesApi.js';
import { listarWatchlist } from './watchlistApi.js';
import { formatearFecha, mensajeDeError, mostrarPoster } from './utilidades.js';

const CANTIDAD_RECIENTES = 6;
const CANTIDAD_RESENAS = 6;
const LIMITE_RESENAS = 50;
const LIMITE_WATCHLIST = 6;

/**
 * Perfil del usuario: métricas, últimas películas reseñadas, watchlist y reseñas.
 */
class PaginaPerfil {
  #elementos;
  #resenas = [];
  #watchlist = [];
  #totalResenas = 0;
  #totalWatchlist = 0;
  #totalVisualizaciones = 0;

  /**
   * `elementos` reúne los nodos del DOM que usa el perfil.
   */
  constructor({ elementos }) {
    this.#elementos = elementos;
  }

  async iniciar() {
    const [sesion, resenas, visualizaciones, watchlist] = await Promise.allSettled([
      obtenerSesion(),
      listarMisResenas({ page: 1, limit: LIMITE_RESENAS }),
      listarVisualizaciones({ page: 1, limit: 1 }),
      listarWatchlist({ page: 1, limit: LIMITE_WATCHLIST }),
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

    if (watchlist.status === 'fulfilled') {
      this.#watchlist = watchlist.value.data;
      this.#totalWatchlist = watchlist.value.total;
      this.#mostrarWatchlist();
    } else {
      this.#elementos.contenedorWatchlist.replaceChildren(
        this.#crearMensaje(mensajeDeError(watchlist.reason)),
      );
    }

    this.#mostrarMetricas();
  }

  #mostrarUsuario(usuario) {
    this.#elementos.nombre.textContent = usuario.nombre;
    this.#elementos.desde.textContent = `@${usuario.nombreUsuario}`;
  }

  #mostrarMetricas() {
    this.#elementos.statPeliculas.textContent = String(this.#totalVisualizaciones);
    this.#elementos.statWatchlist.textContent = String(this.#totalWatchlist);
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
      ...peliculas.map((pelicula) =>
        this.#crearTarjetaPelicula(pelicula, {
          plantilla: plantillaPelicula,
          imagen: '.recent-poster',
          marcador: '.poster-placeholder',
          titulo: '.recent-title',
          meta: '.recent-meta',
          textoMeta: String(pelicula.anioEstreno),
        }),
      ),
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
   * Muestra hasta seis películas de la watchlist con su fecha de agregado.
   */
  #mostrarWatchlist() {
    const { contenedorWatchlist, plantillaWatchlist } = this.#elementos;

    if (this.#watchlist.length === 0) {
      contenedorWatchlist.replaceChildren(
        this.#crearMensaje(
          'Tu watchlist está vacía. Buscá una película y guardala para verla más tarde.',
        ),
      );
      return;
    }

    contenedorWatchlist.replaceChildren(
      ...this.#watchlist.map(({ pelicula, fechaAgregado }) =>
        this.#crearTarjetaPelicula(pelicula, {
          plantilla: plantillaWatchlist,
          imagen: '.watchlist-poster',
          marcador: '.poster-placeholder',
          titulo: '.watchlist-title',
          meta: '.watchlist-meta',
          textoMeta: `${pelicula.anioEstreno} · ${formatearFecha(fechaAgregado)}`,
        }),
      ),
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

  /**
   * Clona una plantilla de tarjeta de película y la completa.
   * `selectores` indica qué nodo recibe cada dato dentro de la plantilla.
   */
  #crearTarjetaPelicula(pelicula, { plantilla, imagen, marcador, titulo, meta, textoMeta }) {
    const tarjeta = plantilla.content.cloneNode(true);
    const destino = new URL('pelicula.html', window.location.href);

    destino.searchParams.set('id', pelicula.id);
    tarjeta.querySelector('a').href = destino;
    tarjeta.querySelector(titulo).textContent = pelicula.titulo;
    tarjeta.querySelector(meta).textContent = textoMeta;

    mostrarPoster(
      {
        imagen: tarjeta.querySelector(imagen),
        marcador: tarjeta.querySelector(marcador),
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
    statWatchlist: document.getElementById('stat-watchlist-count'),
    statResenas: document.getElementById('stat-reviews-count'),
    contenedorRecientes: document.getElementById('recent-movies-container'),
    contenedorWatchlist: document.getElementById('watchlists-container'),
    contenedorResenas: document.getElementById('user-reviews-container'),
    plantillaPelicula: document.getElementById('tpl-recent-movie'),
    plantillaWatchlist: document.getElementById('tpl-watchlist-card'),
    plantillaResena: document.getElementById('tpl-user-review-card'),
  },
});

await perfil.iniciar();
