import { obtenerPelicula, obtenerResenasDePelicula } from './peliculasApi.js';
import { formatearFecha, mensajeDeError, mostrarPoster } from './utilidades.js';

const ESTADO_NO_ENCONTRADA = 404;
const TEXTO_MAS_RESENAS = 'Ver más reseñas';

/**
 * Ficha de pelicula.html: carga por HTTP la película indicada en ?id= y sus reseñas.
 */
class PaginaPelicula {
  #elementos;
  #peliculaId;
  #paginaResenas = 0;
  #resenasMostradas = 0;

  /**
   * `elementos` reúne los nodos del DOM que usa la página; `peliculaId` es el id interno
   * tomado de la URL (o null si falta).
   */
  constructor({ elementos, peliculaId }) {
    this.#elementos = elementos;
    this.#peliculaId = peliculaId;
  }

  /**
   * Carga la película y sus reseñas en paralelo; un fallo en las reseñas no oculta la ficha.
   */
  async iniciar() {
    this.#elementos.btnMasResenas.addEventListener('click', () => this.#cargarResenas());

    if (!this.#peliculaId) {
      this.#mostrarFichaNoDisponible('No indicaste qué película querés ver.');
      return;
    }

    const [pelicula] = await Promise.all([this.#cargarPelicula(), this.#cargarResenas()]);

    if (!pelicula) {
      this.#elementos.btnMasResenas.classList.add('d-none');
    }
  }

  /**
   * Pide la ficha y la muestra. Devuelve la película, o null si no se pudo cargar.
   */
  async #cargarPelicula() {
    try {
      const pelicula = await obtenerPelicula(this.#peliculaId);

      this.#mostrarPelicula(pelicula);
      return pelicula;
    } catch (error) {
      this.#mostrarFichaNoDisponible(
        error.status === ESTADO_NO_ENCONTRADA
          ? 'No encontramos esa película.'
          : mensajeDeError(error),
      );
      return null;
    }
  }

  #mostrarPelicula(pelicula) {
    const { titulo, anio, sinopsis, generos, plantillaGenero, poster, marcadorPoster } =
      this.#elementos;

    document.title = `Fotograma - ${pelicula.titulo}`;
    titulo.textContent = pelicula.titulo;
    anio.textContent = `(${pelicula.anioEstreno})`;
    sinopsis.textContent = pelicula.sinopsis || 'Esta película todavía no tiene sinopsis.';

    generos.replaceChildren(
      ...pelicula.generos.map((genero) => {
        const insignia = plantillaGenero.content.cloneNode(true);

        insignia.querySelector('span').textContent = genero;

        return insignia;
      }),
    );

    mostrarPoster(
      { imagen: poster, marcador: marcadorPoster },
      pelicula.rutaPoster,
      pelicula.titulo,
      'w500',
    );
  }

  /**
   * Reemplaza la ficha por un aviso cuando no hay película que mostrar.
   */
  #mostrarFichaNoDisponible(mensaje) {
    const { ficha, aviso, textoAviso, resenas } = this.#elementos;

    document.title = 'Fotograma - Película no disponible';
    textoAviso.textContent = mensaje;
    ficha.classList.add('d-none');
    resenas.classList.add('d-none');
    aviso.classList.remove('d-none');
  }

  /**
   * Pide la siguiente página de reseñas y la agrega a la lista.
   */
  async #cargarResenas() {
    const { contenedorResenas, btnMasResenas } = this.#elementos;
    const pagina = this.#paginaResenas + 1;

    btnMasResenas.disabled = true;

    try {
      const { data, total } = await obtenerResenasDePelicula(this.#peliculaId, { page: pagina });

      this.#paginaResenas = pagina;
      this.#resenasMostradas += data.length;
      btnMasResenas.textContent = TEXTO_MAS_RESENAS;

      if (total === 0) {
        contenedorResenas.replaceChildren(
          this.#crearMensaje('Todavía no hay reseñas. ¡Sé el primero en escribir una!'),
        );
      } else if (pagina === 1) {
        contenedorResenas.replaceChildren(...data.map((resena) => this.#crearResena(resena)));
      } else {
        contenedorResenas.append(...data.map((resena) => this.#crearResena(resena)));
      }

      btnMasResenas.classList.toggle(
        'd-none',
        data.length === 0 || this.#resenasMostradas >= total,
      );
    } catch (error) {
      // Si falla la primera carga se muestra el aviso; si falla una página siguiente,
      // se conserva lo ya mostrado y se permite reintentar.
      if (pagina === 1) {
        contenedorResenas.replaceChildren(this.#crearMensaje(mensajeDeError(error)));
      } else {
        btnMasResenas.textContent = 'No se pudo cargar. Reintentar';
      }
    } finally {
      btnMasResenas.disabled = false;
    }
  }

  #crearMensaje(texto) {
    const mensaje = document.createElement('div');

    mensaje.className = 'col-12 text-secondary py-3';
    mensaje.textContent = texto;

    return mensaje;
  }

  /**
   * Clona la plantilla de reseña y la completa con los datos de la reseña.
   */
  #crearResena(resena) {
    const tarjeta = this.#elementos.plantillaResena.content.cloneNode(true);

    tarjeta.querySelector('.author-name').textContent = resena.autor.nombre;
    tarjeta.querySelector('.author-username').textContent = `@${resena.autor.nombreUsuario}`;
    tarjeta.querySelector('.review-date').textContent = formatearFecha(resena.fechaPublicacion);
    tarjeta.querySelector('.review-content').textContent = resena.comentario;

    return tarjeta;
  }
}

// Arranque de pelicula.html: la película indicada en ?id=.
const parametros = new URLSearchParams(window.location.search);

const pagina = new PaginaPelicula({
  elementos: {
    ficha: document.getElementById('ficha-pelicula'),
    aviso: document.getElementById('pelicula-no-disponible'),
    textoAviso: document.getElementById('pelicula-no-disponible-texto'),
    titulo: document.getElementById('movie-title'),
    anio: document.getElementById('movie-year'),
    sinopsis: document.getElementById('movie-description'),
    generos: document.getElementById('movie-genres'),
    plantillaGenero: document.getElementById('tpl-genre-badge'),
    poster: document.getElementById('movie-poster'),
    marcadorPoster: document.getElementById('poster-placeholder'),
    resenas: document.getElementById('movie-reviews-section'),
    contenedorResenas: document.getElementById('movie-reviews-container'),
    plantillaResena: document.getElementById('tpl-movie-review-card'),
    btnMasResenas: document.getElementById('btn-mas-resenas'),
  },
  peliculaId: parametros.get('id'),
});

await pagina.iniciar();
