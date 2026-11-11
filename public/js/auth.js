import {
  cerrarSesion,
  ErrorApi,
  iniciarSesion,
  obtenerSesion,
  registrarUsuario,
} from './authApi.js';

// Bootstrap se carga como script clásico antes de este módulo.
const { Modal, Offcanvas } = window.bootstrap;

const elementos = {
  btnMenu: document.getElementById('btn-menu-offcanvas'),
  btnAuth: document.getElementById('btn-auth-action'),
  textoAuth: document.getElementById('auth-btn-text'),
  btnLogout: document.getElementById('btn-logout'),
  aside: document.getElementById('asideDesplegable'),
  recomendadas: document.getElementById('recomendadas-section'),
  modalLogin: document.getElementById('modalLogin'),
  modalRegistro: document.getElementById('modalRegistro'),
};

let usuarioActual = null;

/**
 * Muestra u oculta lo que depende de tener una sesión activa.
 * Recibe el usuario autenticado o null cuando no hay sesión.
 */
function aplicarSesion(usuario) {
  usuarioActual = usuario;
  const autenticado = usuario !== null;

  elementos.btnMenu.classList.toggle('d-none', !autenticado);
  elementos.btnMenu.classList.toggle('d-flex', autenticado);
  // "Recomendadas" solo existe en index.html.
  elementos.recomendadas?.classList.toggle('d-none', !autenticado);
  elementos.textoAuth.textContent = autenticado ? usuario.nombreUsuario : 'Iniciar sesión';
  elementos.btnAuth.title = autenticado ? 'Ir a mi perfil' : 'Iniciar sesión';
}

function limpiarErrores(formulario) {
  formulario.querySelector('[data-error-general]').classList.add('d-none');

  for (const control of formulario.elements) {
    control.classList.remove('is-invalid');
  }
}

function mensajeGeneral(error) {
  return error instanceof ErrorApi
    ? error.message
    : 'No pudimos conectar con el servidor. Intentá de nuevo.';
}

/**
 * Marca los campos que la API rechazó; si el error no es de un campo,
 * muestra el mensaje en el aviso general del formulario.
 */
function mostrarErrores(formulario, error) {
  const erroresDeCampo =
    error instanceof ErrorApi
      ? error.errores.filter(({ campo }) => formulario.elements.namedItem(campo))
      : [];

  for (const { campo, mensaje } of erroresDeCampo) {
    formulario.elements.namedItem(campo).classList.add('is-invalid');
    formulario.querySelector(`[data-error-para="${campo}"]`).textContent = mensaje;
  }

  if (erroresDeCampo.length === 0) {
    const aviso = formulario.querySelector('[data-error-general]');

    aviso.textContent = mensajeGeneral(error);
    aviso.classList.remove('d-none');
  }
}

/**
 * Conecta un formulario con su acción de la API.
 * Si sale bien actualiza la sesión y cierra el modal.
 */
function manejarEnvio({ modal, accion }) {
  const formulario = modal.querySelector('form');

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limpiarErrores(formulario);

    const botonEnvio = formulario.querySelector('button[type="submit"]');

    botonEnvio.disabled = true;

    try {
      const { usuario } = await accion(Object.fromEntries(new FormData(formulario)));

      aplicarSesion(usuario);
      Modal.getOrCreateInstance(modal).hide();
    } catch (error) {
      mostrarErrores(formulario, error);
    } finally {
      botonEnvio.disabled = false;
    }
  });
}

/**
 * Enfoca el primer campo al abrir el modal y deja el formulario limpio al cerrarlo.
 */
function prepararModal(modal) {
  const formulario = modal.querySelector('form');

  modal.addEventListener('shown.bs.modal', () => {
    formulario.querySelector('input').focus();
  });

  modal.addEventListener('hidden.bs.modal', () => {
    formulario.reset();
    limpiarErrores(formulario);
  });
}

/**
 * Muestra el aviso que explica por qué se pide iniciar sesión,
 * o lo oculta cuando no se indica un motivo.
 */
function mostrarAvisoSesion(motivo) {
  for (const aviso of document.querySelectorAll('[data-aviso-sesion]')) {
    aviso.textContent = motivo ? `Necesitás iniciar sesión para ${motivo}.` : '';
    aviso.classList.toggle('d-none', !motivo);
  }
}

function abrirLogin(motivo = null) {
  mostrarAvisoSesion(motivo);
  Modal.getOrCreateInstance(elementos.modalLogin).show();
}

function abrirLoginOPerfil() {
  if (usuarioActual) {
    window.location.href = 'perfil.html';
    return;
  }

  abrirLogin();
}

/**
 * Las acciones marcadas con data-requiere-sesion="motivo" (por ejemplo, publicar
 * una reseña) no se ejecutan sin sesión: se abre el login con un aviso que explica
 * el motivo. Se escucha en la fase de captura para que ningún otro manejador de
 * esa acción llegue a ejecutarse.
 */
function exigirSesion(evento) {
  const accion = evento.target.closest('[data-requiere-sesion]');

  if (!accion || usuarioActual) {
    return;
  }

  evento.preventDefault();
  evento.stopPropagation();
  abrirLogin(accion.dataset.requiereSesion);
}

/**
 * Consulta la sesión al servidor y actualiza la pantalla.
 */
async function actualizarSesion() {
  try {
    const { autenticado, usuario } = await obtenerSesion();

    aplicarSesion(autenticado ? usuario : null);
  } catch {
    aplicarSesion(null);
  }
}

async function cerrarSesionUsuario(evento) {
  evento.preventDefault();

  try {
    await cerrarSesion();
  } catch {
    window.alert('No se pudo cerrar la sesión. Intentá de nuevo.');
    return;
  }

  aplicarSesion(null);
  Offcanvas.getInstance(elementos.aside)?.hide();
}

async function iniciar() {
  elementos.btnAuth.addEventListener('click', abrirLoginOPerfil);
  elementos.btnLogout.addEventListener('click', cerrarSesionUsuario);

  prepararModal(elementos.modalLogin);
  prepararModal(elementos.modalRegistro);
  manejarEnvio({ modal: elementos.modalLogin, accion: iniciarSesion });
  manejarEnvio({ modal: elementos.modalRegistro, accion: registrarUsuario });

  document.addEventListener('click', exigirSesion, true);

  // Al volver con "Atrás" o desde otra pestaña, la sesión pudo haber cambiado.
  window.addEventListener('pageshow', (evento) => {
    if (evento.persisted) {
      actualizarSesion();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      actualizarSesion();
    }
  });

  await actualizarSesion();
}

await iniciar();
