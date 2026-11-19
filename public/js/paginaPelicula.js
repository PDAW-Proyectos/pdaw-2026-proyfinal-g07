import { obtenerPelicula, obtenerResenasDePelicula, obtenerTrailer } from './api/peliculasApi.js';
import {
  actualizarResena,
  crearResena,
  eliminarResena,
  listarMisResenas,
} from './api/resenasApi.js';
import { LARGO_MAXIMO_COMENTARIO, PUNTUACION_MAXIMA } from './constantes.js';
import {
  enlazarResenaAPerfil,
  fechaDeHoy,
  formatearFecha,
  mensajeDeError,
  mostrarPoster,
  urlPerfilUsuario,
} from './utilidades.js';
import {
  actualizarVisualizacion,
  crearVisualizacion,
  obtenerMiVisualizacion,
} from './api/visualizacionesApi.js';
import { agregarAWatchlist, consultarWatchlist, quitarDeWatchlist } from './api/watchlistApi.js';

const ESTADO_NO_ENCONTRADA = 404;
const ESTADO_NO_AUTORIZADO = 401;
const ESTADO_CONFLICTO = 409;
const TEXTO_MAS_RESENAS = 'Ver más reseñas';
const TEXTO_PUBLICAR = 'Publicar reseña';
const TEXTO_GUARDAR = 'Guardar cambios';

/**
 * Formatea el promedio con un decimal y coma decimal, como se usa en es-AR.
 */
function formatearPromedio(valor) {
  return valor.toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * Ficha de pelicula.html: carga por HTTP la película indicada en ?id=, sus reseñas
 * y permite crear, editar o eliminar la reseña del usuario.
 */
class PaginaPelicula {
  #elementos;
  #peliculaId;
  #paginaResenas = 0;
  #resenasMostradas = 0;
  #enWatchlist = false;
  #resenaPropia = null;
  #modalResena = null;
  #modalTrailer = null;
  #trailerKey = null;
  #guardando = false;
  #estadoResenaListo = false;
  #registrandoVista = false;
  #visualizacionPropia = null;
  #puntuacionSeleccionada = null;
  #guardandoPuntuacion = false;

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
    this.#modalTrailer =
      window.bootstrap?.Modal?.getOrCreateInstance(this.#elementos.modalTrailer) ?? null;

    this.#elementos.btnTrailer.addEventListener('click', () => this.#abrirTrailer());
    this.#elementos.modalTrailer.addEventListener('hidden.bs.modal', () => {
      this.#elementos.iframeTrailer.src = 'about:blank';
    });
    this.#elementos.btnMasResenas.addEventListener('click', () => this.#cargarResenas());
    this.#elementos.btnWatchlist.addEventListener('click', () => this.#alternarWatchlist());
    this.#elementos.btnVisualizacion.addEventListener('click', () => this.#marcarComoVista());
    this.#elementos.estrellas.addEventListener('click', (evento) =>
      this.#seleccionarPuntuacion(evento),
    );
    this.#elementos.btnGuardarPuntuacion.addEventListener('click', () => this.#guardarPuntuacion());
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
    document.addEventListener('fg:sesion-cambiada', () => {
      this.#cargarResenaPropia();
      this.#cargarEstadoVisualizacion();
    });

    if (!this.#peliculaId) {
      this.#mostrarFichaNoDisponible('No indicaste qué película querés ver.');
      return;
    }

    const [pelicula] = await Promise.all([
      this.#cargarPelicula(),
      this.#cargarResenas(),
      this.#cargarResenaPropia(),
      this.#cargarEstadoWatchlist(),
      this.#cargarEstadoVisualizacion(),
      this.#cargarTrailer(),
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

    this.#mostrarPromedio(pelicula.promedioPuntuacion, pelicula.totalPuntuaciones);
    this.#mostrarPuntuacionTmdb(pelicula.puntuacionTmdb, pelicula.votosTmdb);
    this.#mostrarDirector(pelicula.director);

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
   * Muestra el promedio de las puntuaciones o un aviso si todavía no hay ninguna.
   */
  #mostrarPromedio(promedio, total) {
    const contenedor = this.#elementos.promedio;

    contenedor.replaceChildren();

    if (promedio === null || total === 0) {
      contenedor.textContent = 'Todavía no hay puntuaciones.';
      return;
    }

    const icono = document.createElement('i');
    icono.className = 'bi bi-star-fill text-warning me-1';

    const valor = document.createElement('span');
    valor.className = 'text-white fw-semibold';
    valor.textContent = `${formatearPromedio(promedio)} / ${PUNTUACION_MAXIMA}`;

    const detalle = document.createElement('span');
    detalle.textContent = ` · ${total} ${total === 1 ? 'puntuación' : 'puntuaciones'}`;

    contenedor.append(icono, valor, detalle);
  }

  #mostrarPuntuacionTmdb(promedio, votos) {
    const contenedor = this.#elementos.puntuacionTmdb;

    if (promedio === null || promedio === undefined) {
      contenedor.textContent = 'TMDB: sin puntuación.';
      return;
    }

    const votosTexto =
      Number.isInteger(votos) && votos > 0
        ? ` · ${votos.toLocaleString('es-AR')} ${votos === 1 ? 'voto' : 'votos'}`
        : '';

    contenedor.textContent = `TMDB: ${formatearPromedio(promedio)} / 10${votosTexto}`;
  }

  #mostrarDirector(director) {
    this.#elementos.director.textContent = director
      ? `Director: ${director}`
      : 'Director no disponible.';
  }

  /**
   * Consulta el trailer oficial y muestra el botón solo si existe.
   */
  async #cargarTrailer() {
    try {
      const { trailer } = await obtenerTrailer(this.#peliculaId);

      if (!trailer?.youtubeKey) {
        return;
      }

      this.#trailerKey = trailer.youtubeKey;
      this.#elementos.btnTrailer.title = trailer.titulo || 'Ver trailer';
      this.#elementos.btnTrailer.classList.remove('d-none');
    } catch {
      this.#trailerKey = null;
    }
  }

  /**
   * Carga el iframe recién al abrir el modal para no reproducir nada de antemano.
   */
  #abrirTrailer() {
    if (!this.#trailerKey) {
      return;
    }

    const url = new URL(
      `https://www.youtube-nocookie.com/embed/${encodeURIComponent(this.#trailerKey)}`,
    );

    url.searchParams.set('autoplay', '1');
    url.searchParams.set('rel', '0');
    url.searchParams.set('hl', 'es');

    this.#elementos.iframeTrailer.src = url.toString();
    this.#modalTrailer?.show();
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
   * Consulta si la película ya está guardada. Sin sesión la API responde 401
   * y el botón queda en su estado inicial: auth.js abre el login al hacer clic.
   */
  async #cargarEstadoWatchlist() {
    try {
      const { enWatchlist } = await consultarWatchlist(this.#peliculaId);

      this.#actualizarBotonWatchlist(enWatchlist);
    } catch (error) {
      if (error.status !== ESTADO_NO_AUTORIZADO) {
        this.#mostrarAvisoWatchlist(mensajeDeError(error));
      }
    }
  }

  /**
   * Agrega o quita la película según el estado actual del botón.
   */
  async #alternarWatchlist() {
    const { btnWatchlist } = this.#elementos;

    if (btnWatchlist.disabled) {
      return;
    }

    btnWatchlist.disabled = true;
    this.#ocultarAvisoWatchlist();

    try {
      if (this.#enWatchlist) {
        await quitarDeWatchlist(this.#peliculaId);
        this.#actualizarBotonWatchlist(false);
      } else {
        await agregarAWatchlist(this.#peliculaId);
        this.#actualizarBotonWatchlist(true);
      }
    } catch (error) {
      // Un 409 significa que la película ya estaba guardada: el estado correcto es "activo".
      if (error.status === ESTADO_CONFLICTO) {
        this.#actualizarBotonWatchlist(true);
      } else {
        this.#mostrarAvisoWatchlist(mensajeDeError(error));
      }
    } finally {
      btnWatchlist.disabled = false;
    }
  }

  /**
   * Refleja el estado de la watchlist en el botón y en el texto que pide sesión.
   */
  #actualizarBotonWatchlist(enWatchlist) {
    const { btnWatchlist, iconoWatchlist, textoWatchlist } = this.#elementos;

    this.#enWatchlist = enWatchlist;
    btnWatchlist.setAttribute('aria-pressed', String(enWatchlist));
    btnWatchlist.classList.toggle('btn-success', enWatchlist);
    btnWatchlist.classList.toggle('btn-outline-light', !enWatchlist);
    btnWatchlist.dataset.requiereSesion = enWatchlist
      ? 'quitar la película de tu watchlist'
      : 'guardar la película en tu watchlist';
    btnWatchlist.title = enWatchlist ? 'Quitar de tu watchlist' : 'Guardar en tu watchlist';
    iconoWatchlist.className = enWatchlist
      ? 'bi bi-bookmark-check-fill me-1'
      : 'bi bi-bookmark-plus me-1';
    textoWatchlist.textContent = enWatchlist ? 'En watchlist' : 'Watchlist';
  }

  #mostrarAvisoWatchlist(texto) {
    this.#elementos.avisoWatchlist.textContent = texto;
    this.#elementos.avisoWatchlist.classList.remove('d-none');
  }

  #ocultarAvisoWatchlist() {
    this.#elementos.avisoWatchlist.classList.add('d-none');
  }

  /**
   * Registra que el usuario vio la película con la fecha de hoy.
   * Sin sesión, auth.js intercepta el clic y abre el login.
   */
  async #marcarComoVista() {
    const { btnVisualizacion, textoVisualizacion } = this.#elementos;

    if (this.#registrandoVista || btnVisualizacion.disabled) {
      return;
    }

    if (this.#visualizacionPropia) {
      this.#mostrarAvisoVisualizacion(
        'Ya registraste esta película como vista. Podés cambiar tu puntuación.',
        'text-success',
      );
      return;
    }

    this.#registrandoVista = true;
    btnVisualizacion.disabled = true;
    this.#ocultarAvisoVisualizacion();
    textoVisualizacion.textContent = 'Registrando...';

    try {
      this.#visualizacionPropia = await crearVisualizacion({
        peliculaId: this.#peliculaId,
        fecha: fechaDeHoy(),
        puntuacion: this.#puntuacionSeleccionada,
      });

      if (this.#resenaPropia) {
        this.#resenaPropia.puntuacion = this.#visualizacionPropia.puntuacion;
      }

      this.#actualizarBotonVisualizacion(true);
      this.#aplicarPuntuacion(this.#visualizacionPropia.puntuacion);
      await this.#cargarPelicula();
      this.#mostrarAvisoVisualizacion(
        'Visualización registrada. Ya podés verla en tu perfil.',
        'text-success',
      );
    } catch (error) {
      this.#actualizarBotonVisualizacion(false);
      this.#mostrarAvisoVisualizacion(mensajeDeError(error), 'text-danger');
    } finally {
      this.#registrandoVista = false;
    }
  }

  /**
   * Refleja si la película ya se registró como vista durante esta visita.
   */
  #actualizarBotonVisualizacion(registrada) {
    const { btnVisualizacion, iconoVisualizacion, textoVisualizacion } = this.#elementos;

    btnVisualizacion.classList.toggle('btn-success', registrada);
    btnVisualizacion.classList.toggle('btn-outline-light', !registrada);
    btnVisualizacion.disabled = registrada;
    iconoVisualizacion.className = registrada
      ? 'bi bi-check2-circle-fill me-1'
      : 'bi bi-check2-circle me-1';
    textoVisualizacion.textContent = registrada ? 'Vista' : 'Marcar como vista';

    if (registrada) {
      btnVisualizacion.removeAttribute('data-requiere-sesion');
      btnVisualizacion.title = 'Ya registraste esta película como vista';
    } else {
      btnVisualizacion.dataset.requiereSesion = 'marcar la película como vista';
      btnVisualizacion.title = 'Registrar que viste esta película';
    }
  }

  /**
   * Vuelve el botón a su estado inicial cuando cambia la sesión.
   */
  #reiniciarBotonVisualizacion() {
    this.#registrandoVista = false;
    this.#visualizacionPropia = null;
    this.#ocultarAvisoVisualizacion();
    this.#ocultarAvisoPuntuacion();
    this.#actualizarBotonVisualizacion(false);
    this.#refrescarPuntuacion();
  }

  #mostrarAvisoVisualizacion(texto, clase) {
    const aviso = this.#elementos.avisoVisualizacion;

    aviso.textContent = texto;
    aviso.classList.remove('d-none', 'text-danger', 'text-success');
    aviso.classList.add(clase);
  }

  #ocultarAvisoVisualizacion() {
    const aviso = this.#elementos.avisoVisualizacion;

    aviso.textContent = '';
    aviso.classList.add('d-none');
    aviso.classList.remove('text-danger', 'text-success');
  }

  async #cargarEstadoVisualizacion() {
    if (!this.#peliculaId) {
      return;
    }

    try {
      const visualizacion = await obtenerMiVisualizacion(this.#peliculaId);

      if (this.#guardandoPuntuacion || this.#registrandoVista) {
        return;
      }

      this.#visualizacionPropia = visualizacion;
      this.#actualizarBotonVisualizacion(true);
      this.#refrescarPuntuacion();
    } catch (error) {
      if (error.status === ESTADO_NO_AUTORIZADO) {
        this.#reiniciarBotonVisualizacion();
        return;
      }

      if (error.status === ESTADO_NO_ENCONTRADA) {
        if (!this.#visualizacionPropia && !this.#registrandoVista && !this.#guardandoPuntuacion) {
          this.#reiniciarBotonVisualizacion();
        }

        return;
      }

      this.#mostrarAvisoVisualizacion(mensajeDeError(error), 'text-danger');
    }
  }

  #seleccionarPuntuacion(evento) {
    const boton = evento.target.closest('[data-puntuacion]');

    if (!boton) {
      return;
    }

    const valor = Number(boton.dataset.puntuacion);

    if (!Number.isInteger(valor) || valor < 1 || valor > PUNTUACION_MAXIMA) {
      return;
    }

    this.#aplicarPuntuacion(valor);
    this.#ocultarAvisoPuntuacion();
  }

  async #guardarPuntuacion() {
    if (this.#guardandoPuntuacion) {
      return;
    }

    if (this.#puntuacionSeleccionada === null) {
      this.#mostrarAvisoPuntuacion('Elegí una puntuación antes de guardar.', 'text-danger');
      return;
    }

    const { btnGuardarPuntuacion } = this.#elementos;

    this.#guardandoPuntuacion = true;
    btnGuardarPuntuacion.disabled = true;
    btnGuardarPuntuacion.textContent = 'Guardando...';

    try {
      const puntuacion = this.#puntuacionSeleccionada;

      this.#visualizacionPropia = this.#visualizacionPropia
        ? await actualizarVisualizacion(this.#visualizacionPropia.id, { puntuacion })
        : await crearVisualizacion({
            peliculaId: this.#peliculaId,
            fecha: fechaDeHoy(),
            puntuacion,
          });

      if (this.#resenaPropia) {
        this.#resenaPropia.puntuacion = this.#visualizacionPropia.puntuacion;
      }

      this.#actualizarBotonVisualizacion(true);
      this.#aplicarPuntuacion(this.#visualizacionPropia.puntuacion);
      await this.#cargarPelicula();
      this.#mostrarAvisoPuntuacion('Puntuación guardada. Ya se ve en tu perfil.', 'text-success');
    } catch (error) {
      this.#mostrarAvisoPuntuacion(mensajeDeError(error), 'text-danger');
    } finally {
      this.#guardandoPuntuacion = false;
      btnGuardarPuntuacion.disabled = false;
      btnGuardarPuntuacion.textContent = 'Guardar puntuación';
    }
  }

  #puntuacionVigente() {
    if (this.#resenaPropia && this.#resenaPropia.puntuacion !== null) {
      return this.#resenaPropia.puntuacion;
    }

    if (this.#visualizacionPropia && this.#visualizacionPropia.puntuacion !== null) {
      return this.#visualizacionPropia.puntuacion;
    }

    return null;
  }

  #refrescarPuntuacion() {
    if (this.#guardandoPuntuacion || this.#registrandoVista) {
      return;
    }

    this.#aplicarPuntuacion(this.#puntuacionVigente());
  }

  #aplicarPuntuacion(valor) {
    this.#puntuacionSeleccionada = valor;

    for (const boton of this.#elementos.estrellas.querySelectorAll('[data-puntuacion]')) {
      const numero = Number(boton.dataset.puntuacion);
      const activa = valor !== null && numero <= valor;
      const icono = boton.querySelector('i');

      boton.classList.toggle('is-active', activa);
      boton.setAttribute('aria-pressed', String(numero === valor));

      if (icono) {
        icono.className = activa ? 'bi bi-star-fill' : 'bi bi-star';
      }
    }
  }

  #mostrarAvisoPuntuacion(texto, clase) {
    const aviso = this.#elementos.avisoPuntuacion;

    aviso.textContent = texto;
    aviso.classList.remove('d-none', 'text-danger', 'text-success');
    aviso.classList.add(clase);
  }

  #ocultarAvisoPuntuacion() {
    const aviso = this.#elementos.avisoPuntuacion;

    aviso.textContent = '';
    aviso.classList.add('d-none');
    aviso.classList.remove('text-danger', 'text-success');
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
    this.#refrescarPuntuacion();
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
    const puntuacionInicial = this.#resenaPropia?.puntuacion ?? this.#puntuacionSeleccionada;

    this.#limpiarErrores();
    this.#elementos.tituloModal.textContent = editando ? 'Editar reseña' : 'Escribir reseña';
    this.#elementos.btnGuardarResena.textContent = editando ? TEXTO_GUARDAR : TEXTO_PUBLICAR;
    this.#elementos.btnEliminarResena.classList.toggle('d-none', !editando);
    this.#elementos.comentario.value = editando ? this.#resenaPropia.comentario : '';
    this.#elementos.puntuacion.value = puntuacionInicial ? String(puntuacionInicial) : '';
    this.#actualizarContador();
    this.#modalResena.show();
  }

  async #guardarResena(evento) {
    evento.preventDefault();

    if (this.#guardando) {
      return;
    }

    const comentario = this.#elementos.comentario.value.trim();
    const puntuacion = this.#leerPuntuacion();

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
        this.#resenaPropia = await actualizarResena(this.#resenaPropia.id, {
          comentario,
          puntuacion,
        });
      } else {
        this.#resenaPropia = await crearResena({
          peliculaId: this.#peliculaId,
          comentario,
          puntuacion,
        });
      }

      if (this.#visualizacionPropia) {
        this.#visualizacionPropia.puntuacion = this.#resenaPropia.puntuacion;
      }

      this.#aplicarPuntuacion(this.#puntuacionVigente());
      this.#modalResena?.hide();
      this.#actualizarBotonResena();
      await Promise.all([this.#reiniciarResenas(), this.#cargarPelicula()]);
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
      this.#refrescarPuntuacion();
      this.#modalResena?.hide();
      this.#actualizarBotonResena();
      await Promise.all([this.#reiniciarResenas(), this.#cargarPelicula()]);
    } catch (error) {
      this.#mostrarError(error);
    } finally {
      btnGuardarResena.disabled = false;
      btnEliminarResena.disabled = false;
    }
  }

  #leerPuntuacion() {
    const valor = this.#elementos.puntuacion.value;

    return valor === '' ? null : Number(valor);
  }

  #actualizarContador() {
    this.#elementos.contadorResena.textContent = `${this.#elementos.comentario.value.length} / ${LARGO_MAXIMO_COMENTARIO}`;
  }

  #limpiarErrores() {
    const { errorGeneral, errorComentario, comentario, errorPuntuacion, puntuacion } =
      this.#elementos;

    errorGeneral.textContent = '';
    errorGeneral.classList.add('d-none');
    comentario.classList.remove('is-invalid');
    comentario.setCustomValidity('');
    errorComentario.textContent = '';
    puntuacion.classList.remove('is-invalid');
    errorPuntuacion.textContent = '';
  }

  #mostrarError(error) {
    const { errorGeneral, errorComentario, comentario, errorPuntuacion, puntuacion } =
      this.#elementos;
    const errorDeComentario = error.errores?.find(({ campo }) => campo === 'comentario');
    const errorDePuntuacion = error.errores?.find(({ campo }) => campo === 'puntuacion');

    if (errorDeComentario) {
      comentario.classList.add('is-invalid');
      errorComentario.textContent = errorDeComentario.mensaje;
      return;
    }

    if (errorDePuntuacion) {
      puntuacion.classList.add('is-invalid');
      errorPuntuacion.textContent = errorDePuntuacion.mensaje;
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

    const enlaceAutor = tarjeta.querySelector('.review-author-link');

    enlaceAutor.href = urlPerfilUsuario(resena.autor.id);
    enlaceAutor.title = `Ver perfil de ${resena.autor.nombre}`;
    tarjeta.querySelector('.author-name').textContent = resena.autor.nombre;
    tarjeta.querySelector('.author-username').textContent = `@${resena.autor.nombreUsuario}`;
    tarjeta.querySelector('.review-date').textContent = formatearFecha(resena.fechaPublicacion);
    tarjeta.querySelector('.review-content').textContent = resena.comentario;

    enlazarResenaAPerfil(tarjeta.querySelector('.review-card'), resena.autor);

    const puntuacion = tarjeta.querySelector('.review-rating');

    if (resena.puntuacion !== null && resena.puntuacion !== undefined) {
      puntuacion.textContent = `★ ${resena.puntuacion}`;
      puntuacion.classList.remove('d-none');
    }

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
    promedio: document.getElementById('movie-rating'),
    puntuacionTmdb: document.getElementById('movie-tmdb-rating'),
    director: document.getElementById('movie-director'),
    sinopsis: document.getElementById('movie-description'),
    generos: document.getElementById('movie-genres'),
    plantillaGenero: document.getElementById('tpl-genre-badge'),
    poster: document.getElementById('movie-poster'),
    marcadorPoster: document.getElementById('poster-placeholder'),
    resenas: document.getElementById('movie-reviews-section'),
    contenedorResenas: document.getElementById('movie-reviews-container'),
    plantillaResena: document.getElementById('tpl-movie-review-card'),
    btnMasResenas: document.getElementById('btn-mas-resenas'),
    btnTrailer: document.getElementById('btn-trailer'),
    modalTrailer: document.getElementById('modalTrailer'),
    iframeTrailer: document.getElementById('trailer-iframe'),
    btnWatchlist: document.getElementById('btn-add-watchlist'),
    iconoWatchlist: document.getElementById('watchlist-btn-icon'),
    textoWatchlist: document.getElementById('watchlist-btn-text'),
    avisoWatchlist: document.getElementById('watchlist-aviso'),
    btnVisualizacion: document.getElementById('btn-add-visualizacion'),
    iconoVisualizacion: document.getElementById('visualizacion-btn-icon'),
    textoVisualizacion: document.getElementById('visualizacion-btn-text'),
    avisoVisualizacion: document.getElementById('visualizacion-aviso'),
    estrellas: document.getElementById('rating-estrellas'),
    btnGuardarPuntuacion: document.getElementById('btn-guardar-puntuacion'),
    avisoPuntuacion: document.getElementById('puntuacion-aviso'),
    btnResena: document.getElementById('btn-add-review'),
    modalResena: document.getElementById('modalResena'),
    formResena: document.getElementById('formResena'),
    puntuacion: document.getElementById('resenaPuntuacion'),
    comentario: document.getElementById('resenaComentario'),
    contadorResena: document.getElementById('contadorResena'),
    btnGuardarResena: document.getElementById('btnGuardarResena'),
    btnEliminarResena: document.getElementById('btnEliminarResena'),
    tituloModal: document.getElementById('resena-modal-titulo'),
    errorGeneral: document.querySelector('#formResena [data-error-general]'),
    errorComentario: document.querySelector('#formResena [data-error-para="comentario"]'),
    errorPuntuacion: document.querySelector('#formResena [data-error-para="puntuacion"]'),
  },
  peliculaId: parametros.get('id'),
});

await pagina.iniciar();
