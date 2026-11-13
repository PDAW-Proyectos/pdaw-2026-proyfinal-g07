import { eliminarResena, listarMisResenas } from './resenasApi.js';
import { formatearFecha, mensajeDeError, mostrarPoster } from './utilidades.js';

const TAMANO_PAGINA = 12;
const TEXTO_CARGAR_MAS = 'Cargar más';
const TEXTO_REINTENTAR = 'No se pudo cargar. Reintentar';
const TEXTO_SIN_RESENAS =
  'Todavía no escribiste reseñas. Buscá una película y compartí tu opinión.';

/**
 * Página reviews.html: lista las reseñas del usuario y permite eliminarlas.
 */
class PaginaResenas {
  #elementos;
  #pagina = 0;
  #mostradas = 0;
  #total = 0;
  #eliminando = false;

  /**
   * `elementos` reúne el contenedor, la plantilla y el botón de paginación.
   */
  constructor({ elementos }) {
    this.#elementos = elementos;
  }

  async iniciar() {
    this.#elementos.btnMasResenas.addEventListener('click', () => this.#cargar());

    await this.#cargar();
  }

  /**
   * Pide la siguiente página y la agrega al listado.
   */
  async #cargar() {
    const { contenedor, btnMasResenas } = this.#elementos;
    const pagina = this.#pagina + 1;

    btnMasResenas.disabled = true;

    try {
      const { data, total } = await listarMisResenas({ page: pagina, limit: TAMANO_PAGINA });

      this.#pagina = pagina;
      this.#mostradas += data.length;
      this.#total = total;

      if (total === 0) {
        contenedor.replaceChildren(this.#crearMensaje(TEXTO_SIN_RESENAS));
      } else if (pagina === 1) {
        contenedor.replaceChildren(...data.map((resena) => this.#crearTarjeta(resena)));
      } else {
        contenedor.append(...data.map((resena) => this.#crearTarjeta(resena)));
      }

      btnMasResenas.textContent = TEXTO_CARGAR_MAS;
      btnMasResenas.classList.toggle('d-none', data.length === 0 || this.#mostradas >= total);
    } catch (error) {
      if (pagina === 1) {
        contenedor.replaceChildren(this.#crearMensaje(mensajeDeError(error)));
      } else {
        btnMasResenas.textContent = TEXTO_REINTENTAR;
      }
    } finally {
      btnMasResenas.disabled = false;
    }
  }

  #crearTarjeta(resena) {
    const tarjeta = this.#elementos.plantilla.content.cloneNode(true);
    const destino = new URL('pelicula.html', window.location.href);

    destino.searchParams.set('id', resena.pelicula.id);

    for (const enlace of tarjeta.querySelectorAll('a')) {
      enlace.href = destino;
    }

    tarjeta.querySelector('.review-movie-title').textContent = resena.pelicula.titulo;
    tarjeta.querySelector('.review-movie-year').textContent = resena.pelicula.anioEstreno;
    tarjeta.querySelector('.review-date').textContent = formatearFecha(resena.fechaPublicacion);
    tarjeta.querySelector('.review-text-content').textContent = resena.comentario;

    const botonEliminar = tarjeta.querySelector('.btn-eliminar-resena');

    botonEliminar.addEventListener('click', () => this.#eliminar(resena, botonEliminar));

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

  async #eliminar(resena, boton) {
    if (this.#eliminando) {
      return;
    }

    if (!window.confirm('¿Eliminar esta reseña? Esta acción no se puede deshacer.')) {
      return;
    }

    this.#eliminando = true;
    boton.disabled = true;

    try {
      await eliminarResena(resena.id);

      boton.closest('.col-md-6')?.remove();
      this.#mostradas -= 1;
      this.#total -= 1;

      if (this.#mostradas === 0 && this.#total > 0) {
        // Quedan reseñas sin mostrar: se pide la página siguiente.
        await this.#cargar();
      } else if (this.#mostradas === 0) {
        this.#elementos.contenedor.replaceChildren(this.#crearMensaje(TEXTO_SIN_RESENAS));
        this.#elementos.btnMasResenas.classList.add('d-none');
      } else {
        this.#elementos.btnMasResenas.classList.toggle('d-none', this.#mostradas >= this.#total);
      }
    } catch (error) {
      window.alert(mensajeDeError(error));
    } finally {
      this.#eliminando = false;

      if (boton.isConnected) {
        boton.disabled = false;
      }
    }
  }

  #crearMensaje(texto) {
    const mensaje = document.createElement('div');

    mensaje.className = 'text-secondary py-3 text-center w-100';
    mensaje.textContent = texto;

    return mensaje;
  }
}

const pagina = new PaginaResenas({
  elementos: {
    contenedor: document.getElementById('all-reviews-container'),
    plantilla: document.getElementById('tpl-community-review-card'),
    btnMasResenas: document.getElementById('btn-mas-resenas'),
  },
});

await pagina.iniciar();
