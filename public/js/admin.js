import { ErrorApi, solicitar } from './apiCliente.js';
import { formatearFecha, mensajeDeError } from './utilidades.js';

const LIMITE = 20;
const formateadorNumero = new Intl.NumberFormat('es-AR');

const elementos = {
  cargando: document.getElementById('admin-cargando'),
  noAutorizado: document.getElementById('admin-no-autorizado'),
  mensajeNoAutorizado: document.getElementById('admin-no-autorizado-mensaje'),
  contenido: document.getElementById('admin-contenido'),
  alerta: document.getElementById('admin-alerta'),
  cuerpo: document.getElementById('admin-usuarios'),
  estado: document.getElementById('admin-estado'),
  btnAnterior: document.getElementById('btn-anterior'),
  btnSiguiente: document.getElementById('btn-siguiente'),
  resenasCuerpo: document.getElementById('admin-resenas'),
  estadoResenas: document.getElementById('admin-estado-resenas'),
  btnResenasAnterior: document.getElementById('btn-resenas-anterior'),
  btnResenasSiguiente: document.getElementById('btn-resenas-siguiente'),
  btnRefrescar: document.getElementById('btn-refrescar'),
  btnLogout: document.getElementById('btn-logout'),
};

class PanelAdmin {
  #pagina = 1;
  #total = 0;
  #visibles = 0;
  #paginaResenas = 1;
  #totalResenas = 0;
  #visiblesResenas = 0;
  #usuario = null;
  #cargando = false;
  #cargandoResenas = false;

  async iniciar() {
    this.#conectarEventos();

    try {
      const { autenticado, usuario } = await solicitar('/auth/sesion');

      if (!autenticado || usuario?.rol !== 'admin') {
        this.#mostrarNoAutorizado();
        return;
      }

      this.#usuario = usuario;
      elementos.cargando.classList.add('d-none');
      elementos.contenido.classList.remove('d-none');
      await Promise.all([this.#cargar(1), this.#cargarResenas(1)]);
    } catch (error) {
      this.#mostrarNoAutorizado(mensajeDeError(error));
    }
  }

  #conectarEventos() {
    elementos.btnAnterior.addEventListener('click', () => this.#cargar(this.#pagina - 1));
    elementos.btnSiguiente.addEventListener('click', () => this.#cargar(this.#pagina + 1));
    elementos.btnResenasAnterior.addEventListener('click', () =>
      this.#cargarResenas(this.#paginaResenas - 1),
    );
    elementos.btnResenasSiguiente.addEventListener('click', () =>
      this.#cargarResenas(this.#paginaResenas + 1),
    );
    elementos.btnRefrescar.addEventListener('click', () =>
      Promise.all([this.#cargar(this.#pagina), this.#cargarResenas(this.#paginaResenas)]),
    );
    elementos.btnLogout.addEventListener('click', () => this.#cerrarSesion());
  }

  async #cargar(pagina, { conservarAlerta = false } = {}) {
    if (this.#cargando || pagina < 1) {
      return false;
    }

    this.#cargando = true;
    this.#actualizarBotones();

    if (!conservarAlerta) {
      this.#mostrarAlerta('');
    }

    this.#actualizarEstado('Cargando cuentas...');

    try {
      const respuesta = await solicitar('/admin/usuarios', {
        parametros: { page: pagina, limit: LIMITE },
      });

      this.#pagina = respuesta.page;
      this.#total = respuesta.total;
      this.#visibles = respuesta.data.length;
      this.#renderizar(respuesta.data);

      return true;
    } catch (error) {
      if (this.#esErrorDeSesion(error)) {
        this.#mostrarNoAutorizado(mensajeDeError(error));
      } else {
        this.#mostrarAlerta(mensajeDeError(error), 'danger');
      }

      return false;
    } finally {
      this.#cargando = false;
      this.#actualizarBotones();
      this.#actualizarEstado();
    }
  }

  async #cargarResenas(pagina, { conservarAlerta = false } = {}) {
    if (this.#cargandoResenas || pagina < 1) {
      return false;
    }

    this.#cargandoResenas = true;
    this.#actualizarBotonesResenas();

    if (!conservarAlerta) {
      this.#mostrarAlerta('');
    }

    this.#actualizarEstadoResenas('Cargando reseñas...');

    try {
      const respuesta = await solicitar('/resenas/recientes', {
        parametros: { page: pagina, limit: LIMITE },
      });

      this.#paginaResenas = respuesta.page;
      this.#totalResenas = respuesta.total;
      this.#visiblesResenas = respuesta.data.length;
      this.#renderizarResenas(respuesta.data);

      return true;
    } catch (error) {
      if (this.#esErrorDeSesion(error)) {
        this.#mostrarNoAutorizado(mensajeDeError(error));
      } else {
        this.#mostrarAlerta(mensajeDeError(error), 'danger');
      }

      return false;
    } finally {
      this.#cargandoResenas = false;
      this.#actualizarBotonesResenas();
      this.#actualizarEstadoResenas();
    }
  }

  #renderizar(usuarios) {
    elementos.cuerpo.replaceChildren();

    if (usuarios.length === 0) {
      const fila = document.createElement('tr');
      const celda = document.createElement('td');

      celda.colSpan = 4;
      celda.className = 'text-center text-secondary py-5';
      celda.textContent = 'No hay cuentas registradas en esta página.';
      fila.append(celda);
      elementos.cuerpo.append(fila);
      return;
    }

    for (const usuario of usuarios) {
      elementos.cuerpo.append(this.#crearFila(usuario));
    }
  }

  #renderizarResenas(resenas) {
    elementos.resenasCuerpo.replaceChildren();

    if (resenas.length === 0) {
      const fila = document.createElement('tr');
      const celda = document.createElement('td');

      celda.colSpan = 5;
      celda.className = 'text-center text-secondary py-5';
      celda.textContent = 'No hay reseñas publicadas en esta página.';
      fila.append(celda);
      elementos.resenasCuerpo.append(fila);
      return;
    }

    for (const resena of resenas) {
      elementos.resenasCuerpo.append(this.#crearFilaResena(resena));
    }
  }

  #crearFilaResena(resena) {
    const fila = document.createElement('tr');

    const celdaPelicula = document.createElement('td');
    const titulo = document.createElement('div');
    const anio = document.createElement('div');

    titulo.className = 'fw-semibold text-white';
    titulo.textContent = resena.pelicula.titulo;
    anio.className = 'text-secondary micro-text';
    anio.textContent = resena.pelicula.anioEstreno ?? '';
    celdaPelicula.append(titulo, anio);

    const celdaAutor = document.createElement('td');
    const nombreAutor = document.createElement('div');
    const aliasAutor = document.createElement('div');

    nombreAutor.className = 'text-white';
    nombreAutor.textContent = resena.autor.nombre;
    aliasAutor.className = 'text-secondary micro-text';
    aliasAutor.textContent = `@${resena.autor.nombreUsuario}`;
    celdaAutor.append(nombreAutor, aliasAutor);

    const celdaComentario = document.createElement('td');
    const resumen =
      resena.comentario.length > 180 ? `${resena.comentario.slice(0, 180)}…` : resena.comentario;

    celdaComentario.className = 'text-secondary';
    celdaComentario.style.maxWidth = '28rem';
    celdaComentario.textContent = resumen;
    celdaComentario.title = resena.comentario;

    const celdaFecha = document.createElement('td');
    celdaFecha.className = 'text-secondary text-nowrap';
    celdaFecha.textContent = formatearFecha(resena.fechaPublicacion);

    const celdaAcciones = document.createElement('td');
    const boton = document.createElement('button');

    boton.type = 'button';
    boton.className = 'btn btn-sm btn-outline-danger rounded-pill px-3';
    boton.textContent = 'Eliminar';
    boton.title = `Eliminar la reseña de @${resena.autor.nombreUsuario}`;
    boton.addEventListener('click', () => this.#eliminarResena(resena, boton));
    celdaAcciones.className = 'text-end';
    celdaAcciones.append(boton);

    fila.append(celdaPelicula, celdaAutor, celdaComentario, celdaFecha, celdaAcciones);

    return fila;
  }

  #crearFila(usuario) {
    const fila = document.createElement('tr');

    const celdaUsuario = document.createElement('td');
    const identidad = document.createElement('div');
    const nombre = document.createElement('div');
    const alias = document.createElement('div');

    nombre.className = 'fw-semibold text-white';
    nombre.textContent = usuario.nombre;
    alias.className = 'text-secondary micro-text';
    alias.textContent = `@${usuario.nombreUsuario}`;
    identidad.className = 'd-flex flex-column';
    identidad.append(nombre, alias);
    celdaUsuario.append(identidad);

    const celdaEmail = document.createElement('td');
    celdaEmail.className = 'text-secondary';
    celdaEmail.textContent = usuario.email;

    const celdaRol = document.createElement('td');
    const rol = document.createElement('span');
    const esAdmin = usuario.rol === 'admin';

    rol.className = `badge rounded-pill ${esAdmin ? 'text-bg-success' : 'text-bg-secondary'}`;
    rol.textContent = esAdmin ? 'Administrador' : 'Usuario';
    celdaRol.append(rol);

    const celdaAcciones = document.createElement('td');
    const boton = document.createElement('button');
    const esCuentaPropia = usuario.id === this.#usuario.id;

    boton.type = 'button';
    boton.className = 'btn btn-sm btn-outline-danger rounded-pill px-3';
    boton.textContent = 'Eliminar';
    boton.disabled = esCuentaPropia;
    boton.title = esCuentaPropia
      ? 'No podés eliminar tu propia cuenta'
      : `Eliminar la cuenta de @${usuario.nombreUsuario}`;
    boton.addEventListener('click', () => this.#eliminar(usuario, boton));
    celdaAcciones.className = 'text-end';
    celdaAcciones.append(boton);

    fila.append(celdaUsuario, celdaEmail, celdaRol, celdaAcciones);

    return fila;
  }

  async #eliminar(usuario, boton) {
    const referencia = `@${usuario.nombreUsuario}`;

    if (
      !window.confirm(
        `¿Eliminar la cuenta de ${referencia}? También se borrarán sus reseñas y visualizaciones.`,
      )
    ) {
      return;
    }

    const contenidoOriginal = boton.innerHTML;
    const totalRestante = Math.max(0, this.#total - 1);
    const ultimaPagina = Math.max(1, Math.ceil(totalRestante / LIMITE));
    const paginaDestino = Math.min(this.#pagina, ultimaPagina);

    boton.disabled = true;
    boton.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>';

    try {
      await solicitar(`/admin/usuarios/${encodeURIComponent(usuario.id)}`, { metodo: 'DELETE' });

      const usuariosCargados = await this.#cargar(paginaDestino, { conservarAlerta: true });
      const resenasCargadas = await this.#cargarResenas(1, { conservarAlerta: true });

      if (usuariosCargados && resenasCargadas) {
        this.#mostrarAlerta(`La cuenta ${referencia} fue eliminada.`, 'success');
      }
    } catch (error) {
      if (this.#esErrorDeSesion(error)) {
        this.#mostrarNoAutorizado(mensajeDeError(error));
        return;
      }

      this.#mostrarAlerta(mensajeDeError(error), 'danger');
      boton.disabled = false;
      boton.innerHTML = contenidoOriginal;
    }
  }

  async #eliminarResena(resena, boton) {
    const referencia = `@${resena.autor.nombreUsuario}`;

    if (
      !window.confirm(`¿Eliminar la reseña de ${referencia} sobre "${resena.pelicula.titulo}"?`)
    ) {
      return;
    }

    const contenidoOriginal = boton.innerHTML;
    const totalRestante = Math.max(0, this.#totalResenas - 1);
    const ultimaPagina = Math.max(1, Math.ceil(totalRestante / LIMITE));
    const paginaDestino = Math.min(this.#paginaResenas, ultimaPagina);

    boton.disabled = true;
    boton.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>';

    try {
      await solicitar(`/admin/resenas/${encodeURIComponent(resena.id)}`, { metodo: 'DELETE' });

      const cargado = await this.#cargarResenas(paginaDestino, { conservarAlerta: true });

      if (cargado) {
        this.#mostrarAlerta(`La reseña de ${referencia} fue eliminada.`, 'success');
      }
    } catch (error) {
      if (this.#esErrorDeSesion(error)) {
        this.#mostrarNoAutorizado(mensajeDeError(error));
        return;
      }

      this.#mostrarAlerta(mensajeDeError(error), 'danger');
      boton.disabled = false;
      boton.innerHTML = contenidoOriginal;
    }
  }

  async #cerrarSesion() {
    try {
      await solicitar('/auth/logout', { metodo: 'POST' });
    } catch {
      window.alert('No se pudo cerrar la sesión. Intentá de nuevo.');
      return;
    }

    window.location.href = 'index.html';
  }

  #mostrarNoAutorizado(mensaje = null) {
    elementos.cargando.classList.add('d-none');
    elementos.contenido.classList.add('d-none');
    elementos.noAutorizado.classList.remove('d-none');

    if (mensaje) {
      elementos.mensajeNoAutorizado.textContent = mensaje;
    }
  }

  #mostrarAlerta(mensaje, tipo = 'success') {
    if (!mensaje) {
      elementos.alerta.className = 'alert d-none';
      elementos.alerta.textContent = '';
      return;
    }

    elementos.alerta.className = `alert alert-${tipo}`;
    elementos.alerta.textContent = mensaje;
  }

  #actualizarBotones() {
    elementos.btnAnterior.disabled = this.#cargando || this.#pagina <= 1;
    elementos.btnSiguiente.disabled = this.#cargando || this.#pagina * LIMITE >= this.#total;
    elementos.btnRefrescar.disabled = this.#cargando || this.#cargandoResenas;
  }

  #actualizarBotonesResenas() {
    elementos.btnResenasAnterior.disabled = this.#cargandoResenas || this.#paginaResenas <= 1;
    elementos.btnResenasSiguiente.disabled =
      this.#cargandoResenas || this.#paginaResenas * LIMITE >= this.#totalResenas;
    elementos.btnRefrescar.disabled = this.#cargando || this.#cargandoResenas;
  }

  #actualizarEstado(mensaje = null) {
    if (mensaje) {
      elementos.estado.textContent = mensaje;
      return;
    }

    const total = formateadorNumero.format(this.#total);
    const visibles = formateadorNumero.format(this.#visibles);

    elementos.estado.textContent =
      this.#total === 0
        ? 'No hay cuentas registradas.'
        : `Mostrando ${visibles} de ${total} cuentas · Página ${this.#pagina}`;
  }

  #actualizarEstadoResenas(mensaje = null) {
    if (mensaje) {
      elementos.estadoResenas.textContent = mensaje;
      return;
    }

    const total = formateadorNumero.format(this.#totalResenas);
    const visibles = formateadorNumero.format(this.#visiblesResenas);

    elementos.estadoResenas.textContent =
      this.#totalResenas === 0
        ? 'No hay reseñas publicadas.'
        : `Mostrando ${visibles} de ${total} reseñas · Página ${this.#paginaResenas}`;
  }

  #esErrorDeSesion(error) {
    return error instanceof ErrorApi && (error.status === 401 || error.status === 403);
  }
}

await new PanelAdmin().iniciar();
