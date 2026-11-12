import { cerrarSesion, obtenerSesion } from './authApi.js';

const PAGINA_ACCESO = 'index.html';
const PAGINA_ADMIN = 'admin.html';
const PAGINAS_SOLO_USUARIO = new Set(['perfil.html', 'watchlist.html', 'reviews.html']);

function volverAlAcceso() {
  // replace() evita que el botón "Atrás" regrese a una página que exige sesión.
  window.location.replace(PAGINA_ACCESO);
}

function nombrePaginaActual() {
  return window.location.pathname.split('/').pop() || PAGINA_ACCESO;
}

function mostrarUsuario(usuario) {
  document.getElementById('auth-btn-text').textContent = usuario.nombreUsuario;

  const nombre = document.getElementById('user-display-name');

  if (nombre) {
    nombre.textContent = usuario.nombre;
  }

  mostrarEnlaceAdmin(usuario);
}

/**
 * Agrega el acceso a administración al menú lateral solo para cuentas admin.
 */
function mostrarEnlaceAdmin(usuario) {
  const lista = document.querySelector('#asideDesplegable .offcanvas-body nav ul');

  if (!lista) {
    return;
  }

  let item = document.getElementById('nav-item-admin');

  if (!item) {
    item = document.createElement('li');
    item.id = 'nav-item-admin';
    item.className = 'nav-item';
    item.innerHTML =
      '<a href="admin.html" class="nav-link text-secondary rounded d-flex align-items-center gap-3"><i class="bi bi-shield-lock"></i> Administración</a>';
    lista.append(item);
  }

  item.classList.toggle('d-none', usuario.rol !== 'admin');
}

/**
 * Consulta la sesión al servidor. Sin sesión (o si no se puede comprobar)
 * vuelve a index.html; con sesión muestra la página.
 */
async function validarSesion() {
  try {
    const { autenticado, usuario } = await obtenerSesion();

    if (!autenticado) {
      volverAlAcceso();
      return;
    }

    if (usuario.rol === 'admin' && PAGINAS_SOLO_USUARIO.has(nombrePaginaActual())) {
      window.location.replace(PAGINA_ADMIN);
      return;
    }

    mostrarUsuario(usuario);
    document.body.classList.remove('invisible');
  } catch {
    volverAlAcceso();
  }
}

async function cerrarSesionUsuario() {
  try {
    await cerrarSesion();
  } catch {
    window.alert('No se pudo cerrar la sesión. Intentá de nuevo.');
    return;
  }

  volverAlAcceso();
}

// Al volver con "Atrás" el navegador puede restaurar la página desde su caché
// sin ejecutar el script otra vez: se oculta y se vuelve a validar.
window.addEventListener('pageshow', (evento) => {
  if (evento.persisted) {
    document.body.classList.add('invisible');
    validarSesion();
  }
});

// Si la sesión se cerró en otra pestaña, se detecta al volver a esta.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    validarSesion();
  }
});

document.getElementById('btn-logout').addEventListener('click', cerrarSesionUsuario);

await validarSesion();
