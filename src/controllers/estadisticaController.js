export function crearEstadisticaController({ estadisticaService }) {
  return {
    async obtener(req, res) {
      const estadisticas = await estadisticaService.obtener(req.session.userId);

      res.json(estadisticas);
    },
  };
}
