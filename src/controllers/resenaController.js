import { leerPaginacion } from '../utils/paginacion.js';

/**
 * Traduce el agregado del servicio a la representación Reseña del contrato.
 * El autor usa la representación pública: nunca incluye email ni hash.
 */
function aRespuesta({ resena, autor, pelicula }) {
  return {
    id: resena.id,
    comentario: resena.comentario,
    fechaPublicacion: resena.fechaPublicacion.toISOString(),
    autor: autor.toPublicJSON(),
    pelicula: pelicula.toResumenJSON(),
  };
}

function aColeccion(resultado) {
  return {
    data: resultado.data.map(aRespuesta),
    page: resultado.page,
    limit: resultado.limit,
    total: resultado.total,
  };
}

export function crearResenaController({ resenaService }) {
  return {
    async recientes(req, res) {
      const { page, limit } = leerPaginacion(req.query);

      res.json(aColeccion(await resenaService.listarRecientes({ page, limit })));
    },

    async mias(req, res) {
      const { page, limit } = leerPaginacion(req.query);

      res.json(aColeccion(await resenaService.listarMias(req.session.userId, { page, limit })));
    },

    async obtener(req, res) {
      res.json(aRespuesta(await resenaService.obtener(req.params.id)));
    },

    async crear(req, res) {
      const resultado = await resenaService.crear(req.session.userId, req.body);

      res.status(201).location(`/api/resenas/${resultado.resena.id}`).json(aRespuesta(resultado));
    },

    async actualizar(req, res) {
      const resultado = await resenaService.actualizar(req.session.userId, req.params.id, req.body);

      res.json(aRespuesta(resultado));
    },

    async eliminar(req, res) {
      await resenaService.eliminar(req.session.userId, req.params.id);

      res.status(204).send();
    },
  };
}
