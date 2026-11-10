export const NOMBRE_COOKIE_SESION = 'fg_sesion';

function esperarCallback(accion) {
  return new Promise((resolve, reject) => {
    accion((error) => (error ? reject(error) : resolve()));
  });
}

export function regenerarSesion(req) {
  return esperarCallback((callback) => req.session.regenerate(callback));
}

export function guardarSesion(req) {
  return esperarCallback((callback) => req.session.save(callback));
}

export function destruirSesion(req) {
  return esperarCallback((callback) => req.session.destroy(callback));
}
