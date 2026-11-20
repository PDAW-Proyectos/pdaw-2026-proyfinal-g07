import { actualizarResena, eliminarResena, listarMisResenas } from './api/resenasApi.js';
import { LARGO_MAXIMO_COMENTARIO, PUNTUACION_MAXIMA } from './constantes.js';
import { formatearFecha, mensajeDeError, mostrarPoster } from './utilidades.js';

const TAMANO_PAGINA = 12;
const TEXTO_CARGAR_MAS = 'Cargar más';
const TEXTO_REINTENTAR = 'No se pudo cargar. Reintentar';
const TEXTO_SIN_RESENAS =
  'Todavía no escribiste reseñas. Buscá una película y compartí tu opinión.';

function textoPuntuacion(puntuacion) {
  return Number.isInteger(puntuacion) && puntuacion > 0 ? '★'.repeat(puntuacion) : 'Sin puntuación';
}

/**
 * Página reviews.html: lista las reseñas del usuario y permite editarlas o eliminarlas.
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
    this.#conectarResenas();
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

  #conectarResenas() {
    this.#elementos.contenedor.addEventListener('click', (evento) => {
      const botonEditar = evento.target.closest('.btn-editar-resena');

      if (botonEditar) {
        this.#iniciarEdicionResena(botonEditar);
        return;
      }

      const botonCancelar = evento.target.closest('.btn-cancelar-resena');

      if (botonCancelar) {
        this.#cancelarEdicionResena(botonCancelar);
        return;
      }

      const botonGuardar = evento.target.closest('.btn-guardar-resena');

      if (botonGuardar) {
        this.#guardarResenaEditada(botonGuardar);
      }
    });
  }

  #iniciarEdicionResena(boton) {
    const tarjeta = boton.closest('.review-card');

    if (!tarjeta) {
      return;
    }

    for (const otraTarjeta of this.#elementos.contenedor.querySelectorAll('.review-card')) {
      if (otraTarjeta === tarjeta) {
        this.#mostrarEditorResena(otraTarjeta);
      } else {
        this.#cerrarEditorResena(otraTarjeta);
      }
    }

    tarjeta.querySelector('.resena-comentario')?.focus();
  }

  #mostrarEditorResena(tarjeta) {
    const comentario = tarjeta.querySelector('.resena-comentario');
    const selector = tarjeta.querySelector('.resena-puntuacion');

    comentario.value = tarjeta.dataset.comentario ?? '';
    selector.value = tarjeta.dataset.puntuacion ?? '';
    tarjeta.querySelector('.review-text-content')?.classList.add('d-none');
    tarjeta.querySelector('.review-rating')?.classList.add('d-none');
    tarjeta.querySelector('.btn-editar-resena')?.classList.add('d-none');
    tarjeta.querySelector('.resena-error')?.classList.add('d-none');
    tarjeta.querySelector('.resena-edicion')?.classList.remove('d-none');
  }

  #cerrarEditorResena(tarjeta) {
    tarjeta.querySelector('.review-text-content')?.classList.remove('d-none');
    tarjeta.querySelector('.review-rating')?.classList.remove('d-none');
    tarjeta.querySelector('.btn-editar-resena')?.classList.remove('d-none');
    tarjeta.querySelector('.resena-edicion')?.classList.add('d-none');
    tarjeta.querySelector('.resena-error')?.classList.add('d-none');
  }

  #cancelarEdicionResena(boton) {
    const tarjeta = boton.closest('.review-card');

    if (tarjeta) {
      this.#cerrarEditorResena(tarjeta);
    }
  }

  async #guardarResenaEditada(boton) {
    const tarjeta = boton.closest('.review-card');
    const id = tarjeta?.querySelector('.btn-editar-resena')?.dataset.resenaId;

    if (!tarjeta || !id) {
      return;
    }

    const comentario = tarjeta.querySelector('.resena-comentario').value.trim();
    const valorPuntuacion = tarjeta.querySelector('.resena-puntuacion').value;
    const puntuacion = valorPuntuacion === '' ? null : Number(valorPuntuacion);
    const avisoError = tarjeta.querySelector('.resena-error');
    const botonGuardar = tarjeta.querySelector('.btn-guardar-resena');
    const botonCancelar = tarjeta.querySelector('.btn-cancelar-resena');

    if (comentario === '') {
      avisoError.textContent = 'Escribí tu reseña antes de guardar.';
      avisoError.classList.remove('d-none');
      tarjeta.querySelector('.resena-comentario').focus();
      return;
    }

    avisoError.classList.add('d-none');
    botonGuardar.disabled = true;
    botonCancelar.disabled = true;
    botonGuardar.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Guardando...';

    try {
      const actualizada = await actualizarResena(id, { comentario, puntuacion });

      this.#actualizarTarjeta(tarjeta, actualizada);
      this.#cerrarEditorResena(tarjeta);
    } catch (error) {
      avisoError.textContent = mensajeDeError(error);
      avisoError.classList.remove('d-none');
    } finally {
      botonGuardar.disabled = false;
      botonCancelar.disabled = false;
      botonGuardar.innerHTML = '<i class="bi bi-check2 me-1"></i> Guardar';
    }
  }

  #actualizarTarjeta(tarjeta, resena) {
    const rating = tarjeta.querySelector('.review-rating');
    const puntuacion = resena.puntuacion ?? null;

    tarjeta.dataset.comentario = resena.comentario;
    tarjeta.dataset.puntuacion = puntuacion ?? '';
    tarjeta.querySelector('.review-text-content').textContent = resena.comentario;
    rating.textContent = textoPuntuacion(puntuacion);
    rating.classList.toggle('text-warning', Boolean(puntuacion));
    tarjeta.querySelector('.resena-comentario').value = resena.comentario;
    tarjeta.querySelector('.resena-puntuacion').value = puntuacion ? String(puntuacion) : '';
  }

  #crearTarjeta(resena) {
    const tarjeta = this.#elementos.plantilla.content.cloneNode(true);
    const destino = new URL('pelicula.html', window.location.href);

    destino.searchParams.set('id', resena.pelicula.id);

    for (const enlace of tarjeta.querySelectorAll('a')) {
      enlace.href = destino;
    }

    const articulo = tarjeta.querySelector('.review-card');
    const rating = tarjeta.querySelector('.review-rating');
    const botonEditar = tarjeta.querySelector('.btn-editar-resena');
    const comentario = tarjeta.querySelector('.resena-comentario');
    const selector = tarjeta.querySelector('.resena-puntuacion');

    tarjeta.querySelector('.review-movie-title').textContent = resena.pelicula.titulo;
    tarjeta.querySelector('.review-movie-year').textContent = resena.pelicula.anioEstreno;
    tarjeta.querySelector('.review-date').textContent = formatearFecha(resena.fechaPublicacion);
    tarjeta.querySelector('.review-text-content').textContent = resena.comentario;

    articulo.dataset.comentario = resena.comentario;
    articulo.dataset.puntuacion = resena.puntuacion ? String(resena.puntuacion) : '';
    rating.textContent = textoPuntuacion(resena.puntuacion);
    rating.classList.toggle('text-warning', Boolean(resena.puntuacion));

    botonEditar.dataset.resenaId = resena.id;
    botonEditar.setAttribute('aria-label', `Editar reseña de ${resena.pelicula.titulo}`);

    comentario.maxLength = LARGO_MAXIMO_COMENTARIO;
    selector.replaceChildren(new Option('Sin puntuación', ''));

    for (let puntuacion = 1; puntuacion <= PUNTUACION_MAXIMA; puntuacion += 1) {
      selector.append(new Option(`${puntuacion} ★`, String(puntuacion)));
    }

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
