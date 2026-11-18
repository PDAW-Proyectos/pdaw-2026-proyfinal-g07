import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { createApp } from '../../src/app.js';
import { createContainer } from '../../src/container.js';
import { Pelicula } from '../../src/models/Pelicula.js';
import { MemoryStore } from '../../src/repositories/JsonStore.js';

const loggerSilencioso = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

const RUTAS_NAVEGADOR = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  linux: [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
    'microsoft-edge',
  ],
};

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function existeEjecutable(candidato) {
  if (candidato.includes('/') || candidato.includes('\\')) {
    return existsSync(candidato);
  }

  return (process.env.PATH ?? '')
    .split(delimiter)
    .some((directorio) => existsSync(join(directorio, candidato)));
}

function resolverNavegador() {
  const configurado = process.env.CHROME_PATH;

  if (configurado) {
    assert.ok(existsSync(configurado), `CHROME_PATH no existe: ${configurado}`);
    return configurado;
  }

  const candidato = (RUTAS_NAVEGADOR[process.platform] ?? []).find(existeEjecutable);

  assert.ok(
    candidato,
    'No se encontró Chrome ni Edge. Definí CHROME_PATH con la ruta al ejecutable.',
  );

  return candidato;
}

async function cerrarNavegador(navegador) {
  if (navegador.exitCode !== null) {
    return;
  }

  const salida = new Promise((resolve) => navegador.once('exit', resolve));

  navegador.kill();
  await Promise.race([salida, esperar(3000)]);
}

async function obtenerPuertoLibre() {
  const servidor = createServer();

  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', resolve);
  });

  const { port } = servidor.address();

  await new Promise((resolve) => servidor.close(resolve));

  return port;
}

async function esperarDevTools(puerto, navegador) {
  const limite = Date.now() + 15000;

  while (Date.now() < limite) {
    if (navegador.exitCode !== null) {
      throw new Error(
        `El navegador terminó antes de iniciar DevTools (código ${navegador.exitCode}).`,
      );
    }

    try {
      const respuesta = await fetch(`http://127.0.0.1:${puerto}/json/version`);

      if (respuesta.ok) {
        return;
      }
    } catch {
      // El puerto todavía no está disponible.
    }

    await esperar(200);
  }

  throw new Error('DevTools no respondió dentro del tiempo esperado.');
}

async function conectarPagina(puerto) {
  const respuesta = await fetch(`http://127.0.0.1:${puerto}/json/new?about:blank`, {
    method: 'PUT',
  });

  assert.ok(respuesta.ok, `No se pudo crear la pestaña: HTTP ${respuesta.status}`);

  const objetivo = await respuesta.json();
  const ws = new WebSocket(objetivo.webSocketDebuggerUrl);
  const pendientes = new Map();
  let contador = 0;

  ws.addEventListener('message', (evento) => {
    const mensaje = JSON.parse(evento.data);

    if (!mensaje.id) {
      return;
    }

    const pendiente = pendientes.get(mensaje.id);

    pendientes.delete(mensaje.id);

    if (mensaje.error) {
      pendiente?.reject(new Error(JSON.stringify(mensaje.error)));
    } else {
      pendiente?.resolve(mensaje.result);
    }
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  function enviar(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++contador;

      pendientes.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  return {
    enviar,
    cerrar() {
      ws.close();
    },
  };
}

async function evaluar(pagina, expression, { awaitPromise = false } = {}) {
  const resultado = await pagina.enviar('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });

  if (resultado.exceptionDetails) {
    throw new Error(resultado.exceptionDetails.text ?? 'La evaluación falló.');
  }

  return resultado.result.value;
}

async function esperarExpresion(pagina, expression, descripcion, { timeout = 10000 } = {}) {
  const limite = Date.now() + timeout;

  while (Date.now() < limite) {
    try {
      if (await evaluar(pagina, expression)) {
        return;
      }
    } catch {
      // La navegación puede destruir el contexto de ejecución mientras se espera.
    }

    await esperar(150);
  }

  throw new Error(`Timeout esperando: ${descripcion}`);
}

async function iniciarAplicacion() {
  const container = await createContainer({
    store: new MemoryStore(),
    rondasHash: 4,
  });
  const app = createApp({ logger: loggerSilencioso, container });
  const servidor = app.listen(0, '127.0.0.1');

  await new Promise((resolve, reject) => {
    servidor.once('listening', resolve);
    servidor.once('error', reject);
  });

  return {
    container,
    servidor,
    baseUrl: `http://127.0.0.1:${servidor.address().port}`,
  };
}

async function detenerAplicacion(servidor) {
  await new Promise((resolve, reject) => {
    servidor.close((error) => (error ? reject(error) : resolve()));
    servidor.closeAllConnections();
  });
}

function obtenerCookie(respuesta) {
  return respuesta.headers.get('set-cookie')?.split(';')[0] ?? null;
}

async function registrar(baseUrl, nombreUsuario) {
  const respuesta = await fetch(`${baseUrl}/api/auth/registro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: `Usuario ${nombreUsuario}`,
      nombreUsuario,
      email: `${nombreUsuario}@example.com`,
      contrasena: 'secreto123',
    }),
  });

  assert.ok(respuesta.ok, `No se pudo registrar ${nombreUsuario}: HTTP ${respuesta.status}`);

  return {
    cookie: obtenerCookie(respuesta),
    usuario: (await respuesta.json()).usuario,
  };
}

async function ejecutarFlujo() {
  const rutaNavegador = resolverNavegador();
  const puertoDevTools = await obtenerPuertoLibre();
  const perfilTemporal = await mkdtemp(join(tmpdir(), 'fotograma-e2e-'));
  const argumentos = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${puertoDevTools}`,
    `--user-data-dir=${perfilTemporal}`,
    'about:blank',
  ];

  if (process.platform !== 'win32') {
    argumentos.push('--no-sandbox');
  }

  const navegador = spawn(rutaNavegador, argumentos, { stdio: 'ignore' });
  let pagina;

  try {
    await esperarDevTools(puertoDevTools, navegador);
    pagina = await conectarPagina(puertoDevTools);
    await pagina.enviar('Runtime.enable');
    await pagina.enviar('Page.enable');

    const { container, servidor, baseUrl } = await iniciarAplicacion();

    try {
      const autor = await registrar(baseUrl, 'autor-e2e');
      const pelicula = new Pelicula({
        id: 'p-e2e-perfil',
        tmdbId: 603,
        titulo: 'Matrix E2E',
        sinopsis: 'Película usada por la prueba E2E de reseña y perfil.',
        anioEstreno: 1999,
        generos: ['Acción', 'Ciencia ficción'],
        rutaPoster: '/matrix-e2e.jpg',
        rutaBackdrop: '/matrix-e2e-backdrop.jpg',
      });

      await container.peliculaRepository.guardar(pelicula);

      const respuestaResena = await fetch(`${baseUrl}/api/resenas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: autor.cookie,
        },
        body: JSON.stringify({
          peliculaId: pelicula.id,
          comentario: 'Reseña creada para verificar el enlace al perfil del autor.',
          puntuacion: 5,
        }),
      });

      assert.ok(respuestaResena.ok, `No se pudo crear la reseña: HTTP ${respuestaResena.status}`);

      const respuestaFavoritas = await fetch(
        `${baseUrl}/api/usuarios/${autor.usuario.id}/favoritas`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: autor.cookie,
          },
          body: JSON.stringify({ favoritas: [pelicula.id] }),
        },
      );

      assert.ok(
        respuestaFavoritas.ok,
        `No se pudieron guardar las favoritas: HTTP ${respuestaFavoritas.status}`,
      );

      await pagina.enviar('Page.navigate', { url: `${baseUrl}/index.html` });
      await esperarExpresion(
        pagina,
        `document.querySelectorAll('.resena-enlazable').length > 0`,
        'que se renderice una reseña reciente',
      );

      const hrefAutor = await evaluar(
        pagina,
        `document.querySelector('.resena-enlazable .resena-reciente-autor')?.href`,
      );
      const hrefEsperado = new URL(`usuario.html?id=${autor.usuario.id}`, baseUrl).href;

      assert.equal(hrefAutor, hrefEsperado);

      await evaluar(pagina, `document.querySelector('.resena-enlazable').click()`);
      await esperarExpresion(
        pagina,
        `location.pathname.endsWith('/usuario.html') && new URLSearchParams(location.search).get('id') === ${JSON.stringify(autor.usuario.id)}`,
        'que la tarjeta navegue al perfil del autor',
      );
      await esperarExpresion(
        pagina,
        `document.querySelector('#perfil-publico') && !document.querySelector('#perfil-publico').classList.contains('d-none')`,
        'que el perfil público quede visible',
      );
      await esperarExpresion(
        pagina,
        `document.querySelectorAll('#resenas-publicas-container .review-card').length === 1`,
        'que se rendericen las reseñas del perfil',
      );

      const estado = JSON.parse(
        await evaluar(
          pagina,
          `JSON.stringify({
            errorVisible: !document.getElementById('usuario-no-disponible').classList.contains('d-none'),
            favoritas: document.getElementById('favoritas-elegidas-container').children.length,
            mejorPuntuadas: document.getElementById('favoritas-container').children.length,
            resenas: document.querySelectorAll('#resenas-publicas-container .review-card').length,
          })`,
        ),
      );

      assert.deepEqual(estado, {
        errorVisible: false,
        favoritas: 1,
        mejorPuntuadas: 1,
        resenas: 1,
      });

      console.log('E2E OK: la reseña navega al perfil y el perfil se renderiza completo.');
    } finally {
      await detenerAplicacion(servidor);
    }
  } finally {
    pagina?.cerrar();
    await cerrarNavegador(navegador);
    await rm(perfilTemporal, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    }).catch(() => {});
  }
}

await ejecutarFlujo();
