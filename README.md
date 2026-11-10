# Fotograma

> Un diario de cine para registrar películas vistas, organizar el historial y compartir opiniones.

Proyecto del equipo **7** para **7513 · Proyecto de Desarrollo de Aplicaciones Web** — Tecnicatura Universitaria en Programación Web y Móvil, DCIC, UNS.

## Ficha del proyecto

| Aspecto                | Descripción                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Problema               | Los aficionados al cine necesitan registrar las películas que ven, organizar su historial y compartir opiniones.                                                                                                                                                                                                    |
| Usuarios               | Personas interesadas en el cine que desean registrar visualizaciones, calificar películas y consultar reseñas.                                                                                                                                                                                                      |
| Funcionalidades núcleo | **1.** Buscar películas y consultar su información. **2.** Registrar visualizaciones con fecha y puntuación opcional y consultar el historial personal. **3.** Publicar y consultar reseñas.                                                                                                                        |
| Reglas de negocio      | **1.** Solo usuarios autenticados pueden registrar visualizaciones y publicar reseñas. **2.** Las puntuaciones son enteras de 1 a 5. **3.** Solo el autor puede modificar o eliminar su reseña. **4.** No se permiten fechas futuras. **5.** No se admiten reseñas vacías. **6.** El historial personal es privado. |
| API externa            | **TMDB:** búsqueda y consulta de título, sinopsis, año de estreno, géneros y póster. [Documentación](https://developer.themoviedb.org/docs/getting-started).                                                                                                                                                        |

### Alcance inicial

Películas, cuentas de usuario, historial personal, puntuaciones y reseñas públicas. Las estadísticas básicas son deseables. Series, perfiles públicos completos, seguimiento, me gusta, watchlist y moderación quedan fuera de esta versión. El alcance se revisa en cada planificación.

## Equipo y roles

| Integrante         | GitHub         | Roles                         |
| ------------------ | -------------- | ----------------------------- |
| Juan Pablo Rapetti | JuanRapetti    | Product Owner y desarrollador |
| Manuel Campagnoli  | manucampagnoli | Scrum Master y desarrollador  |

## Ejecución y pruebas

Requiere **Node.js 22.13 o superior**.

```bash
npm install
npm run format:check
npm run lint
npm test
npm start
```

Servidor: **http://localhost:3000**.

La integración continua ejecuta `npm ci`, `npm run format:check`, `npm run lint` y `npm test -- --coverage` en cada push a `main` y en cada pull request.

Tecnologías: JavaScript, Node.js, Express, Jest, ESLint, Prettier y GitHub Actions.

## Endpoints de la API

Todas las rutas usan el prefijo `/api`. El detalle de campos, validaciones y errores está en el [contrato de API](docs/contrato_api.md). Los casos de éxito y error para probar manualmente están en [requests.http](requests.http).

| Método   | Ruta                                 | Acceso      | Éxito | Descripción                                      |
| -------- | ------------------------------------ | ----------- | ----- | ------------------------------------------------ |
| `GET`    | `/api/salud`                         | Público     | `200` | Estado del servicio.                             |
| `GET`    | `/api/auth/sesion`                   | Público     | `200` | Devuelve si hay sesión y el usuario público.     |
| `POST`   | `/api/auth/registro`                 | Público     | `201` | Crea la cuenta e inicia sesión.                  |
| `POST`   | `/api/auth/login`                    | Público     | `200` | Inicia sesión con email o nombre de usuario.     |
| `POST`   | `/api/auth/logout`                   | Público     | `204` | Cierra la sesión y borra la cookie.              |
| `GET`    | `/api/peliculas/buscar?q=`           | Público     | `200` | Busca películas en TMDB y guarda la copia local. |
| `GET`    | `/api/peliculas/tendencias`          | Público     | `200` | Lista las tendencias de TMDB.                    |
| `GET`    | `/api/peliculas/:peliculaId`         | Público     | `200` | Detalle de una película del catálogo local.      |
| `GET`    | `/api/peliculas/:peliculaId/resenas` | Público     | `200` | Reseñas públicas de una película.                |
| `GET`    | `/api/resenas/recientes`             | Público     | `200` | Últimas reseñas publicadas.                      |
| `GET`    | `/api/resenas/:id`                   | Público     | `200` | Detalle de una reseña.                           |
| `GET`    | `/api/resenas/mias`                  | Autenticado | `200` | Reseñas del usuario autenticado.                 |
| `POST`   | `/api/resenas`                       | Autenticado | `201` | Publica una reseña.                              |
| `PATCH`  | `/api/resenas/:id`                   | Autor       | `200` | Edita una reseña propia.                         |
| `DELETE` | `/api/resenas/:id`                   | Autor       | `204` | Elimina una reseña propia.                       |
| `GET`    | `/api/visualizaciones`               | Dueño       | `200` | Historial privado del usuario autenticado.       |
| `POST`   | `/api/visualizaciones`               | Autenticado | `201` | Registra una visualización.                      |
| `GET`    | `/api/visualizaciones/:id`           | Dueño       | `200` | Detalle de una visualización propia.             |
| `PATCH`  | `/api/visualizaciones/:id`           | Dueño       | `200` | Edita una visualización propia.                  |
| `DELETE` | `/api/visualizaciones/:id`           | Dueño       | `204` | Elimina una visualización propia.                |
| `GET`    | `/api/estadisticas/me`               | Autenticado | `200` | Estadísticas del usuario autenticado.            |

## Errores

Los errores usan `application/problem+json` según RFC 9457. La respuesta incluye `type`, `title`, `status`, `detail`, `instance` y `requestId`; `errores` aparece cuando hay validaciones por campo. Todas las respuestas incluyen `X-Request-Id`.

## Documentación

- [Diagramas y boceto](docs/README.md).
- [Contrato de API](docs/contrato_api.md).
- [Casos de prueba manuales](requests.http).
- [Personas usuarias y escenarios](docs/usuarios.md).
- [Patrón elegido](docs/patron_elegido.md).
- [Acuerdos de trabajo y Definition of Done](CONTRIBUTING.md).
- [Matriz de riesgos](docs/riesgos.md).

## Uso de herramientas de IA

| Fecha    | Herramienta | Aplicación                                    |
| -------- | ----------- | --------------------------------------------- |
| Semana 1 | ChatGPT     | Redacción y organización de la documentación. |
