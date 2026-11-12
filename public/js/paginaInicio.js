import { buscarPeliculas, obtenerTendencias } from './peliculasApi.js';
import { leerPagina, mensajeDeError, mostrarPoster, urlImagen } from './utilidades.js';

const TITULO_TENDENCIAS = 'Trending';
const ICONO_TENDENCIAS = 'bi bi-fire text-warning me-2';
const ICONO_BUSQUEDA = 'bi bi-search text-success me-2';
const DESTACADOS_MAXIMOS = 5;

/**
 * Grilla paginada de películas de index.html. Con una consulta muestra los
 * resultados de la búsqueda; sin consulta, las películas en tendencia.
 */
class ListadoPeliculas {
  #elementos;
  #consulta;
  #pagina;
  #solicitudActual = 0;
  #destacadosMostrados = false;

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
      // Los destacados son tendencias: no tienen sentido en una búsqueda.
      this.#ocultarDestacados();
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

    if (!this.#consulta && !this.#destacadosMostrados) {
      this.#destacadosMostrados = this.#mostrarDestacados(data);
    }

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

    if (!this.#consulta && !this.#destacadosMostrados) {
      this.#ocultarDestacados();
    }

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
   * Completa el carrusel superior con las primeras tendencias de la página.
   */
  #mostrarDestacados(peliculas) {
    const { seccionDestacados, contenedorDestacados, carrusel } = this.#elementos;

    if (!seccionDestacados || !contenedorDestacados || !carrusel) {
      return false;
    }

    const destacadas = peliculas.slice(0, DESTACADOS_MAXIMOS);

    if (destacadas.length === 0) {
      this.#ocultarDestacados();
      return false;
    }

    seccionDestacados.classList.remove('d-none');

    contenedorDestacados.replaceChildren(
      ...destacadas.map((pelicula, indice) => this.#crearDestacado(pelicula, indice === 0)),
    );

    // El carrusel se inicializó con la diapositiva de carga; se rearma con las nuevas.
    window.bootstrap?.Carousel?.getOrCreateInstance(carrusel)?.cycle();

    return true;
  }

  #ocultarDestacados() {
    this.#elementos.seccionDestacados?.classList.add('d-none');
  }

  /**
   * Arma una diapositiva del carrusel con el backdrop (o póster) de fondo y el título.
   */
  #crearDestacado(pelicula, activa) {
    const item = document.createElement('div');

    item.className = activa ? 'carousel-item active' : 'carousel-item';

    const fondo = document.createElement('div');
    const imagenFondo = urlImagen(
      pelicula.rutaBackdrop ?? pelicula.rutaPoster,
      pelicula.rutaBackdrop ? 'w1280' : 'w780',
    );

    fondo.className = 'hero-carousel-item';

    const backdrop = document.createElement('div');

    backdrop.className = 'hero-carousel-backdrop';

    if (!pelicula.rutaBackdrop) {
      backdrop.classList.add('hero-carousel-backdrop-poster');
    }

    if (imagenFondo) {
      backdrop.style.backgroundImage = `url(${JSON.stringify(imagenFondo)})`;
    }

    const overlay = document.createElement('div');

    overlay.className = 'hero-overlay';

    const copy = document.createElement('div');

    copy.className = 'hero-copy';

    const etiqueta = document.createElement('span');
    etiqueta.className = 'section-tag text-success fw-bold micro-text';
    etiqueta.textContent = 'DESTACADO';

    const titulo = document.createElement('h2');
    titulo.className = 'h3 text-white fw-bold mb-1';
    titulo.textContent = pelicula.titulo;

    const meta = document.createElement('p');
    meta.className = 'text-secondary mb-3';
    meta.textContent = `Película · ${pelicula.anioEstreno}`;

    const enlace = document.createElement('a');
    enlace.className = 'btn btn-success rounded-pill px-4 fw-medium align-self-start';
    enlace.href = `pelicula.html?id=${encodeURIComponent(pelicula.id)}`;
    enlace.textContent = 'Ver ficha';

    copy.append(etiqueta, titulo, meta, enlace);

    const posterContenedor = document.createElement('div');
    const posterImagen = document.createElement('img');
    const posterMarcador = document.createElement('div');
    const posterIcono = document.createElement('i');

    posterContenedor.className = 'hero-poster';
    posterImagen.className = 'hero-poster-img d-none';
    posterImagen.decoding = 'async';
    posterImagen.alt = '';
    posterMarcador.className =
      'hero-poster-placeholder d-flex align-items-center justify-content-center';
    posterIcono.className = 'bi bi-film';

    posterMarcador.append(posterIcono);
    posterContenedor.append(posterImagen, posterMarcador);
    mostrarPoster(
      { imagen: posterImagen, marcador: posterMarcador },
      pelicula.rutaPoster,
      pelicula.titulo,
      'w780',
    );

    overlay.append(copy, posterContenedor);
    fondo.append(backdrop, overlay);
    item.append(fondo);

    return item;
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
    seccionDestacados: document.querySelector('.hero-carousel-section'),
    contenedorDestacados: document.getElementById('carousel-items-container'),
    carrusel: document.getElementById('heroCarousel'),
  },
  consulta: (parametros.get('q') ?? '').trim(),
  pagina: leerPagina(parametros.get('page')),
});

await listado.iniciar();
