import { cerrarSesion, obtenerSesion } from './authApi.js';

const PAGINA_ACCESO = 'index.html';

function volverAlAcceso() {
  // replace() evita que el botón "Atrás" regrese a una página que exige sesión.
  window.location.replace(PAGINA_ACCESO);
}

function mostrarUsuario(usuario) {
  document.getElementById('auth-btn-text').textContent = usuario.nombreUsuario;

  const nombre = document.getElementById('user-display-name');

  if (nombre) {
    nombre.textContent = usuario.nombre;
  }
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
