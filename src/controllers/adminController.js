import { leerPaginacion } from '../utils/paginacion.js';

export function crearAdminController({ adminService }) {
  return {
    async listarUsuarios(req, res) {
      const { page, limit } = leerPaginacion(req.query);

      res.json(await adminService.listarUsuarios({ page, limit }));
    },

    async eliminarUsuario(req, res) {
      await adminService.eliminarUsuario(req.usuario.id, req.params.id);

      res.status(204).send();
    },

    async eliminarResena(req, res) {
      await adminService.eliminarResena(req.params.id);

      res.status(204).send();
    },
  };
}
