import { leerPaginacion } from '../utils/paginacion.js';
import { aColeccionResenas, aResenaJSON } from './resenaRepresentacion.js';

export function crearResenaController({ resenaService }) {
  return {
    async recientes(req, res) {
      const { page, limit } = leerPaginacion(req.query);

      res.json(aColeccionResenas(await resenaService.listarRecientes({ page, limit })));
    },

    async mias(req, res) {
      const { page, limit } = leerPaginacion(req.query);

      res.json(
        aColeccionResenas(await resenaService.listarMias(req.session.userId, { page, limit })),
      );
    },

    async obtener(req, res) {
      res.json(aResenaJSON(await resenaService.obtener(req.params.id)));
    },

    async crear(req, res) {
      const resultado = await resenaService.crear(req.session.userId, req.body);

      res.status(201).location(`/api/resenas/${resultado.resena.id}`).json(aResenaJSON(resultado));
    },

    async actualizar(req, res) {
      const resultado = await resenaService.actualizar(req.session.userId, req.params.id, req.body);

      res.json(aResenaJSON(resultado));
    },

    async eliminar(req, res) {
      await resenaService.eliminar(req.session.userId, req.params.id);

      res.status(204).send();
    },
  };
}
