import { formatearFecha, mensajeDeError, mostrarPoster } from './utilidades.js';
import { listarResenasDeUsuario, obtenerPerfilPublico } from './api/usuariosApi.js';

const LIMITE_RESENAS = 6;
const ESTADO_NO_ENCONTRADO = 404;

function formatearPromedio(valor) {
  return valor.toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * Página pública de otro usuario: métricas derivadas de sus reseñas, películas
 * favoritas, afinidad con el visitante y listado paginado de reseñas.
 */
class PaginaUsuario {
  #elementos;
  #usuarioId;
  #perfil = null;
  #paginaResenas = 0;
  #totalResenas = 0;
  #cargandoResenas = false;

  constructor({ elementos, usuarioId }) {
    this.#elementos = elementos;
    this.#usuarioId = usuarioId;
  }

  async iniciar() {
    this.#elementos.btnMasResenas.addEventListener('click', () => this.#cargarResenas());

    document.addEventListener('fg:sesion-cambiada', () => {
      if (this.#perfil) {
        this.#cargarPerfil();
      }
    });

    if (!this.#usuarioId) {
      this.#elementos.cargando.classList.add('d-none');
      this.#mostrarNoDisponible('No se indicó un usuario para mostrar.');
      return;
    }

    await this.#cargarPerfil();

    if (this.#perfil) {
      await this.#cargarResenas({ reiniciar: true });
    }
  }

  async #cargarPerfil() {
    const { cargando, perfil, noDisponible } = this.#elementos;

    cargando.classList.remove('d-none');
    noDisponible.classList.add('d-none');
    perfil.classList.add('d-none');

    let datos;

    try {
      datos = await obtenerPerfilPublico(this.#usuarioId);
    } catch (error) {
      this.#perfil = null;
      this.#mostrarNoDisponible(
        error.status === ESTADO_NO_ENCONTRADO
          ? 'No encontramos ese perfil.'
          : mensajeDeError(error),
      );
      cargando.classList.add('d-none');
      return;
    }

    this.#perfil = datos;

    try {
      this.#mostrarPerfil(datos);
      perfil.classList.remove('d-none');
      document.title = `Fotograma - @${datos.usuario.nombreUsuario}`;
    } catch {
      this.#perfil = null;
      this.#mostrarNoDisponible(
        'El perfil se cargó, pero no pudimos mostrarlo. Recargá la página e intentá de nuevo.',
      );
    } finally {
      cargando.classList.add('d-none');
    }
  }

  #mostrarPerfil(perfil) {
    const { estadisticas, usuario } = perfil;

    this.#elementos.nombre.textContent = usuario.nombre;
    this.#elementos.alias.textContent = `@${usuario.nombreUsuario}`;
    this.#elementos.statResenas.textContent = String(estadisticas.totalResenas);
    this.#elementos.statPeliculas.textContent = String(estadisticas.peliculasResenadas);
    this.#elementos.statPromedio.textContent =
      estadisticas.promedioPuntuacion === null
        ? '—'
        : formatearPromedio(estadisticas.promedioPuntuacion);
    this.#elementos.detallePromedio.textContent =
      estadisticas.totalPuntuadas === 0
        ? 'Sin puntuaciones'
        : `${estadisticas.totalPuntuadas} puntuada${estadisticas.totalPuntuadas === 1 ? '' : 's'}`;

    this.#mostrarFavoritas(perfil.favoritas);
    this.#mostrarMejorPuntuadas(perfil.mejorPuntuadas);
    this.#mostrarAfinidad(perfil);
  }

  #mostrarFavoritas(favoritas) {
    const { contenedorFavoritasElegidas, plantillaFavorita } = this.#elementos;

    if (favoritas.length === 0) {
      contenedorFavoritasElegidas.replaceChildren(
        this.#crearMensaje('Este usuario todavía no eligió sus películas favoritas.'),
      );
      return;
    }

    contenedorFavoritasElegidas.replaceChildren(
      ...favoritas.map((pelicula) => this.#crearTarjetaPelicula({ pelicula }, plantillaFavorita)),
    );
  }

  #mostrarMejorPuntuadas(mejorPuntuadas) {
    const { contenedorFavoritas, plantillaFavorita } = this.#elementos;

    if (mejorPuntuadas.length === 0) {
      contenedorFavoritas.replaceChildren(
        this.#crearMensaje('Todavía no puntuó ninguna película.'),
      );
      return;
    }

    contenedorFavoritas.replaceChildren(
      ...mejorPuntuadas.map((favorita) =>
        this.#crearTarjetaPelicula(
          { pelicula: favorita, puntuacion: favorita.puntuacion },
          plantillaFavorita,
        ),
      ),
    );
  }

  #mostrarAfinidad(perfil) {
    const {
      afinidadAccionInvitado,
      afinidadDetalle,
      afinidadEnlacePropio,
      afinidadEtiqueta,
      afinidadValor,
    } = this.#elementos;

    afinidadAccionInvitado.classList.add('d-none');
    afinidadEnlacePropio.classList.add('d-none');
    afinidadEtiqueta.textContent = '';

    if (perfil.esPropio) {
      afinidadValor.textContent = 'Tu perfil';
      afinidadDetalle.textContent =
        'Estás viendo tu perfil público. Podés administrar tus datos desde tu perfil privado.';
      afinidadEnlacePropio.classList.remove('d-none');
      return;
    }

    if (perfil.afinidad === null) {
      afinidadValor.textContent = '—';
      afinidadDetalle.textContent = `Iniciá sesión para calcular tu afinidad con @${perfil.usuario.nombreUsuario}.`;
      afinidadAccionInvitado.classList.remove('d-none');
      return;
    }

    const {
      porcentaje,
      peliculasEnComun,
      coincidencias,
      minimoRequerido,
      favoritasEnComun,
      porcentajePuntuaciones,
      porcentajeFavoritas,
    } = perfil.afinidad;

    if (porcentaje === null) {
      afinidadValor.textContent = '—';
      afinidadEtiqueta.textContent = 'Faltan datos';
      afinidadDetalle.textContent = `Se necesitan al menos ${minimoRequerido} películas puntuadas en común o favoritas elegidas por ambos.`;
      return;
    }

    const detalle = [];

    if (porcentajePuntuaciones !== null) {
      detalle.push(
        `${porcentajePuntuaciones}% por notas (${coincidencias} coincidencia${coincidencias === 1 ? '' : 's'} exacta${coincidencias === 1 ? '' : 's'} en ${peliculasEnComun} películas)`,
      );
    }

    if (porcentajeFavoritas !== null) {
      detalle.push(`${porcentajeFavoritas}% por favoritas (${favoritasEnComun} en común)`);
    }

    afinidadValor.textContent = `${porcentaje}%`;
    afinidadEtiqueta.textContent = this.#etiquetaAfinidad(porcentaje);
    afinidadDetalle.textContent = `Afinidad ${detalle.join(' y ')}.`;
  }

  #etiquetaAfinidad(porcentaje) {
    if (porcentaje >= 90) {
      return 'Muy afines';
    }

    if (porcentaje >= 70) {
      return 'Bastante afines';
    }

    if (porcentaje >= 50) {
      return 'Afines';
    }

    if (porcentaje >= 30) {
      return 'Algunas coincidencias';
    }

    return 'Gustos muy distintos';
  }

  async #cargarResenas({ reiniciar = false } = {}) {
    if (this.#cargandoResenas) {
      return;
    }

    const { btnMasResenas, contenedorResenas, plantillaResena } = this.#elementos;

    this.#cargandoResenas = true;
    btnMasResenas.disabled = true;

    if (reiniciar) {
      this.#paginaResenas = 0;
      contenedorResenas.replaceChildren(this.#crearMensaje('Cargando reseñas...'));
    }

    try {
      const resultado = await listarResenasDeUsuario(this.#usuarioId, {
        page: this.#paginaResenas + 1,
        limit: LIMITE_RESENAS,
      });

      this.#paginaResenas = resultado.page;
      this.#totalResenas = resultado.total;

      if (reiniciar) {
        contenedorResenas.replaceChildren();
      }

      if (resultado.total === 0) {
        contenedorResenas.replaceChildren(this.#crearMensaje('Todavía no escribió reseñas.'));
      } else {
        contenedorResenas.append(
          ...resultado.data.map((resena) => this.#crearTarjetaResena(resena, plantillaResena)),
        );
      }

      btnMasResenas.classList.toggle(
        'd-none',
        this.#totalResenas === 0 || this.#paginaResenas * LIMITE_RESENAS >= this.#totalResenas,
      );
    } catch (error) {
      if (reiniciar) {
        contenedorResenas.replaceChildren(this.#crearErrorResenas(error));
        btnMasResenas.classList.add('d-none');
      } else {
        contenedorResenas.append(this.#crearErrorResenas(error));
      }
    } finally {
      this.#cargandoResenas = false;
      btnMasResenas.disabled = false;
      btnMasResenas.textContent = 'Cargar más reseñas';
    }
  }

  #crearTarjetaPelicula({ pelicula, puntuacion }, plantilla) {
    const tarjeta = plantilla.content.cloneNode(true);
    const destino = new URL('pelicula.html', window.location.href);

    destino.searchParams.set('id', pelicula.id);
    tarjeta.querySelector('a').href = destino;
    tarjeta.querySelector('.favorita-title').textContent = pelicula.titulo;
    tarjeta.querySelector('.favorita-meta').textContent =
      puntuacion === undefined
        ? `${pelicula.anioEstreno} · Favorita`
        : `${pelicula.anioEstreno} · ★ ${puntuacion}`;

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

  #crearTarjetaResena(resena, plantilla) {
    const tarjeta = plantilla.content.cloneNode(true);
    const destino = new URL('pelicula.html', window.location.href);

    destino.searchParams.set('id', resena.pelicula.id);

    for (const enlace of tarjeta.querySelectorAll('.resena-pelicula-link')) {
      enlace.href = destino;
    }

    tarjeta.querySelector('.movie-title-rev').textContent = resena.pelicula.titulo;
    tarjeta.querySelector('.movie-year-rev').textContent = resena.pelicula.anioEstreno;
    tarjeta.querySelector('.review-rating').textContent =
      resena.puntuacion === null ? '' : `★ ${resena.puntuacion}`;
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

  #crearErrorResenas(error) {
    const aviso = this.#crearMensaje(mensajeDeError(error));

    aviso.classList.add('alert', 'alert-danger', 'py-2');

    return aviso;
  }

  #crearMensaje(texto) {
    const mensaje = document.createElement('div');

    mensaje.className = 'text-secondary py-3 text-center w-100';
    mensaje.textContent = texto;

    return mensaje;
  }

  #mostrarNoDisponible(texto) {
    this.#elementos.textoNoDisponible.textContent = texto;
    this.#elementos.noDisponible.classList.remove('d-none');
    this.#elementos.perfil.classList.add('d-none');
  }
}

const parametros = new URLSearchParams(window.location.search);

const pagina = new PaginaUsuario({
  usuarioId: parametros.get('id'),
  elementos: {
    cargando: document.getElementById('usuario-cargando'),
    noDisponible: document.getElementById('usuario-no-disponible'),
    textoNoDisponible: document.getElementById('usuario-no-disponible-texto'),
    perfil: document.getElementById('perfil-publico'),
    nombre: document.getElementById('perfil-nombre'),
    alias: document.getElementById('perfil-alias'),
    statResenas: document.getElementById('stat-perfil-resenas'),
    statPeliculas: document.getElementById('stat-perfil-peliculas'),
    statPromedio: document.getElementById('stat-perfil-promedio'),
    detallePromedio: document.getElementById('stat-perfil-puntuadas'),
    contenedorFavoritasElegidas: document.getElementById('favoritas-elegidas-container'),
    contenedorFavoritas: document.getElementById('favoritas-container'),
    plantillaFavorita: document.getElementById('tpl-usuario-favorita'),
    afinidadValor: document.getElementById('afinidad-valor'),
    afinidadEtiqueta: document.getElementById('afinidad-etiqueta'),
    afinidadDetalle: document.getElementById('afinidad-detalle'),
    afinidadAccionInvitado: document.getElementById('afinidad-accion-invitado'),
    afinidadEnlacePropio: document.getElementById('afinidad-enlace-propio'),
    contenedorResenas: document.getElementById('resenas-publicas-container'),
    plantillaResena: document.getElementById('tpl-usuario-resena'),
    btnMasResenas: document.getElementById('btn-mas-resenas-publicas'),
  },
});

await pagina.iniciar();
