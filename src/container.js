import { config } from './config.js';
import { JsonStore, MemoryStore } from './repositories/JsonStore.js';
import { UsuarioRepository } from './repositories/UsuarioRepository.js';
import { PeliculaRepository } from './repositories/PeliculaRepository.js';
import { VisualizacionRepository } from './repositories/VisualizacionRepository.js';
import { ResenaRepository } from './repositories/ResenaRepository.js';
import { UsuarioService } from './services/UsuarioService.js';
import { VisualizacionService } from './services/VisualizacionService.js';

/**
 * Crea y conecta el store y los repositorios.
 * Si no se inyecta un store, usa persistencia JSON en la ruta configurada.
 */
export async function createContainer({ store, rondasHash } = {}) {
  const almacen = store ?? new JsonStore({ archivo: config.dataFile });

  await almacen.cargar();

  const usuarioRepository = new UsuarioRepository({ store: almacen });
  const peliculaRepository = new PeliculaRepository({ store: almacen });
  const visualizacionRepository = new VisualizacionRepository({ store: almacen });
  const resenaRepository = new ResenaRepository({ store: almacen });

  const usuarioService = new UsuarioService({ usuarioRepository, rondasHash });
  const visualizacionService = new VisualizacionService({
    visualizacionRepository,
    peliculaRepository,
  });

  await usuarioService.calentar();

  return {
    store: almacen,
    usuarioRepository,
    usuarioService,
    peliculaRepository,
    visualizacionRepository,
    resenaRepository,
    visualizacionService,
  };
}

export { JsonStore, MemoryStore };
