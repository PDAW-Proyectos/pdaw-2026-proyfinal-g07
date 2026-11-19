import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const DIA_MS = 24 * 60 * 60 * 1000;
const CONTRASENA_DEMO = 'Demo1234!';
const archivoReal = fileURLToPath(new URL('../data/fotograma.json', import.meta.url));
const archivoDemo = resolve(
  process.env.DEMO_DATA_FILE ?? fileURLToPath(new URL('../data/demo.json', import.meta.url)),
);
let carpetaTemporal;

if (archivoDemo.toLowerCase() === archivoReal.toLowerCase()) {
  throw new Error('DEMO_DATA_FILE no puede apuntar al archivo de datos real.');
}

const USUARIOS = [
  {
    clave: 'lucia',
    nombre: 'Lucía Fernández',
    nombreUsuario: 'lucia',
    email: 'lucia@fotograma.demo',
  },
  {
    clave: 'mateo',
    nombre: 'Mateo Ríos',
    nombreUsuario: 'mateo',
    email: 'mateo@fotograma.demo',
  },
  {
    clave: 'sofia',
    nombre: 'Sofía Benítez',
    nombreUsuario: 'sofia',
    email: 'sofia@fotograma.demo',
  },
  {
    clave: 'usuario',
    nombre: 'Usuario Demo',
    nombreUsuario: 'usuario',
    email: 'usuario@fotograma.demo',
    contrasena: 'contrasena',
  },
];

const ADMIN = {
  nombre: 'Administrador Demo',
  nombreUsuario: 'admin_demo',
  email: 'admin@fotograma.demo',
  password: CONTRASENA_DEMO,
};

const RESENAS = [
  {
    usuario: 'lucia',
    pelicula: 0,
    puntuacion: 5,
    diasAtras: 62,
    comentario:
      'Me atrapó desde la primera escena. La fotografía y la banda sonora están a otro nivel.',
  },
  {
    usuario: 'lucia',
    pelicula: 1,
    puntuacion: 4,
    diasAtras: 45,
    comentario:
      'Muy entretenida; el ritmo decae un poco en el segundo acto, pero el final compensa.',
  },
  {
    usuario: 'lucia',
    pelicula: 2,
    puntuacion: 4,
    diasAtras: 30,
    comentario: 'Un relato sólido, con personajes que se quedan conmigo después de los créditos.',
  },
  {
    usuario: 'lucia',
    pelicula: 3,
    puntuacion: 3,
    diasAtras: 12,
    comentario: 'Cumple, aunque esperaba un poco más de desarrollo en el conflicto principal.',
  },
  {
    usuario: 'mateo',
    pelicula: 1,
    puntuacion: 5,
    diasAtras: 55,
    comentario: 'Una de esas películas que dan ganas de volver a ver al día siguiente. Impecable.',
  },
  {
    usuario: 'mateo',
    pelicula: 2,
    puntuacion: 3,
    diasAtras: 40,
    comentario: 'Correcta y ambiciosa, pero siento que le falta profundidad en los personajes.',
  },
  {
    usuario: 'mateo',
    pelicula: 4,
    puntuacion: 4,
    diasAtras: 25,
    comentario: 'Gran trabajo de dirección y un cierre que no se siente forzado.',
  },
  {
    usuario: 'mateo',
    pelicula: 5,
    puntuacion: 4,
    diasAtras: 8,
    comentario: 'La disfruté mucho; tiene ideas visuales muy potentes.',
  },
  {
    usuario: 'sofia',
    pelicula: 0,
    puntuacion: 4,
    diasAtras: 50,
    comentario: 'Hermosa puesta en escena y actuaciones muy convincentes.',
  },
  {
    usuario: 'sofia',
    pelicula: 3,
    puntuacion: 5,
    diasAtras: 35,
    comentario: 'Me sorprendió de principio a fin. De mis favoritas del año.',
  },
  {
    usuario: 'sofia',
    pelicula: 5,
    puntuacion: 3,
    diasAtras: 20,
    comentario: 'Tiene buenos momentos, aunque la historia no termina de despegar.',
  },
  {
    usuario: 'sofia',
    pelicula: 6,
    puntuacion: 5,
    diasAtras: 5,
    comentario: 'Una experiencia completa: guion, imagen y sonido funcionan muy bien juntos.',
  },
  {
    usuario: 'usuario',
    pelicula: 0,
    puntuacion: 5,
    diasAtras: 42,
    comentario: 'Coincido con Lucía: la fotografía y la música sostienen toda la película.',
  },
  {
    usuario: 'usuario',
    pelicula: 1,
    puntuacion: 4,
    diasAtras: 28,
    comentario: 'Muy entretenida, con un final que justifica la espera.',
  },
  {
    usuario: 'usuario',
    pelicula: 2,
    puntuacion: 4,
    diasAtras: 16,
    comentario: 'Personajes bien construidos y una historia que deja para pensar.',
  },
];

const VISUALIZACIONES_EXTRA = [
  { usuario: 'lucia', pelicula: 7, diasAtras: 85, puntuacion: 4 },
  { usuario: 'lucia', pelicula: 11, diasAtras: 18, puntuacion: 3 },
  { usuario: 'mateo', pelicula: 8, diasAtras: 70, puntuacion: 5 },
  { usuario: 'mateo', pelicula: 10, diasAtras: 15, puntuacion: 3 },
  { usuario: 'sofia', pelicula: 7, diasAtras: 60, puntuacion: 4 },
  { usuario: 'sofia', pelicula: 8, diasAtras: 14, puntuacion: 5 },
  { usuario: 'usuario', pelicula: 7, diasAtras: 10, puntuacion: 4 },
  { usuario: 'usuario', pelicula: 11, diasAtras: 6, puntuacion: 3 },
];

const FAVORITAS = {
  lucia: [0, 1, 2, 4],
  mateo: [1, 2, 4, 5],
  sofia: [0, 3, 5, 6],
  usuario: [0, 1, 2, 4],
};

const WATCHLIST = {
  lucia: [8, 9, 10],
  mateo: [0, 3, 6],
  sofia: [1, 2, 9],
  usuario: [3, 8, 9],
};

function fechaHace(dias) {
  const fecha = new Date();

  fecha.setDate(fecha.getDate() - dias);

  return fecha.toISOString().slice(0, 10);
}

let reloj = new Date();
const ahora = () => new Date(reloj.getTime());

try {
  carpetaTemporal = await mkdtemp(resolve(tmpdir(), 'fotograma-demo-'));
  process.env.DATA_FILE = resolve(carpetaTemporal, 'demo.json');

  const { config } = await import('../src/config.js');

  if (!config.tmdbApiKey) {
    throw new Error('Falta TMDB_API_KEY. Configurala en .env antes de crear la demo.');
  }

  const { createContainer } = await import('../src/container.js');
  const contenedor = await createContainer({ ahora });
  const catalogo = await contenedor.peliculaService.catalogo({ page: 1 });
  const peliculas = catalogo.data;

  if (peliculas.length < 12) {
    throw new Error('TMDB devolvió menos películas de las necesarias para la demo.');
  }

  const usuarios = {};

  for (const { clave, contrasena = CONTRASENA_DEMO, ...datos } of USUARIOS) {
    usuarios[clave] = await contenedor.usuarioService.registrar({
      ...datos,
      contrasena,
    });
  }

  await contenedor.adminService.asegurarAdmin(ADMIN);

  for (const resena of RESENAS) {
    await contenedor.visualizacionService.crear(usuarios[resena.usuario].id, {
      peliculaId: peliculas[resena.pelicula].id,
      fecha: fechaHace(resena.diasAtras + 2),
      puntuacion: resena.puntuacion,
    });
  }

  for (const visualizacion of VISUALIZACIONES_EXTRA) {
    await contenedor.visualizacionService.crear(usuarios[visualizacion.usuario].id, {
      peliculaId: peliculas[visualizacion.pelicula].id,
      fecha: fechaHace(visualizacion.diasAtras),
      puntuacion: visualizacion.puntuacion,
    });
  }

  for (const resena of RESENAS) {
    const anterior = reloj;

    reloj = new Date(Date.now() - resena.diasAtras * DIA_MS);

    try {
      await contenedor.resenaService.crear(usuarios[resena.usuario].id, {
        peliculaId: peliculas[resena.pelicula].id,
        comentario: resena.comentario,
        puntuacion: resena.puntuacion,
      });
    } finally {
      reloj = anterior;
    }
  }

  for (const [clave, posiciones] of Object.entries(FAVORITAS)) {
    await contenedor.perfilService.actualizarFavoritas(usuarios[clave].id, {
      favoritas: posiciones.map((posicion) => peliculas[posicion].id),
    });
  }

  for (const [clave, posiciones] of Object.entries(WATCHLIST)) {
    for (const posicion of posiciones) {
      await contenedor.watchlistService.crear(usuarios[clave].id, {
        peliculaId: peliculas[posicion].id,
      });
    }
  }

  await mkdir(dirname(archivoDemo), { recursive: true });
  await copyFile(process.env.DATA_FILE, archivoDemo);
  await rm(carpetaTemporal, { recursive: true, force: true });

  const contar = (coleccion) => contenedor.store.leer(coleccion).length;

  console.log('Demo local creada.');
  console.log(`Archivo: ${archivoDemo}`);
  console.log(`Películas: ${contar('peliculas')}`);
  console.log(`Usuarios: ${contar('usuarios')}`);
  console.log(`Visualizaciones: ${contar('visualizaciones')}`);
  console.log(`Reseñas: ${contar('resenas')}`);
  console.log(`Watchlist: ${contar('watchlist')}`);
  console.log('');
  console.log('Usuarios:');
  for (const usuario of USUARIOS) {
    console.log(
      `- ${usuario.email} (${usuario.nombreUsuario}) · contraseña: ${usuario.contrasena ?? CONTRASENA_DEMO}`,
    );
  }
  console.log(
    `- ${ADMIN.email} (${ADMIN.nombreUsuario}, administrador) · contraseña: ${CONTRASENA_DEMO}`,
  );
  console.log('');
  console.log('Iniciar la demo:');
  console.log('  npm run demo');
} catch (error) {
  if (carpetaTemporal) {
    await rm(carpetaTemporal, { recursive: true, force: true });
  }

  console.error(`No se pudo crear la demo: ${error.message}`);
  process.exitCode = 1;
}
