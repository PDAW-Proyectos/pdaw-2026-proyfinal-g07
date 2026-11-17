import { obtenerSesion } from './authApi.js';
import { BuscadorPeliculas } from './buscadorPeliculas.js';
import { listarMisResenas } from './resenasApi.js';
import { actualizarFavoritas, obtenerPerfilPublico } from './usuariosApi.js';
import { listarVisualizaciones } from './visualizacionesApi.js';
import { listarWatchlist } from './watchlistApi.js';
import { formatearFecha, mensajeDeError, mostrarPoster } from './utilidades.js';

const CANTIDAD_RECIENTES = 6;
const CANTIDAD_RESENAS = 6;
const LIMITE_RESENAS = 50;
const LIMITE_WATCHLIST = 6;
const CANTIDAD_VISTAS = 6;
const LIMITE_VISTAS = 20;
const PUNTUACION_MAXIMA = 5;
const MAXIMO_FAVORITAS = 5;

function formatearFechaDeVista(fecha) {
  return formatearFecha(`${fecha}T00:00:00`);
}

/**
 * Perfil del usuario: métricas, últimas películas reseñadas, watchlist y reseñas.
 */
class PaginaPerfil {
  #elementos;
  #usuarioId = null;
  #favoritas = [];
  #buscadorFavoritas = null;
  #resenas = [];
  #watchlist = [];
  #visualizaciones = [];
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
      listarVisualizaciones({ page: 1, limit: LIMITE_VISTAS }),
      listarWatchlist({ page: 1, limit: LIMITE_WATCHLIST }),
    ]);

    if (sesion.status === 'fulfilled' && sesion.value.autenticado) {
      this.#usuarioId = sesion.value.usuario.id;
      this.#mostrarUsuario(sesion.value.usuario);
      this.#conectarFavoritas();
      await this.#cargarFavoritas();
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
      this.#visualizaciones = visualizaciones.value.data;
      this.#totalVisualizaciones = visualizaciones.value.total;
      this.#mostrarVistas();
    } else {
      this.#elementos.contenedorVistas.replaceChildren(
        this.#crearMensaje(mensajeDeError(visualizaciones.reason)),
      );
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

  #conectarFavoritas() {
    this.#elementos.btnElegirFavoritas.addEventListener('click', () =>
      this.#abrirBuscadorFavoritas(),
    );
    this.#elementos.contenedorFavoritas.addEventListener('click', (evento) => {
      const boton = evento.target.closest('.btn-quitar-favorita');

      if (boton) {
        this.#quitarFavorita(boton.dataset.peliculaId, boton);
      }
    });
  }

  async #cargarFavoritas() {
    try {
      const perfil = await obtenerPerfilPublico(this.#usuarioId);

      this.#favoritas = perfil.favoritas;
      this.#mostrarFavoritas();
    } catch (error) {
      this.#elementos.contenedorFavoritas.replaceChildren(
        this.#crearMensaje(mensajeDeError(error)),
      );
    }
  }

  #mostrarFavoritas() {
    const { contenedorFavoritas, plantillaFavorita } = this.#elementos;

    this.#elementos.btnElegirFavoritas.innerHTML = `<i class="bi bi-search me-1"></i> Elegir favoritas (${this.#favoritas.length}/${MAXIMO_FAVORITAS})`;

    if (this.#favoritas.length === 0) {
      contenedorFavoritas.replaceChildren(
        this.#crearMensaje(
          'Todavía no elegiste tus favoritas. Buscá y seleccioná hasta 5 películas.',
        ),
      );
      return;
    }

    contenedorFavoritas.replaceChildren(
      ...this.#favoritas.map((pelicula) => this.#crearTarjetaFavorita(pelicula, plantillaFavorita)),
    );
  }

  #crearTarjetaFavorita(pelicula, plantilla) {
    const tarjeta = plantilla.content.cloneNode(true);
    const enlace = tarjeta.querySelector('a');
    const destino = new URL('pelicula.html', window.location.href);

    destino.searchParams.set('id', pelicula.id);
    enlace.href = destino;
    enlace.title = pelicula.titulo;
    tarjeta.querySelector('.favorita-title').textContent = pelicula.titulo;
    tarjeta.querySelector('.favorita-meta').textContent = `${pelicula.anioEstreno} · Favorita`;

    const boton = tarjeta.querySelector('.btn-quitar-favorita');

    boton.dataset.peliculaId = pelicula.id;

    mostrarPoster(
      {
        imagen: tarjeta.querySelector('.favorita-poster'),
        marcador: tarjeta.querySelector('.poster-placeholder'),
      },
      pelicula.rutaPoster,
      pelicula.titulo,
    );

    return tarjeta;
  }

  #abrirBuscadorFavoritas() {
    const seleccionadas = this.#favoritas.map((pelicula) => pelicula.id);

    if (!this.#buscadorFavoritas) {
      this.#buscadorFavoritas = new BuscadorPeliculas({
        titulo: 'Elegir mis favoritas',
        descripcion: 'Buscá películas y elegí hasta 5 favoritas.',
        maxSeleccion: MAXIMO_FAVORITAS,
        seleccionadas,
        etiquetaContador: 'elegidas',
        onSeleccionar: (pelicula) => this.#agregarFavorita(pelicula),
        onQuitar: (pelicula) => this.#quitarFavorita(pelicula.id),
      });
    } else {
      this.#buscadorFavoritas.establecerSeleccionadas(seleccionadas);
    }

    this.#buscadorFavoritas.abrir();
  }

  async #agregarFavorita(pelicula) {
    if (this.#favoritas.some((favorita) => favorita.id === pelicula.id)) {
      return;
    }

    await this.#guardarFavoritas([...this.#favoritas, pelicula]);
  }

  async #quitarFavorita(peliculaId, boton = null) {
    if (boton) {
      boton.disabled = true;
    }

    try {
      await this.#guardarFavoritas(
        this.#favoritas.filter((favorita) => favorita.id !== peliculaId),
      );
    } catch (error) {
      if (!boton) {
        throw error;
      }
    } finally {
      if (boton) {
        boton.disabled = false;
      }
    }
  }

  async #guardarFavoritas(favoritas) {
    try {
      const resultado = await actualizarFavoritas(
        this.#usuarioId,
        favoritas.map((pelicula) => pelicula.id),
      );

      this.#favoritas = resultado.favoritas;
      this.#mostrarFavoritas();
      this.#buscadorFavoritas?.establecerSeleccionadas(
        this.#favoritas.map((pelicula) => pelicula.id),
      );
      this.#ocultarAvisoFavoritas();
    } catch (error) {
      this.#mostrarAvisoFavoritas(mensajeDeError(error));
      throw error;
    }
  }

  #mostrarAvisoFavoritas(texto) {
    this.#elementos.avisoFavoritas.textContent = texto;
    this.#elementos.avisoFavoritas.classList.remove('d-none');
  }

  #ocultarAvisoFavoritas() {
    this.#elementos.avisoFavoritas.classList.add('d-none');
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

  #mostrarVistas() {
    const { contenedorVistas, plantillaVista } = this.#elementos;

    if (this.#visualizaciones.length === 0) {
      contenedorVistas.replaceChildren(
        this.#crearMensaje(
          'Todavía no marcaste películas como vistas. Buscá una película y registrala.',
        ),
      );
      return;
    }

    contenedorVistas.replaceChildren(
      ...this.#visualizacionesUnicas()
        .slice(0, CANTIDAD_VISTAS)
        .map(({ pelicula, fecha, puntuacion }) => {
          const tarjeta = this.#crearTarjetaPelicula(pelicula, {
            plantilla: plantillaVista,
            imagen: '.viewed-poster',
            marcador: '.poster-placeholder',
            titulo: '.viewed-title',
            meta: '.viewed-meta',
            textoMeta: `${pelicula.anioEstreno} · Vista el ${formatearFechaDeVista(fecha)}`,
          });
          const rating = tarjeta.querySelector('.viewed-rating');
          const resena = this.#resenas.find((item) => item.pelicula.id === pelicula.id);
          const puntuacionVigente = resena?.puntuacion ?? puntuacion;
          const tienePuntuacion = Number.isInteger(puntuacionVigente) && puntuacionVigente > 0;

          rating.textContent = tienePuntuacion
            ? `Tu puntuación: ${'★'.repeat(puntuacionVigente)}${'☆'.repeat(PUNTUACION_MAXIMA - puntuacionVigente)}`
            : 'Sin puntuación';
          rating.classList.add(tienePuntuacion ? 'text-warning' : 'text-secondary');

          return tarjeta;
        }),
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
  #visualizacionesUnicas() {
    const vistas = new Set();
    const visualizaciones = [];

    for (const visualizacion of this.#visualizaciones) {
      const id = visualizacion.pelicula.id;

      if (!vistas.has(id)) {
        vistas.add(id);
        visualizaciones.push(visualizacion);
      }
    }

    return visualizaciones;
  }

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
    tarjeta.querySelector('.review-rating').textContent = resena.puntuacion
      ? `${'★'.repeat(resena.puntuacion)}`
      : '';
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
    btnElegirFavoritas: document.getElementById('btn-elegir-favoritas'),
    avisoFavoritas: document.getElementById('favoritas-aviso'),
    contenedorFavoritas: document.getElementById('favoritas-perfil-container'),
    plantillaFavorita: document.getElementById('tpl-perfil-favorita'),
    contenedorRecientes: document.getElementById('recent-movies-container'),
    contenedorVistas: document.getElementById('viewed-movies-container'),
    contenedorWatchlist: document.getElementById('watchlists-container'),
    contenedorResenas: document.getElementById('user-reviews-container'),
    plantillaPelicula: document.getElementById('tpl-recent-movie'),
    plantillaVista: document.getElementById('tpl-viewed-movie'),
    plantillaWatchlist: document.getElementById('tpl-watchlist-card'),
    plantillaResena: document.getElementById('tpl-user-review-card'),
  },
});

await perfil.iniciar();
