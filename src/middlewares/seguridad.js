const CABECERAS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

/**
 * Agrega cabeceras de seguridad básicas a todas las respuestas.
 * La Content-Security-Policy queda para cuando estén definidos los orígenes
 * externos del front (CDN, fuentes e imágenes de TMDB).
 */
export function cabecerasSeguridad(req, res, next) {
  for (const [nombre, valor] of Object.entries(CABECERAS)) {
    res.set(nombre, valor);
  }

  next();
}
