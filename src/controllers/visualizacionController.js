import { leerPaginacion } from '../utils/paginacion.js';

/**
 * Traduce el agregado del servicio a la representación Visualización del contrato.
 */
function aRespuesta({ visualizacion, pelicula }) {
  return {
    id: visualizacion.id,
    fecha: visualizacion.fecha,
    puntuacion: visualizacion.puntuacion,
    pelicula: pelicula.toResumenJSON(),
  };
}

export function crearVisualizacionController({ visualizacionService }) {
  return {
    async crear(req, res) {
      const resultado = await visualizacionService.crear(req.session.userId, req.body);

      res
        .status(201)
        .location(`/api/visualizaciones/${resultado.visualizacion.id}`)
        .json(aRespuesta(resultado));
    },

    async listar(req, res) {
      const { page, limit } = leerPaginacion(req.query);
      const resultado = await visualizacionService.listar(req.session.userId, {
        page,
        limit,
        orden: req.query.orden,
      });

      res.json({
        data: resultado.data.map(aRespuesta),
        page: resultado.page,
        limit: resultado.limit,
        total: resultado.total,
      });
    },

    async obtener(req, res) {
      const resultado = await visualizacionService.obtener(req.session.userId, req.params.id);

      res.json(aRespuesta(resultado));
    },

    async actualizar(req, res) {
      const resultado = await visualizacionService.actualizar(
        req.session.userId,
        req.params.id,
        req.body,
      );

      res.json(aRespuesta(resultado));
    },

    async eliminar(req, res) {
      await visualizacionService.eliminar(req.session.userId, req.params.id);

      res.status(204).send();
    },
  };
}
