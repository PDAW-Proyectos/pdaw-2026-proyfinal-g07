import { BuscadorPeliculas } from './buscadorPeliculas.js';
import { agregarAWatchlist, listarWatchlist, quitarDeWatchlist } from './watchlistApi.js';
import { fechaDeHoy, formatearFecha, mensajeDeError, mostrarPoster } from './utilidades.js';
import { crearVisualizacion } from './visualizacionesApi.js';

const MENSAJE_VACIO =
  'Tu watchlist está vacía. Buscá una película y guardala para verla más tarde.';

/**
 * Página watchlist.html: lista las películas pendientes del usuario y permite quitarlas.
 */
class PaginaWatchlist {
  #elementos;
  #buscador = null;
  #pagina = 0;
  #mostradas = 0;

  /**
   * `elementos` reúne el contenedor, la plantilla, el botón de paginación y el aviso.
   */
  constructor({ elementos }) {
    this.#elementos = elementos;
  }

  /**
   * Conecta la paginación y carga la primera página.
   */
  async iniciar() {
    this.#elementos.btnMas.addEventListener('click', () => this.#cargarSiguiente());
    this.#elementos.btnAgregar.addEventListener('click', () => this.#abrirBuscador());

    await this.#cargarSiguiente();
  }

  #abrirBuscador() {
    if (!this.#buscador) {
      this.#buscador = new BuscadorPeliculas({
        titulo: 'Agregar a la watchlist',
        descripcion: 'Buscá una película y agregala a tus pendientes.',
        maxSeleccion: 1,
        textoSeleccionar: 'Agregar',
        etiquetaContador: 'agregadas',
        cerrarAlSeleccionar: true,
        onSeleccionar: (pelicula) => this.#agregar(pelicula),
      });
    }

    this.#buscador.establecerSeleccionadas([]);
    this.#buscador.abrir();
  }

  async #agregar(pelicula) {
    await agregarAWatchlist(pelicula.id);

    this.#pagina = 0;
    this.#mostradas = 0;
    await this.#cargarSiguiente();
    this.#mostrarAviso(`Agregaste "${pelicula.titulo}" a tu watchlist.`, 'success');
  }

  /**
   * Pide la siguiente página y la agrega al final de la lista.
   */
  async #cargarSiguiente() {
    const { contenedor, btnMas } = this.#elementos;
    const pagina = this.#pagina + 1;

    btnMas.disabled = true;
    this.#ocultarAviso();

    try {
      const { data, total } = await listarWatchlist({ page: pagina });

      this.#pagina = pagina;
      this.#mostradas += data.length;

      if (pagina === 1) {
        contenedor.replaceChildren(
          ...(total === 0
            ? [this.#crearMensaje(MENSAJE_VACIO)]
            : data.map((entrada) => this.#crearTarjeta(entrada))),
        );
      } else {
        contenedor.append(...data.map((entrada) => this.#crearTarjeta(entrada)));
      }

      btnMas.classList.toggle('d-none', data.length === 0 || this.#mostradas >= total);
    } catch (error) {
      // Si falla la primera página se muestra el aviso en el contenedor; si falla una
      // página siguiente, se conserva lo ya mostrado y se permite reintentar.
      if (pagina === 1) {
        contenedor.replaceChildren(this.#crearMensaje(mensajeDeError(error)));
      } else {
        this.#mostrarAviso(mensajeDeError(error));
      }
    } finally {
      btnMas.disabled = false;
    }
  }

  /**
   * Clona la plantilla y completa la tarjeta con la película y su fecha de agregado.
   */
  #crearTarjeta({ pelicula, fechaAgregado, vista }) {
    const tarjeta = this.#elementos.plantilla.content.cloneNode(true);
    const enlace = tarjeta.querySelector('.watchlist-link');
    const destino = new URL('pelicula.html', window.location.href);

    destino.searchParams.set('id', pelicula.id);
    enlace.href = destino;
    enlace.title = pelicula.titulo;

    tarjeta.querySelector('.watchlist-movie-title').textContent = pelicula.titulo;
    tarjeta.querySelector('.watchlist-movie-meta').textContent =
      `${pelicula.anioEstreno} · Agregada el ${formatearFecha(fechaAgregado)}`;

    mostrarPoster(
      {
        imagen: tarjeta.querySelector('.watchlist-poster'),
        marcador: tarjeta.querySelector('.poster-placeholder'),
      },
      pelicula.rutaPoster,
      pelicula.titulo,
    );

    const btnQuitar = tarjeta.querySelector('.btn-remove-watchlist');

    btnQuitar.addEventListener('click', () => this.#quitar(pelicula, btnQuitar));

    const btnVista = tarjeta.querySelector('.btn-mark-watched');

    this.#actualizarBotonVista(btnVista, vista);
    btnVista.addEventListener('click', () => this.#marcarVista(pelicula, btnVista));

    return tarjeta;
  }

  /**
   * Sincroniza el botón con el estado de visualización de la película.
   */
  #actualizarBotonVista(boton, vista) {
    boton.disabled = vista;
    boton.classList.toggle('btn-success', vista);
    boton.classList.toggle('btn-outline-success', !vista);
    boton.innerHTML = vista
      ? '<i class="bi bi-check2-circle-fill me-1"></i> Vista'
      : '<i class="bi bi-check2-circle me-1"></i> Ya la vi';
    boton.title = vista
      ? 'Ya registraste esta película como vista'
      : 'Registrar que viste esta película';
  }

  /**
   * Quita la película de la watchlist y retira la tarjeta de la pantalla.
   */
  async #quitar(pelicula, boton) {
    boton.disabled = true;
    this.#ocultarAviso();

    try {
      await quitarDeWatchlist(pelicula.id);
      boton.closest('.watchlist-card-item')?.remove();
      this.#mostradas -= 1;

      // Si se vació la página visible puede haber más entradas: se recarga la primera
      // página para traer las que quedaron. Si la watchlist está vacía, muestra el aviso.
      if (this.#elementos.contenedor.children.length === 0) {
        this.#pagina = 0;
        this.#mostradas = 0;
        await this.#cargarSiguiente();
      }
    } catch (error) {
      boton.disabled = false;
      this.#mostrarAviso(mensajeDeError(error));
    }
  }

  /**
   * Registra la película como vista con la fecha de hoy.
   */
  async #marcarVista(pelicula, boton) {
    boton.disabled = true;
    this.#ocultarAviso();
    boton.innerHTML =
      '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Registrando...';

    try {
      await crearVisualizacion({ peliculaId: pelicula.id, fecha: fechaDeHoy() });
      this.#actualizarBotonVista(boton, true);
    } catch (error) {
      this.#actualizarBotonVista(boton, false);
      this.#mostrarAviso(mensajeDeError(error));
    }
  }

  #crearMensaje(texto) {
    const mensaje = document.createElement('div');

    mensaje.className = 'col-12 text-secondary py-4 text-center';
    mensaje.setAttribute('role', 'status');
    mensaje.textContent = texto;

    return mensaje;
  }

  #mostrarAviso(texto, tipo = 'danger') {
    this.#elementos.aviso.textContent = texto;
    this.#elementos.aviso.classList.toggle('alert-danger', tipo === 'danger');
    this.#elementos.aviso.classList.toggle('alert-success', tipo === 'success');
    this.#elementos.aviso.classList.remove('d-none');
  }

  #ocultarAviso() {
    this.#elementos.aviso.classList.add('d-none');
  }
}

// Arranque de watchlist.html.
const pagina = new PaginaWatchlist({
  elementos: {
    contenedor: document.getElementById('watchlist-movies-container'),
    plantilla: document.getElementById('tpl-watchlist-movie-card'),
    btnMas: document.getElementById('btn-mas-watchlist'),
    btnAgregar: document.getElementById('btn-add-to-watchlist'),
    aviso: document.getElementById('watchlist-aviso'),
  },
});

await pagina.iniciar();
