# Fotograma

> Un diario de cine para registrar películas vistas, organizar el historial y compartir opiniones.

Proyecto del equipo **7** para **7513 · Proyecto de Desarrollo de Aplicaciones Web** — Tecnicatura Universitaria en Programación Web y Móvil, DCIC, UNS.

**Demo en línea:** <https://fotograma-satw.onrender.com> (Render, plan free: el servicio se duerme sin uso y el primer acceso puede tardar cerca de un minuto).

## Ficha del proyecto

| Aspecto                | Descripción                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Problema               | Los aficionados al cine necesitan registrar las películas que ven, organizar su historial y compartir opiniones.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Usuarios               | Personas interesadas en el cine que desean registrar visualizaciones, calificar películas y consultar reseñas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Funcionalidades núcleo | **1.** Buscar películas y consultar su información, incluidos director y puntuación de TMDB. **2.** Registrar visualizaciones con fecha y puntuación opcional y consultar el historial personal. **3.** Publicar y consultar reseñas, con puntuación opcional y promedio en la ficha. **4.** Puntuar una película vista sin escribir reseña; la nota se comparte con la reseña y cuenta en el promedio de la ficha. **5.** Explorar un catálogo amplio y filtrar y ordenar sus películas y las ya vistas por género, puntuación y año. **6.** Consultar perfiles públicos de otros usuarios, elegir hasta cinco películas favoritas y ver la afinidad cinéfila agregada. |
| Reglas de negocio      | **1.** Solo usuarios autenticados pueden registrar visualizaciones, publicar reseñas y usar la watchlist. **2.** Las puntuaciones son enteras de 1 a 5, opcionales y únicas por usuario y película. **3.** Solo el autor puede modificar o eliminar su reseña. **4.** No se permiten fechas futuras. **5.** No se admiten reseñas vacías. **6.** El historial personal es privado. **7.** Cada usuario tiene una sola watchlist y no puede repetir una película. **8.** Cada usuario puede elegir hasta cinco películas favoritas sin repetirlas y solo él puede modificarlas.                                                                                           |
| API externa            | **TMDB:** búsqueda y consulta de título, sinopsis, año de estreno, géneros, póster, director, puntuación y tráiler oficial. [Documentación](https://developer.themoviedb.org/docs/getting-started).                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### Alcance inicial

Películas, cuentas de usuario, historial personal, puntuaciones, reseñas públicas y una watchlist privada por usuario. Las estadísticas básicas, los perfiles públicos con hasta cinco favoritas y afinidad agregada, la administración de cuentas y la moderación de reseñas ya están incorporados. Series, seguimiento y me gusta quedan fuera de esta versión. El alcance se revisa en cada planificación.

## Equipo y roles

| Integrante         | GitHub         | Roles                         |
| ------------------ | -------------- | ----------------------------- |
| Leonel Stanton     | LeonelStanton  | Tech Lead y desarrollador     |
| Juan Pablo Rapetti | JuanRapetti    | Product Owner y desarrollador |
| Manuel Campagnoli  | manucampagnoli | Scrum Master y desarrollador  |

## Ejecución y pruebas

Requiere **Node.js 22.13 o superior**.

Copiar `.env.example` a `.env` y definir antes de iniciar el servidor:

- `SESSION_SECRET`: secreto largo y aleatorio para firmar la cookie de sesión.
- `TMDB_API_KEY`: clave de la API de TMDB. Se pide en [themoviedb.org](https://www.themoviedb.org/settings/api) y solo se usa en el servidor: nunca llega al navegador.
- `ADMIN_EMAIL` y `ADMIN_PASSWORD` (opcionales): si se definen juntos, al iniciar se crea una cuenta administradora si el email no existe. `ADMIN_NOMBRE` y `ADMIN_USUARIO` permiten personalizar el nombre visible y el alias. Una cuenta común con ese email no se promueve automáticamente.

Sin `TMDB_API_KEY`, la búsqueda, las tendencias y el catálogo responden `502` con el código `TMDB_NO_DISPONIBLE`; el resto de la aplicación sigue funcionando. Las pruebas no necesitan la clave ni acceso a la red: inyectan un adaptador falso.

```bash
npm install
npm run format:check
npm run lint
npm test
npm run test:e2e
npm start
```

`test:e2e` verifica con Chrome o Edge en modo headless el flujo reseña→perfil. Se puede indicar el ejecutable con `CHROME_PATH`; no requiere TMDB, base de datos ni servidor previo. Es una prueba opcional: no forma parte de `npm test` ni de la CI.

Servidor: **http://localhost:3000**. Panel de administración: **http://localhost:3000/admin.html** (solo cuentas con rol `admin`; permite eliminar cuentas y moderar reseñas).

### Demo local reproducible

La demo usa un archivo separado, `data/demo.json`, y no toca `data/fotograma.json`. Requiere `TMDB_API_KEY` porque trae el catálogo actual desde TMDB.

```bash
npm run seed:demo
npm run demo
```

`seed:demo` **reemplaza** `data/demo.json` en cada ejecución y crea 20 películas, cuatro usuarios con reseñas/visualizaciones/favoritas cruzadas (uno de ellos, `usuario`, pensado para la demo de afinidad) y una cuenta administradora. `demo` inicia el servidor con ese archivo. Las credenciales se muestran al final del seed y están en la [guía de uso](docs/guia-uso.md#demo-local-reproducible). Es solo para la presentación local: no usar estas cuentas en Render.

La integración continua ejecuta `npm ci`, `npm run format:check`, `npm run lint` y `npm test -- --coverage` en cada push a `main` y en cada pull request.

Las sesiones y los contadores de intentos viven en memoria: se pierden al reiniciar el servidor. Los usuarios, películas, visualizaciones, reseñas y watchlist se conservan en el archivo JSON configurado.

Tecnologías: JavaScript, Node.js, Express, Jest, ESLint, Prettier y GitHub Actions.

## Organización del código

- `src/controllers`: recibe HTTP y arma respuestas; no contiene reglas de negocio.
- `src/services`: reglas de negocio y autorización.
- `src/utils`: helpers transversales de paginación, validación y representación JSON.
- `public/js/api`: cliente HTTP y funciones por recurso.
- `public/js`: páginas, componentes de interfaz y utilidades del navegador.
- `public/js/constantes.js`: límites del contrato usados para validar temprano en el navegador; el servidor sigue siendo la autoridad.

## Despliegue en Render

El servicio está publicado en **<https://fotograma-satw.onrender.com>**; el health check responde en **<https://fotograma-satw.onrender.com/api/salud>**.

El repositorio incluye [`render.yaml`](render.yaml) con un Blueprint que define el despliegue:

1. El repositorio se conecta a GitHub y el **Blueprint** de Render apunta a este proyecto.
2. Render crea el servicio `fotograma`, ejecuta `npm ci` y arranca con `npm start`.
3. `TMDB_API_KEY` se define en el dashboard de Render; el Blueprint la marca como secreta.
4. `SESSION_SECRET` se genera automáticamente.
5. Opcional: `ADMIN_EMAIL` y `ADMIN_PASSWORD` crean la cuenta administradora en el primer arranque.
6. El health check `GET /api/salud` confirma que el servicio arrancó.

El Blueprint usa el plan `free` y no incluye disco persistente. El archivo `data/fotograma.json` se pierde en cada reinicio o deploy, y las sesiones también se cierran porque viven en memoria. Para conservar los datos hay que pasar a un plan pago y agregar un `disk` montado en `/var/data` con `DATA_FILE=/var/data/fotograma.json`.

El servicio corre en **una sola instancia**. Con el plan free se duerme tras unos 15 minutos sin uso, así que la primera visita puede demorar alrededor de un minuto.

## Endpoints de la API

Todas las rutas usan el prefijo `/api`. El detalle de campos, validaciones y errores está en el [contrato de API](docs/contrato_api.md). Los casos de éxito y error para probar manualmente están en [requests.http](requests.http).

| Método   | Ruta                                   | Acceso      | Éxito | Descripción                                      |
| -------- | -------------------------------------- | ----------- | ----- | ------------------------------------------------ |
| `GET`    | `/api/salud`                           | Público     | `200` | Estado del servicio.                             |
| `GET`    | `/api/auth/sesion`                     | Público     | `200` | Devuelve si hay sesión y los datos de la cuenta. |
| `POST`   | `/api/auth/registro`                   | Público     | `201` | Crea la cuenta e inicia sesión.                  |
| `POST`   | `/api/auth/login`                      | Público     | `200` | Inicia sesión con email o nombre de usuario.     |
| `POST`   | `/api/auth/logout`                     | Público     | `204` | Cierra la sesión y borra la cookie.              |
| `GET`    | `/api/peliculas/buscar?q=`             | Público     | `200` | Busca películas en TMDB y guarda la copia local. |
| `GET`    | `/api/peliculas/tendencias`            | Público     | `200` | Lista las tendencias de TMDB.                    |
| `GET`    | `/api/peliculas/catalogo`              | Público     | `200` | Catálogo popular de todas las épocas.            |
| `GET`    | `/api/peliculas/recomendadas`          | Autenticado | `200` | Recomendaciones según la actividad del usuario.  |
| `GET`    | `/api/peliculas/:peliculaId`           | Público     | `200` | Detalle de una película del catálogo local.      |
| `GET`    | `/api/peliculas/:peliculaId/trailer`   | Público     | `200` | Trailer oficial de YouTube, si existe.           |
| `GET`    | `/api/peliculas/:peliculaId/resenas`   | Público     | `200` | Reseñas públicas de una película.                |
| `GET`    | `/api/usuarios/:usuarioId`             | Público     | `200` | Perfil público, favoritas, métricas y afinidad.  |
| `PUT`    | `/api/usuarios/:usuarioId/favoritas`   | Dueño       | `200` | Reemplaza la selección de hasta cinco favoritas. |
| `GET`    | `/api/usuarios/:usuarioId/resenas`     | Público     | `200` | Reseñas públicas de un usuario.                  |
| `GET`    | `/api/resenas/recientes`               | Público     | `200` | Últimas reseñas publicadas.                      |
| `GET`    | `/api/resenas/:id`                     | Público     | `200` | Detalle de una reseña.                           |
| `GET`    | `/api/resenas/mias`                    | Autenticado | `200` | Reseñas del usuario autenticado.                 |
| `POST`   | `/api/resenas`                         | Autenticado | `201` | Publica una reseña.                              |
| `PATCH`  | `/api/resenas/:id`                     | Autor       | `200` | Edita una reseña propia.                         |
| `DELETE` | `/api/resenas/:id`                     | Autor       | `204` | Elimina una reseña propia.                       |
| `GET`    | `/api/visualizaciones`                 | Dueño       | `200` | Historial privado del usuario autenticado.       |
| `POST`   | `/api/visualizaciones`                 | Autenticado | `201` | Registra una visualización.                      |
| `GET`    | `/api/visualizaciones/:id`             | Dueño       | `200` | Detalle de una visualización propia.             |
| `PATCH`  | `/api/visualizaciones/:id`             | Dueño       | `200` | Edita una visualización propia.                  |
| `DELETE` | `/api/visualizaciones/:id`             | Dueño       | `204` | Elimina una visualización propia.                |
| `GET`    | `/api/visualizaciones/mia/:peliculaId` | Dueño       | `200` | Visualización más reciente por película.         |
| `GET`    | `/api/watchlist`                       | Autenticado | `200` | Watchlist privada del usuario autenticado.       |
| `POST`   | `/api/watchlist`                       | Autenticado | `201` | Agrega una película a la watchlist.              |
| `GET`    | `/api/watchlist/:peliculaId`           | Autenticado | `200` | Indica si la película está en la watchlist.      |
| `DELETE` | `/api/watchlist/:peliculaId`           | Autenticado | `204` | Quita una película de la watchlist.              |
| `GET`    | `/api/estadisticas/me`                 | Autenticado | `200` | Estadísticas del usuario autenticado.            |
| `GET`    | `/api/admin/usuarios`                  | Admin       | `200` | Lista las cuentas registradas.                   |
| `DELETE` | `/api/admin/usuarios/:id`              | Admin       | `204` | Elimina una cuenta y su contenido asociado.      |
| `DELETE` | `/api/admin/resenas/:id`               | Admin       | `204` | Elimina cualquier reseña.                        |

## Errores

Los errores usan `application/problem+json` según RFC 9457. La respuesta incluye `type`, `title`, `status`, `detail`, `instance` y `requestId`; `errores` aparece cuando hay validaciones por campo. Todas las respuestas incluyen `X-Request-Id`.

## Documentación

- [Índice de documentación, diagramas y boceto](docs/README.md).
- [Guía de uso](docs/guia-uso.md).
- [Contrato de API](docs/contrato_api.md).
- [Casos de prueba manuales](requests.http).
- [Personas usuarias y escenarios](docs/usuarios.md).
- [Patrón elegido](docs/patron_elegido.md).
- [ADR-001: sesiones en memoria](docs/adr-001-sesiones-en-memoria.md).
- [ADR-002: cache de TMDB](docs/adr-002-cache-tmdb.md).
- [Declaración de uso de IA](docs/declaracion-ia.md).
- [Lecciones aprendidas](docs/lecciones-aprendidas.md).
- [Acuerdos de trabajo y Definition of Done](CONTRIBUTING.md).
- [Matriz de riesgos](docs/riesgos.md).

## Uso de herramientas de IA

| Fecha    | Herramienta   | Aplicación                                                                              |
| -------- | ------------- | --------------------------------------------------------------------------------------- |
| Semana 1 | ChatGPT       | Redacción y organización de la documentación.                                           |
| Semana 2 | Claude Sonnet | Estilizado de páginas.                                                                  |
| Semana 4 | NotebookLM    | Aportes teóricos, ejemplificación y testing.                                            |
| Semana 5 | OpenCode      | Implementación del catálogo con TMDB y testing. Revisión de documentación. Comentarios. |
| Semana 6 | Claude Sonnet | Creación de usuarios de prueba.                                                         |

El detalle de los criterios y las verificaciones está en la [declaración de uso de IA](docs/declaracion-ia.md).
