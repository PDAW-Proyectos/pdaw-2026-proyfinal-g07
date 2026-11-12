/**
 * Representación Reseña del contrato. El autor usa la representación pública:
 * nunca incluye email ni hash.
 */
export function aResenaJSON({ resena, autor, pelicula }) {
  return {
    id: resena.id,
    comentario: resena.comentario,
    fechaPublicacion: resena.fechaPublicacion.toISOString(),
    autor: autor.toPublicJSON(),
    pelicula: pelicula.toResumenJSON(),
  };
}

/**
 * Representación de una colección paginada de reseñas.
 */
export function aColeccionResenas(resultado) {
  return {
    data: resultado.data.map(aResenaJSON),
    page: resultado.page,
    limit: resultado.limit,
    total: resultado.total,
  };
}
