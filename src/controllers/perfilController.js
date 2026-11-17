import { ErrorDominio } from '../utils/ErrorDominio.js';
import { leerPaginacion } from '../utils/paginacion.js';
import { aColeccionResenas } from './resenaRepresentacion.js';

function aMejorPuntuadaJSON({ pelicula, puntuacion }) {
  return {
    ...pelicula.toResumenJSON(),
    puntuacion,
  };
}

function aPerfilJSON({ usuario, estadisticas, favoritas, mejorPuntuadas, afinidad }, { esPropio }) {
  return {
    usuario: usuario.toPublicJSON(),
    esPropio,
    estadisticas,
    favoritas: favoritas.map((pelicula) => pelicula.toResumenJSON()),
    mejorPuntuadas: mejorPuntuadas.map(aMejorPuntuadaJSON),
    afinidad,
  };
}

export function crearPerfilController({ perfilService, resenaService }) {
  return {
    async perfil(req, res) {
      const visitanteId = req.session?.userId ?? null;
      const perfil = await perfilService.obtenerPerfilPublico(req.params.usuarioId, {
        visitanteId,
      });

      res.json(
        aPerfilJSON(perfil, {
          esPropio: visitanteId !== null && visitanteId === perfil.usuario.id,
        }),
      );
    },

    async actualizarFavoritas(req, res) {
      if (req.params.usuarioId !== req.usuario.id) {
        throw new ErrorDominio(
          'NO_AUTORIZADO',
          'Solo podés modificar tus propias películas favoritas.',
        );
      }

      const { favoritas } = await perfilService.actualizarFavoritas(req.usuario.id, req.body);

      res.json({
        favoritas: favoritas.map((pelicula) => pelicula.toResumenJSON()),
      });
    },

    async resenas(req, res) {
      const { page, limit } = leerPaginacion(req.query);

      res.json(
        aColeccionResenas(
          await resenaService.listarPorUsuario(req.params.usuarioId, { page, limit }),
        ),
      );
    },
  };
}
