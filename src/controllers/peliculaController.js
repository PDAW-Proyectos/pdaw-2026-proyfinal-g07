import { leerPagina, leerPaginacion } from '../utils/paginacion.js';
import { aColeccionResenas } from './resenaRepresentacion.js';

/**
 * Representación de una colección paginada de películas resumidas.
 */
function aColeccionPeliculas({ data, page, limit, total }) {
  return {
    data: data.map((pelicula) => pelicula.toResumenJSON()),
    page,
    limit,
    total,
  };
}

export function crearPeliculaController({ peliculaService }) {
  return {
    async buscar(req, res) {
      const { page } = leerPagina(req.query);

      res.json(aColeccionPeliculas(await peliculaService.buscar({ q: req.query.q, page })));
    },

    async tendencias(req, res) {
      const { page } = leerPagina(req.query);

      res.json(aColeccionPeliculas(await peliculaService.tendencias({ page })));
    },

    async obtener(req, res) {
      const pelicula = await peliculaService.obtener(req.params.peliculaId);

      res.json(pelicula.toDetalleJSON());
    },

    async resenas(req, res) {
      const { page, limit } = leerPaginacion(req.query);
      const resultado = await peliculaService.listarResenas(req.params.peliculaId, {
        page,
        limit,
      });

      res.json(aColeccionResenas(resultado));
    },
  };
}
