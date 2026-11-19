import { usuarioDeSesion } from './auth.js';
import {
  actualizarOpciones,
  compararPuntuacion,
  compararTitulo,
  cumpleFiltroPuntuacion,
  filtrarPorAnio,
  filtrarPorGenero,
} from './filtrosPeliculas.js';
import {
  buscarPeliculas,
  obtenerCatalogo,
  obtenerRecomendadas,
  obtenerTendencias,
} from './api/peliculasApi.js';
import { listarResenasRecientes } from './api/resenasApi.js';
import {
  enlazarResenaAPerfil,
  formatearFecha,
  leerPagina,
  mensajeDeError,
  mostrarPoster,
  urlImagen,
  urlPerfilUsuario,
} from './utilidades.js';

const TITULO_CATALOGO = 'Catálogo';
const ICONO_CATALOGO = 'bi bi-collection-play text-success me-2';
const ICONO_BUSQUEDA = 'bi bi-search text-success me-2';
const DESTACADOS_MAXIMOS = 5;
const RESENAS_RECIENTES = 10;
const LARGO_COMENTARIO = 220;
const ESTADO_NO_AUTORIZADO = 401;

/**
 * Grilla paginada de películas de index.html. Con una consulta muestra los
 * resultados de la búsqueda; sin consulta, un catálogo amplio para explorar.
 */
class ListadoPeliculas {
  #elementos;
  #consulta;
  #pagina;
  #solicitudActual = 0;
  #peliculasPagina = [];
  #generos = new Set();
  #anios = new Set();
  #total = 0;

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
      titulo.textContent = `Resultados para “${this.#consulta}”`;
      icono.className = ICONO_BUSQUEDA;
      document.title = `Fotograma - ${this.#consulta}`;
      this.#ocultarDestacados();
      this.#ocultarFiltros();
    } else {
      titulo.textContent = TITULO_CATALOGO;
      icono.className = ICONO_CATALOGO;
      this.#conectarFiltros();
    }

    btnAnterior.addEventListener('click', () => this.cargar(this.#pagina - 1));
    btnSiguiente.addEventListener('click', () => this.cargar(this.#pagina + 1));

    const tareas = [this.cargar(this.#pagina)];

    if (!this.#consulta) {
      tareas.push(this.#cargarDestacados());
    }

    await Promise.all(tareas);
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
        : await obtenerCatalogo({ page: pagina });

      if (solicitud === this.#solicitudActual) {
        this.#mostrar(coleccion);
      }
    } catch (error) {
      if (solicitud === this.#solicitudActual) {
        this.#mostrarError(error, pagina);
      }
    }
  }

  /**
   * Carga solo el carrusel con las tendencias semanales, independiente de la grilla.
   */
  async #cargarDestacados() {
    try {
      const { data } = await obtenerTendencias({ page: 1 });

      this.#mostrarDestacados(data);
    } catch {
      this.#ocultarDestacados();
    }
  }

  #conectarFiltros() {
    const { filtros, filtroGenero, filtroPuntuacion, filtroAnio, orden, btnLimpiarFiltros } =
      this.#elementos;

    filtros?.classList.remove('d-none');

    for (const select of [filtroGenero, filtroPuntuacion, filtroAnio, orden]) {
      select?.addEventListener('change', () => this.#renderizarPagina());
    }

    btnLimpiarFiltros?.addEventListener('click', () => {
      filtroGenero.value = '';
      filtroPuntuacion.value = '';
      filtroAnio.value = '';
      orden.value = 'tendencia';
      this.#renderizarPagina();
    });
  }

  #ocultarFiltros() {
    this.#elementos.filtros?.classList.add('d-none');
  }

  #actualizarFiltros(peliculas) {
    for (const pelicula of peliculas) {
      for (const genero of pelicula.generos ?? []) {
        this.#generos.add(genero);
      }

      if (Number.isInteger(pelicula.anioEstreno)) {
        this.#anios.add(pelicula.anioEstreno);
      }
    }

    const generos = [...this.#generos].sort(compararTitulo);
    const anios = [...this.#anios].sort((a, b) => b - a);

    actualizarOpciones(this.#elementos.filtroGenero, generos, 'Todos los géneros');
    actualizarOpciones(this.#elementos.filtroAnio, anios, 'Todos los años');
  }

  #filtrarPagina() {
    const { filtroGenero, filtroPuntuacion, filtroAnio } = this.#elementos;
    const genero = filtroGenero?.value ?? '';
    const puntuacion = filtroPuntuacion?.value ?? '';
    const anio = filtroAnio?.value ?? '';
    const filtradas = this.#peliculasPagina.filter(
      (pelicula) =>
        filtrarPorGenero(pelicula, genero) &&
        filtrarPorAnio(pelicula, anio) &&
        cumpleFiltroPuntuacion(pelicula.puntuacionTmdb, puntuacion),
    );

    return this.#ordenarPagina(filtradas);
  }

  #ordenarPagina(peliculas) {
    const orden = this.#elementos.orden?.value;
    const descendente = orden === 'puntuacion_desc';

    if (descendente || orden === 'puntuacion_asc') {
      peliculas.sort((a, b) => compararPuntuacion(a.puntuacionTmdb, b.puntuacionTmdb, descendente));
    } else if (orden === 'anio_desc') {
      peliculas.sort((a, b) => b.anioEstreno - a.anioEstreno);
    } else if (orden === 'anio_asc') {
      peliculas.sort((a, b) => a.anioEstreno - b.anioEstreno);
    } else if (orden === 'titulo_asc') {
      peliculas.sort((a, b) => compararTitulo(a.titulo, b.titulo));
    }

    return peliculas;
  }

  #hayFiltrosActivos() {
    const { filtroGenero, filtroPuntuacion, filtroAnio, orden } = this.#elementos;

    return Boolean(
      filtroGenero?.value ||
      filtroPuntuacion?.value ||
      filtroAnio?.value ||
      (orden?.value && orden.value !== 'tendencia'),
    );
  }

  #renderizarPagina() {
    const { contenedor } = this.#elementos;
    const visibles = this.#consulta ? this.#peliculasPagina : this.#filtrarPagina();

    if (visibles.length === 0) {
      contenedor.replaceChildren(this.#crearMensaje(this.#textoSinResultados()));
    } else {
      contenedor.replaceChildren(...visibles.map((pelicula) => this.#crearTarjeta(pelicula)));
    }

    this.#actualizarEstado(visibles);
  }

  #actualizarEstado(visibles) {
    const { estado } = this.#elementos;

    if (this.#consulta) {
      estado.textContent = `${this.#total} ${this.#total === 1 ? 'resultado' : 'resultados'}`;
      return;
    }

    estado.textContent = this.#hayFiltrosActivos()
      ? `${visibles.length} de ${this.#peliculasPagina.length} en esta página`
      : '';
  }

  #mostrarCargando() {
    const { contenedor, estado, btnAnterior, btnSiguiente } = this.#elementos;

    btnAnterior.disabled = true;
    btnSiguiente.disabled = true;
    estado.textContent = '';
    contenedor.replaceChildren(this.#crearMensaje('Cargando películas...'));
  }

  #mostrar({ data, page, limit, total }) {
    const { btnAnterior, btnSiguiente } = this.#elementos;

    this.#pagina = page;
    this.#peliculasPagina = data;
    this.#total = total;
    this.#actualizarUrl();

    if (!this.#consulta) {
      this.#actualizarFiltros(data);
    }

    this.#renderizarPagina();

    btnAnterior.disabled = page <= 1;
    btnSiguiente.disabled = data.length === 0 || page * limit >= total;
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
    if (this.#consulta) {
      return `No encontramos películas para “${this.#consulta}”. Probá con otro título.`;
    }

    return this.#hayFiltrosActivos()
      ? 'No hay películas que coincidan con los filtros en esta página.'
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
    return crearTarjetaPelicula(pelicula, this.#elementos.plantilla);
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

/**
 * Clona la plantilla de tarjeta y la completa con los datos de la película.
 * Se usa tanto en el listado como en las recomendaciones.
 */
function crearTarjetaPelicula(pelicula, plantilla) {
  const tarjeta = plantilla.content.cloneNode(true);
  const enlace = tarjeta.querySelector('a');
  const destino = new URL('pelicula.html', window.location.href);

  destino.searchParams.set('id', pelicula.id);
  enlace.href = destino;
  enlace.title = pelicula.titulo;
  tarjeta.querySelector('.movie-title').textContent = pelicula.titulo;
  tarjeta.querySelector('.movie-meta').textContent = Number.isFinite(pelicula.puntuacionTmdb)
    ? `${pelicula.anioEstreno} · ★ ${pelicula.puntuacionTmdb}`
    : String(pelicula.anioEstreno);

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
 * Recorta un texto largo para que la tarjeta de reseña no ocupe media pantalla.
 */
function recortarTexto(texto, maximo) {
  const limpio = texto.trim();

  return limpio.length > maximo ? `${limpio.slice(0, maximo).trimEnd()}…` : limpio;
}

function crearMensajeResenas(texto, clases = 'text-secondary py-3 w-100') {
  const mensaje = document.createElement('div');

  mensaje.className = clases;
  mensaje.setAttribute('role', 'status');
  mensaje.textContent = texto;

  return mensaje;
}

/**
 * Clona la plantilla de reseña reciente y la completa con los datos públicos.
 */
function crearTarjetaResena(resena, plantilla) {
  const tarjeta = plantilla.content.cloneNode(true);
  const destino = new URL('pelicula.html', window.location.href);

  destino.searchParams.set('id', resena.pelicula.id);

  for (const enlace of tarjeta.querySelectorAll('.resena-pelicula-link')) {
    enlace.href = destino;
  }

  tarjeta.querySelector('.resena-reciente-titulo').textContent = resena.pelicula.titulo;
  tarjeta.querySelector('.resena-reciente-meta').textContent =
    `${resena.pelicula.anioEstreno} · ${formatearFecha(resena.fechaPublicacion)}`;
  tarjeta.querySelector('.resena-reciente-comentario').textContent = recortarTexto(
    resena.comentario,
    LARGO_COMENTARIO,
  );

  const autor = tarjeta.querySelector('.resena-reciente-autor');

  autor.href = urlPerfilUsuario(resena.autor.id);
  autor.title = `Ver perfil de ${resena.autor.nombre}`;
  autor.textContent = `@${resena.autor.nombreUsuario}`;

  enlazarResenaAPerfil(tarjeta.querySelector('.resena-reciente'), resena.autor);

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

/**
 * Carga las últimas reseñas públicas del index. No requiere sesión.
 */
async function cargarResenasRecientes() {
  const contenedor = document.getElementById('reviews-container');
  const plantilla = document.getElementById('tpl-resena-reciente');

  if (!contenedor || !plantilla) {
    return;
  }

  contenedor.replaceChildren(crearMensajeResenas('Cargando reseñas...'));

  try {
    const { data } = await listarResenasRecientes({ limit: RESENAS_RECIENTES });

    if (data.length === 0) {
      contenedor.replaceChildren(
        crearMensajeResenas(
          'Todavía no hay reseñas. Iniciá sesión, buscá una película y escribí la primera.',
        ),
      );
      return;
    }

    contenedor.replaceChildren(...data.map((resena) => crearTarjetaResena(resena, plantilla)));
  } catch (error) {
    const aviso = crearMensajeResenas(
      mensajeDeError(error),
      'alert alert-danger py-2 fs-7 mb-2 w-100',
    );
    const reintentar = document.createElement('button');

    reintentar.type = 'button';
    reintentar.className = 'btn btn-sm btn-outline-light rounded-pill px-3';
    reintentar.textContent = 'Reintentar';
    reintentar.addEventListener('click', () => cargarResenasRecientes());

    contenedor.replaceChildren(aviso, reintentar);
  }
}

/**
 * Carga las recomendaciones personalizadas del index. Sin sesión la API responde
 * 401 y la sección queda vacía; auth.js se encarga de ocultarla.
 */
async function cargarRecomendadas() {
  const contenedor = document.getElementById('recommended-container');
  const plantilla = document.getElementById('tpl-movie-card');

  if (!contenedor || !plantilla) {
    return;
  }

  contenedor.replaceChildren(crearMensajeResenas('Cargando recomendaciones...'));

  try {
    const { data } = await obtenerRecomendadas();

    if (data.length === 0) {
      contenedor.replaceChildren(
        crearMensajeResenas(
          'Todavía no tenemos recomendaciones para vos. Agregá una película a tu watchlist o registrá una visualización y volvé a mirar.',
        ),
      );
      return;
    }

    contenedor.replaceChildren(
      ...data.map((pelicula) => crearTarjetaPelicula(pelicula, plantilla)),
    );
  } catch (error) {
    if (error.status === ESTADO_NO_AUTORIZADO) {
      contenedor.replaceChildren();
      return;
    }

    const aviso = crearMensajeResenas(
      mensajeDeError(error),
      'alert alert-danger py-2 fs-7 mb-2 w-100',
    );
    const reintentar = document.createElement('button');

    reintentar.type = 'button';
    reintentar.className = 'btn btn-sm btn-outline-light rounded-pill px-3';
    reintentar.textContent = 'Reintentar';
    reintentar.addEventListener('click', () => cargarRecomendadas());

    contenedor.replaceChildren(aviso, reintentar);
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
    filtros: document.getElementById('trending-filters'),
    filtroGenero: document.getElementById('trending-genero'),
    filtroPuntuacion: document.getElementById('trending-puntuacion'),
    filtroAnio: document.getElementById('trending-anio'),
    orden: document.getElementById('trending-orden'),
    btnLimpiarFiltros: document.getElementById('trending-limpiar'),
    seccionDestacados: document.querySelector('.hero-carousel-section'),
    contenedorDestacados: document.getElementById('carousel-items-container'),
    carrusel: document.getElementById('heroCarousel'),
  },
  consulta: (parametros.get('q') ?? '').trim(),
  pagina: leerPagina(parametros.get('page')),
});

document.addEventListener('fg:sesion-cambiada', (evento) => {
  const usuario = evento.detail?.usuario ?? null;

  if (!usuario || usuario.rol === 'admin') {
    document.getElementById('recommended-container')?.replaceChildren();
    return;
  }

  cargarRecomendadas();
});

const usuario = usuarioDeSesion();
const recomendaciones =
  usuario && usuario.rol !== 'admin' ? cargarRecomendadas() : Promise.resolve();

await Promise.all([listado.iniciar(), cargarResenasRecientes(), recomendaciones]);
