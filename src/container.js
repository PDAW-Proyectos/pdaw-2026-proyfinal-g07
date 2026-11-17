import { config } from './config.js';
import { TMDBAdapter } from './integrations/TMDBAdapter.js';
import { JsonStore, MemoryStore } from './repositories/JsonStore.js';
import { UsuarioRepository } from './repositories/UsuarioRepository.js';
import { PeliculaRepository } from './repositories/PeliculaRepository.js';
import { VisualizacionRepository } from './repositories/VisualizacionRepository.js';
import { ResenaRepository } from './repositories/ResenaRepository.js';
import { WatchlistRepository } from './repositories/WatchlistRepository.js';
import { PeliculaService } from './services/PeliculaService.js';
import { ResenaService } from './services/ResenaService.js';
import { UsuarioService } from './services/UsuarioService.js';
import { VisualizacionService } from './services/VisualizacionService.js';
import { WatchlistService } from './services/WatchlistService.js';
import { AdminService } from './services/AdminService.js';
import { EstadisticaService } from './services/EstadisticaService.js';
import { PuntuacionService } from './services/PuntuacionService.js';
import { PerfilService } from './services/PerfilService.js';

/**
 * Crea y conecta el store y los repositorios.
 * Si no se inyecta un store, usa persistencia JSON en la ruta configurada.
 * `tmdbAdapter` permite reemplazar la integración externa en las pruebas.
 */
export async function createContainer({
  store,
  rondasHash,
  ahora = () => new Date(),
  tmdbAdapter,
} = {}) {
  const almacen = store ?? new JsonStore({ archivo: config.dataFile });

  await almacen.cargar();

  const usuarioRepository = new UsuarioRepository({ store: almacen });
  const peliculaRepository = new PeliculaRepository({ store: almacen });
  const visualizacionRepository = new VisualizacionRepository({ store: almacen });
  const resenaRepository = new ResenaRepository({ store: almacen });
  const watchlistRepository = new WatchlistRepository({ store: almacen });

  const adaptadorTmdb =
    tmdbAdapter ?? new TMDBAdapter({ apiKey: config.tmdbApiKey, baseUrl: config.tmdbBaseUrl });

  const usuarioService = new UsuarioService({ usuarioRepository, rondasHash });
  const puntuacionService = new PuntuacionService({
    resenaRepository,
    visualizacionRepository,
  });
  const visualizacionService = new VisualizacionService({
    visualizacionRepository,
    peliculaRepository,
    puntuacionService,
    hoy: ahora,
  });
  const resenaService = new ResenaService({
    resenaRepository,
    peliculaRepository,
    usuarioRepository,
    puntuacionService,
    ahora,
  });
  const watchlistService = new WatchlistService({
    watchlistRepository,
    peliculaRepository,
    visualizacionRepository,
    ahora,
  });
  const peliculaService = new PeliculaService({
    peliculaRepository,
    tmdbAdapter: adaptadorTmdb,
    resenaService,
    puntuacionService,
    watchlistRepository,
    visualizacionRepository,
    ahora,
  });
  const adminService = new AdminService({
    usuarioRepository,
    resenaRepository,
    visualizacionRepository,
    watchlistRepository,
    rondasHash,
  });
  const estadisticaService = new EstadisticaService({
    visualizacionRepository,
    resenaRepository,
  });
  const perfilService = new PerfilService({
    usuarioRepository,
    resenaRepository,
    peliculaRepository,
    puntuacionService,
  });

  await usuarioService.calentar();

  return {
    store: almacen,
    usuarioRepository,
    usuarioService,
    peliculaRepository,
    peliculaService,
    tmdbAdapter: adaptadorTmdb,
    visualizacionRepository,
    resenaRepository,
    watchlistRepository,
    visualizacionService,
    resenaService,
    puntuacionService,
    watchlistService,
    adminService,
    estadisticaService,
    perfilService,
  };
}

export { JsonStore, MemoryStore };
