import { buscarPeliculas, obtenerTendencias } from './peliculasApi.js';
import { leerPagina, mensajeDeError, mostrarPoster } from './utilidades.js';

const TITULO_TENDENCIAS = 'Trending';
const ICONO_TENDENCIAS = 'bi bi-fire text-warning me-2';
const ICONO_BUSQUEDA = 'bi bi-search text-success me-2';

/**
 * Grilla paginada de películas de index.html. Con una consulta muestra los
 * resultados de la búsqueda; sin consulta, las películas en tendencia.
 */
class ListadoPeliculas {
  #elementos;
  #consulta;
  #pagina;
  #solicitudActual = 0;

  /**
   * `elementos` reúne los nodos del DOM que usa el listado: contenedor, plantilla,
   * titulo, icono, estado, btnAnterior y btnSiguiente.
   */
  constructor({ elementos, consulta = '', pagina = 1 }) {
    this.#elementos = elementos;
    this.#consulta = consulta;
    this.#pagina = pagina;
  }

  /**
   * Prepara el encabezado, conecta la paginación y carga la primera página.
   */
  async iniciar() {
    const { titulo, icono, btnAnterior, btnSiguiente } = this.#elementos;

    if (this.#consulta) {
      titulo.textContent = `Resultados para «${this.#consulta}»`;
      icono.className = ICONO_BUSQUEDA;
      document.title = `Fotograma - ${this.#consulta}`;
    } else {
      titulo.textContent = TITULO_TENDENCIAS;
      icono.className = ICONO_TENDENCIAS;
    }

    btnAnterior.addEventListener('click', () => this.cargar(this.#pagina - 1));
    btnSiguiente.addEventListener('click', () => this.cargar(this.#pagina + 1));

    await this.cargar(this.#pagina);
  }

  /**
   * Pide una página a la API y la muestra. Si mientras tanto se pidió otra,
   * descarta esta respuesta para no pisar la más reciente.
   */
  async cargar(pagina) {
    const solicitud = ++this.#solicitudActual;

    this.#mostrarCargando();

    try {
      const coleccion = this.#consulta
        ? await buscarPeliculas({ q: this.#consulta, page: pagina })
        : await obtenerTendencias({ page: pagina });

      if (solicitud === this.#solicitudActual) {
        this.#mostrar(coleccion);
      }
    } catch (error) {
      if (solicitud === this.#solicitudActual) {
        this.#mostrarError(error, pagina);
      }
    }
  }

  #mostrarCargando() {
    const { contenedor, estado, btnAnterior, btnSiguiente } = this.#elementos;

    btnAnterior.disabled = true;
    btnSiguiente.disabled = true;
    estado.textContent = '';
    contenedor.replaceChildren(this.#crearMensaje('Cargando películas...'));
  }

  #mostrar({ data, page, limit, total }) {
    const { contenedor, estado, btnAnterior, btnSiguiente } = this.#elementos;

    this.#pagina = page;
    this.#actualizarUrl();

    if (data.length === 0) {
      contenedor.replaceChildren(this.#crearMensaje(this.#textoSinResultados()));
      btnAnterior.disabled = page <= 1;
      btnSiguiente.disabled = true;
      return;
    }

    contenedor.replaceChildren(...data.map((pelicula) => this.#crearTarjeta(pelicula)));
    estado.textContent = this.#consulta
      ? `${total} ${total === 1 ? 'resultado' : 'resultados'}`
      : '';
    btnAnterior.disabled = page <= 1;
    btnSiguiente.disabled = page * limit >= total;
  }

  #mostrarError(error, pagina) {
    const { contenedor, btnAnterior, btnSiguiente } = this.#elementos;
    const aviso = this.#crearMensaje(mensajeDeError(error), 'alert alert-danger py-2 fs-7 mb-2');
    const reintentar = document.createElement('button');

    reintentar.type = 'button';
    reintentar.className = 'btn btn-sm btn-outline-light rounded-pill px-3';
    reintentar.textContent = 'Reintentar';
    reintentar.addEventListener('click', () => this.cargar(pagina));

    contenedor.replaceChildren(aviso, reintentar);
    btnAnterior.disabled = this.#pagina <= 1;
    btnSiguiente.disabled = true;
  }

  #textoSinResultados() {
    return this.#consulta
      ? `No encontramos películas para «${this.#consulta}». Probá con otro título.`
      : 'No hay películas para mostrar por ahora.';
  }

  #crearMensaje(texto, clases = 'text-secondary py-3') {
    const mensaje = document.createElement('div');

    mensaje.className = clases;
    mensaje.setAttribute('role', 'status');
    mensaje.textContent = texto;

    return mensaje;
  }

  /**
   * Clona la plantilla de tarjeta y la completa con los datos de la película.
   */
  #crearTarjeta(pelicula) {
    const tarjeta = this.#elementos.plantilla.content.cloneNode(true);
    const enlace = tarjeta.querySelector('a');
    const destino = new URL('pelicula.html', window.location.href);

    destino.searchParams.set('id', pelicula.id);
    enlace.href = destino;
    enlace.title = pelicula.titulo;
    tarjeta.querySelector('.movie-title').textContent = pelicula.titulo;
    tarjeta.querySelector('.movie-meta').textContent = pelicula.anioEstreno;

    mostrarPoster(
      {
        imagen: tarjeta.querySelector('.poster-img'),
        marcador: tarjeta.querySelector('.poster-placeholder'),
      },
      pelicula.rutaPoster,
      pelicula.titulo,
    );

    return tarjeta;
  }

  /**
   * Refleja la búsqueda y la página en la URL para poder recargar o compartir el enlace.
   */
  #actualizarUrl() {
    const url = new URL(window.location.href);

    url.searchParams.delete('page');

    if (this.#pagina > 1) {
      url.searchParams.set('page', this.#pagina);
    }

    window.history.replaceState(null, '', url);
  }
}

// Arranque de index.html: búsqueda por ?q= y página por ?page=.
const parametros = new URLSearchParams(window.location.search);

const listado = new ListadoPeliculas({
  elementos: {
    contenedor: document.getElementById('movies-container'),
    plantilla: document.getElementById('tpl-movie-card'),
    titulo: document.getElementById('listado-titulo'),
    icono: document.getElementById('listado-icono'),
    estado: document.getElementById('listado-estado'),
    btnAnterior: document.getElementById('btn-prev'),
    btnSiguiente: document.getElementById('btn-next'),
  },
  consulta: (parametros.get('q') ?? '').trim(),
  pagina: leerPagina(parametros.get('page')),
});

await listado.iniciar();
