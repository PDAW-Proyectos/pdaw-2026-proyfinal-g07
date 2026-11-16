import { leerPaginacion } from '../utils/paginacion.js';

/**
 * Traduce la entrada y su película a la representación Watchlist del contrato.
 */
function aRespuesta({ entrada, pelicula }) {
  return {
    id: entrada.id,
    fechaAgregado: entrada.fechaAgregado.toISOString(),
    pelicula: pelicula.toResumenJSON(),
  };
}

export function crearWatchlistController({ watchlistService }) {
  return {
    async crear(req, res) {
      const resultado = await watchlistService.crear(req.session.userId, req.body);

      res
        .status(201)
        .location(`/api/watchlist/${encodeURIComponent(resultado.entrada.peliculaId)}`)
        .json(aRespuesta(resultado));
    },

    async listar(req, res) {
      const { page, limit } = leerPaginacion(req.query);
      const resultado = await watchlistService.listar(req.session.userId, { page, limit });

      res.json({
        data: resultado.data.map(aRespuesta),
        page: resultado.page,
        limit: resultado.limit,
        total: resultado.total,
      });
    },

    async obtener(req, res) {
      const resultado = await watchlistService.obtener(req.session.userId, req.params.peliculaId);

      res.json(
        resultado.entrada
          ? { enWatchlist: true, entrada: aRespuesta(resultado) }
          : { enWatchlist: false },
      );
    },

    async eliminar(req, res) {
      await watchlistService.eliminar(req.session.userId, req.params.peliculaId);

      res.status(204).send();
    },
  };
}
