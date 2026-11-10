import { config } from './config.js';
import { JsonStore, MemoryStore } from './repositories/JsonStore.js';
import { UsuarioRepository } from './repositories/UsuarioRepository.js';
import { PeliculaRepository } from './repositories/PeliculaRepository.js';
import { VisualizacionRepository } from './repositories/VisualizacionRepository.js';
import { ResenaRepository } from './repositories/ResenaRepository.js';

/**
 * Crea y conecta el store y los repositorios.
 * Si no se inyecta un store, usa persistencia JSON en la ruta configurada.
 */
export async function createContainer({ store } = {}) {
  const almacen = store ?? new JsonStore({ archivo: config.dataFile });

  await almacen.cargar();

  return {
    store: almacen,
    usuarioRepository: new UsuarioRepository({ store: almacen }),
    peliculaRepository: new PeliculaRepository({ store: almacen }),
    visualizacionRepository: new VisualizacionRepository({ store: almacen }),
    resenaRepository: new ResenaRepository({ store: almacen }),
  };
}

export { JsonStore, MemoryStore };
