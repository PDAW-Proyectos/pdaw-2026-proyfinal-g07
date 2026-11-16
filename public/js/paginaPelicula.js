import { obtenerPelicula, obtenerResenasDePelicula } from './peliculasApi.js';
import { actualizarResena, crearResena, eliminarResena, listarMisResenas } from './resenasApi.js';
import { formatearFecha, mensajeDeError, mostrarPoster } from './utilidades.js';

const ESTADO_NO_ENCONTRADA = 404;
const TEXTO_MAS_RESENAS = 'Ver más reseñas';
const TEXTO_PUBLICAR = 'Publicar reseña';
const TEXTO_GUARDAR = 'Guardar cambios';
const LARGO_MAXIMO_COMENTARIO = 5000;

/**
 * Ficha de pelicula.html: carga por HTTP la película indicada en ?id=, sus reseñas
 * y permite crear, editar o eliminar la reseña del usuario.
 */
class PaginaPelicula {
  #elementos;
  #peliculaId;
  #paginaResenas = 0;
  #resenasMostradas = 0;
  #resenaPropia = null;
  #modalResena = null;
  #guardando = false;
  #estadoResenaListo = false;

  /**
   * `elementos` reúne los nodos del DOM que usa la página; `peliculaId` es el id interno
   * tomado de la URL (o null si falta).
   */
  constructor({ elementos, peliculaId }) {
    this.#elementos = elementos;
    this.#peliculaId = peliculaId;
  }

  /**
   * Prepara los eventos y carga la película, sus reseñas y la reseña propia en paralelo.
   */
  async iniciar() {
    this.#modalResena =
      window.bootstrap?.Modal?.getOrCreateInstance(this.#elementos.modalResena) ?? null;

    this.#elementos.btnMasResenas.addEventListener('click', () => this.#cargarResenas());
    this.#elementos.btnResena.addEventListener('click', () => this.#abrirModalResena());
    this.#elementos.formResena.addEventListener('submit', (evento) => this.#guardarResena(evento));
    this.#elementos.btnEliminarResena.addEventListener('click', () => this.#eliminarResena());
    this.#elementos.comentario.addEventListener('input', () => {
      this.#elementos.comentario.setCustomValidity('');
      this.#actualizarContador();
    });

    this.#elementos.modalResena.addEventListener('shown.bs.modal', () =>
      this.#elementos.comentario.focus(),
    );
    this.#elementos.modalResena.addEventListener('hidden.bs.modal', () => this.#limpiarErrores());

    // Si la sesión cambia (login o logout), se vuelve a consultar la reseña propia.
    document.addEventListener('fg:sesion-cambiada', () => this.#cargarResenaPropia());

    if (!this.#peliculaId) {
      this.#mostrarFichaNoDisponible('No indicaste qué película querés ver.');
      return;
    }

    const [pelicula] = await Promise.all([
      this.#cargarPelicula(),
      this.#cargarResenas(),
      this.#cargarResenaPropia(),
    ]);

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
        contenedorResenas.replaceChildren(
          ...data.map((resena) => this.#crearTarjetaResena(resena)),
        );
      } else {
        contenedorResenas.append(...data.map((resena) => this.#crearTarjetaResena(resena)));
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

  /**
   * Vuelve a cargar la lista desde la primera página después de crear, editar o eliminar.
   */
  async #reiniciarResenas() {
    this.#paginaResenas = 0;
    this.#resenasMostradas = 0;
    this.#elementos.btnMasResenas.classList.add('d-none');

    await this.#cargarResenas();
  }

  /**
   * Busca la reseña del usuario para esta película. Si no hay sesión, deja el botón
   * en modo "Agregar reseña".
   */
  async #cargarResenaPropia() {
    this.#estadoResenaListo = false;

    try {
      const { data } = await listarMisResenas({ page: 1, limit: 50 });

      this.#resenaPropia = data.find((resena) => resena.pelicula.id === this.#peliculaId) ?? null;
    } catch {
      this.#resenaPropia = null;
    }

    this.#estadoResenaListo = true;
    this.#actualizarBotonResena();
  }

  #actualizarBotonResena() {
    this.#elementos.btnResena.innerHTML = this.#resenaPropia
      ? '<i class="bi bi-pencil-square me-1"></i> Editar reseña'
      : '<i class="bi bi-pencil-square me-1"></i> Agregar Reseña';
  }

  async #abrirModalResena() {
    if (!this.#modalResena) {
      return;
    }

    if (!this.#estadoResenaListo) {
      await this.#cargarResenaPropia();
    }

    const editando = this.#resenaPropia !== null;

    this.#limpiarErrores();
    this.#elementos.tituloModal.textContent = editando ? 'Editar reseña' : 'Escribir reseña';
    this.#elementos.btnGuardarResena.textContent = editando ? TEXTO_GUARDAR : TEXTO_PUBLICAR;
    this.#elementos.btnEliminarResena.classList.toggle('d-none', !editando);
    this.#elementos.comentario.value = editando ? this.#resenaPropia.comentario : '';
    this.#actualizarContador();
    this.#modalResena.show();
  }

  async #guardarResena(evento) {
    evento.preventDefault();

    if (this.#guardando) {
      return;
    }

    const comentario = this.#elementos.comentario.value.trim();

    if (comentario === '') {
      this.#elementos.comentario.setCustomValidity('Escribí tu reseña antes de guardar.');
      this.#elementos.comentario.reportValidity();
      return;
    }

    this.#elementos.comentario.setCustomValidity('');
    this.#limpiarErrores();
    this.#guardando = true;

    const { btnGuardarResena, btnEliminarResena } = this.#elementos;

    btnGuardarResena.disabled = true;
    btnEliminarResena.disabled = true;
    btnGuardarResena.textContent = 'Guardando...';

    try {
      if (this.#resenaPropia) {
        this.#resenaPropia = await actualizarResena(this.#resenaPropia.id, { comentario });
      } else {
        this.#resenaPropia = await crearResena({
          peliculaId: this.#peliculaId,
          comentario,
        });
      }

      this.#modalResena?.hide();
      this.#actualizarBotonResena();
      await this.#reiniciarResenas();
    } catch (error) {
      // Si la API informa que ya existe una reseña, se pasa a modo edición conservando
      // el texto que el usuario escribió.
      if (error.status === 409) {
        await this.#cargarResenaPropia();

        if (this.#resenaPropia) {
          this.#elementos.tituloModal.textContent = 'Editar reseña';
          btnGuardarResena.textContent = TEXTO_GUARDAR;
          btnEliminarResena.classList.remove('d-none');
        }
      }

      this.#mostrarError(error);
    } finally {
      this.#guardando = false;
      btnGuardarResena.disabled = false;
      btnEliminarResena.disabled = false;
      btnGuardarResena.textContent = this.#resenaPropia ? TEXTO_GUARDAR : TEXTO_PUBLICAR;
    }
  }

  async #eliminarResena() {
    if (!this.#resenaPropia) {
      return;
    }

    if (!window.confirm('¿Eliminar tu reseña? Esta acción no se puede deshacer.')) {
      return;
    }

    const { btnGuardarResena, btnEliminarResena } = this.#elementos;

    btnGuardarResena.disabled = true;
    btnEliminarResena.disabled = true;

    try {
      await eliminarResena(this.#resenaPropia.id);
      this.#resenaPropia = null;
      this.#modalResena?.hide();
      this.#actualizarBotonResena();
      await this.#reiniciarResenas();
    } catch (error) {
      this.#mostrarError(error);
    } finally {
      btnGuardarResena.disabled = false;
      btnEliminarResena.disabled = false;
    }
  }

  #actualizarContador() {
    this.#elementos.contadorResena.textContent = `${this.#elementos.comentario.value.length} / ${LARGO_MAXIMO_COMENTARIO}`;
  }

  #limpiarErrores() {
    const { errorGeneral, errorComentario, comentario } = this.#elementos;

    errorGeneral.textContent = '';
    errorGeneral.classList.add('d-none');
    comentario.classList.remove('is-invalid');
    comentario.setCustomValidity('');
    errorComentario.textContent = '';
  }

  #mostrarError(error) {
    const { errorGeneral, errorComentario, comentario } = this.#elementos;
    const errorDeCampo = error.errores?.find(({ campo }) => campo === 'comentario');

    if (errorDeCampo) {
      comentario.classList.add('is-invalid');
      errorComentario.textContent = errorDeCampo.mensaje;
      return;
    }

    errorGeneral.textContent = mensajeDeError(error);
    errorGeneral.classList.remove('d-none');
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
  #crearTarjetaResena(resena) {
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
    btnResena: document.getElementById('btn-add-review'),
    modalResena: document.getElementById('modalResena'),
    formResena: document.getElementById('formResena'),
    comentario: document.getElementById('resenaComentario'),
    contadorResena: document.getElementById('contadorResena'),
    btnGuardarResena: document.getElementById('btnGuardarResena'),
    btnEliminarResena: document.getElementById('btnEliminarResena'),
    tituloModal: document.getElementById('resena-modal-titulo'),
    errorGeneral: document.querySelector('#formResena [data-error-general]'),
    errorComentario: document.querySelector('#formResena [data-error-para="comentario"]'),
  },
  peliculaId: parametros.get('id'),
});

await pagina.iniciar();
