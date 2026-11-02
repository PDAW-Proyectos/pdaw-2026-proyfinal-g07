# Contrato de API de Fotograma

Versión inicial acordada para el backend. Este documento es la fuente de verdad para frontend, backend y pruebas. Cualquier cambio de ruta, campo o código de error debe actualizarse acá y avisarse al equipo.

## Convenciones generales

- Todas las rutas empiezan con `/api`.
- El cuerpo de las peticiones y las respuestas usa JSON (`application/json`).
- El frontend se sirve desde el mismo origen que la API; no se necesita CORS.
- La sesión viaja en una cookie `HttpOnly` llamada `fg_sesion`. El frontend no manipula el token.
- Los identificadores internos son UUID en texto. `tmdbId` es el identificador externo de TMDB.
- Las fechas de visualización usan `YYYY-MM-DD`. Las marcas de tiempo usan ISO 8601 en UTC.
- Los errores siempre tienen el mismo formato.
- Las respuestas `201` incluyen `Location` con la ruta del recurso creado.
- El servidor acepta solo los campos previstos; los campos desconocidos se rechazan con `SOLICITUD_INVALIDA`.
- Los cambios incompatibles se publican en una nueva versión (`/api/v2`), sin romper `/api`.
- Los campos de fecha, puntuación y texto se validan también en el servidor; la validación del cliente es solo una ayuda.

### Respuesta de colección

```json
{
  "data": [],
  "page": 1,
  "limit": 20,
  "total": 0
}
```

Parámetros de paginación:

- `page`: entero desde 1. Por defecto `1`.
- `limit`: entero entre 1 y 50. Por defecto `20`.

### Respuesta de error

```json
{
  "error": "Datos inválidos",
  "errores": [
    {
      "campo": "fecha",
      "mensaje": "La fecha no puede ser posterior a hoy."
    }
  ]
}
```

`error` es el mensaje general para el usuario. `errores` detalla los campos inválidos y puede omitirse cuando el error no está asociado a un campo. El cliente usa el estado HTTP y `errores`; no depende de códigos internos. No se expone el stack ni información interna del servidor.

### Códigos internos de error

La tabla se usa para pruebas, logs y documentación. La respuesta HTTP solo incluye `error` y, cuando corresponde, `errores`.

| Código | HTTP | Uso |
| --- | --- | --- |
| `SOLICITUD_INVALIDA` | 400 | JSON mal formado, parámetros o campos desconocidos, o cuerpo vacío donde se esperaba al menos un campo. |
| `VALIDACION_FALLIDA` | 400 | Uno o más campos no cumplen el formato; `errores` los enumera. |
| `TIPO_INVALIDO` | 400 | Un campo tiene un tipo incorrecto. |
| `FORMATO_INVALIDO` | 400 | Email, fecha o nombre de usuario con formato inválido. |
| `LONGITUD_INVALIDA` | 400 | Texto demasiado corto o largo. |
| `VALOR_FUERA_DE_RANGO` | 400 | Número fuera del rango permitido. |
| `FECHA_FUTURA` | 400 | La fecha de visualización es posterior a hoy. |
| `PUNTUACION_INVALIDA` | 400 | La puntuación no es un entero entre 1 y 5 ni `null`. |
| `CREDENCIALES_INVALIDAS` | 401 | Email/Usuario o contraseña incorrectos. El mensaje no distingue cuál falló. |
| `SESION_REQUERIDA` | 401 | La ruta requiere sesión y no hay cookie válida. |
| `SESION_EXPIRADA` | 401 | La sesión existió pero venció. |
| `NO_AUTORIZADO` | 403 | El usuario autenticado no es dueño del recurso. |
| `NO_ENCONTRADO` | 404 | El recurso no existe o no pertenece al usuario. |
| `PELICULA_NO_ENCONTRADA` | 404 | No existe una película local con ese `peliculaId`. |
| `EMAIL_DUPLICADO` | 409 | Ya hay una cuenta con ese email. |
| `NOMBRE_USUARIO_DUPLICADO` | 409 | Ya hay una cuenta con ese nombre de usuario. |
| `RESENA_DUPLICADA` | 409 | El usuario ya escribió una reseña para esa película. |
| `ID_DUPLICADO` | 409 | Colisión interna de identificadores al guardar una película. |
| `CONTENIDO_NO_SOPORTADO` | 415 | El cuerpo no usa `application/json` cuando el endpoint espera JSON. |
| `DEMASIADOS_INTENTOS` | 429 | Se superó el límite de intentos de login o registro. |
| `ERROR_INTERNO` | 500 | Error no controlado. |
| `TMDB_NO_DISPONIBLE` | 502 | TMDB no respondió y no hay datos locales para resolver la operación. |

### Versionado

La versión actual es `/api`. Si un cambio rompe el contrato (renombrar o quitar campos, cambiar códigos), se publica una nueva versión bajo `/api/v2` y se mantiene `/api` mientras haya clientes que la usen.

## Datos públicos

### Usuario público

```json
{
  "id": "3f1c2a6e-7d4b-4a1e-9c5f-2b8d6e0a1c33",
  "nombre": "Lucía Gómez",
  "nombreUsuario": "lucia"
}
```

Nunca se devuelven `email` ni `hashContrasena`.

### Película resumida

```json
{
  "id": "8c2d4f1a-5e6b-4c7d-8a9e-0f1b2c3d4e5f",
  "tmdbId": 603,
  "titulo": "Matrix",
  "anioEstreno": 1999,
  "rutaPoster": "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg"
}
```

### Película detallada

```json
{
  "id": "8c2d4f1a-5e6b-4c7d-8a9e-0f1b2c3d4e5f",
  "tmdbId": 603,
  "titulo": "Matrix",
  "sinopsis": "Un programador descubre que el mundo que conoce es una simulación.",
  "anioEstreno": 1999,
  "generos": ["Acción", "Ciencia ficción"],
  "rutaPoster": "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg"
}
```

### Visualización

```json
{
  "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "fecha": "2026-10-30",
  "puntuacion": 4,
  "pelicula": {
    "id": "8c2d4f1a-5e6b-4c7d-8a9e-0f1b2c3d4e5f",
    "tmdbId": 603,
    "titulo": "Matrix",
    "anioEstreno": 1999,
    "rutaPoster": "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg"
  }
}
```

### Reseña

```json
{
  "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
  "comentario": "Una película que invita a pensar.",
  "fechaPublicacion": "2026-10-30T12:00:00.000Z",
  "autor": {
    "id": "3f1c2a6e-7d4b-4a1e-9c5f-2b8d6e0a1c33",
    "nombre": "Lucía Gómez",
    "nombreUsuario": "lucia"
  },
  "pelicula": {
    "id": "8c2d4f1a-5e6b-4c7d-8a9e-0f1b2c3d4e5f",
    "tmdbId": 603,
    "titulo": "Matrix",
    "anioEstreno": 1999,
    "rutaPoster": "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg"
  }
}
```

## Autenticación y sesión

La sesión se guarda en memoria del servidor y se identifica con una cookie:

```text
fg_sesion=<token>
HttpOnly; SameSite=Lax; Path=/; Max-Age=604800
```

En producción se agrega `Secure`. La sesión dura 7 días. Al reiniciar el servidor se pierden las sesiones, pero los datos persistidos se conservan.

### `POST /api/auth/registro`

Crea la cuenta e inicia sesión automáticamente.

Request:

```json
{
  "nombre": "Lucía Gómez",
  "nombreUsuario": "lucia",
  "email": "lucia@example.com",
  "contrasena": "secreto123"
}
```

Validaciones:

- `nombre`: 1 a 80 caracteres.
- `nombreUsuario`: 3 a 30 caracteres; letras, números, punto, guion y guion bajo.
- `email`: formato válido, máximo 254 caracteres; único sin distinguir mayúsculas.
- `contrasena`: 8 a 100 caracteres.

Response `201` con `Location: /api/auth/sesion`:

```json
{
  "usuario": {
    "id": "3f1c2a6e-7d4b-4a1e-9c5f-2b8d6e0a1c33",
    "nombre": "Lucía Gómez",
    "nombreUsuario": "lucia"
  }
}
```

Errores: `VALIDACION_FALLIDA`, `EMAIL_DUPLICADO`, `NOMBRE_USUARIO_DUPLICADO`, `DEMASIADOS_INTENTOS`.

### `POST /api/auth/login`

Request:

```json
{
  "identificador": "lucia@example.com",
  "contrasena": "secreto123"
}
```

`identificador` acepta el email o el nombre de usuario. La comparación no distingue mayúsculas.

Response `200`:

```json
{
  "usuario": {
    "id": "3f1c2a6e-7d4b-4a1e-9c5f-2b8d6e0a1c33",
    "nombre": "Lucía Gómez",
    "nombreUsuario": "lucia"
  }
}
```

Errores: `CREDENCIALES_INVALIDAS`, `DEMASIADOS_INTENTOS`.

### `POST /api/auth/logout`

Response `204`. Borra la cookie y la sesión.

### `GET /api/auth/sesion`

Response `200` siempre que la petición sea válida:

```json
{
  "autenticado": true,
  "usuario": {
    "id": "3f1c2a6e-7d4b-4a1e-9c5f-2b8d6e0a1c33",
    "nombre": "Lucía Gómez",
    "nombreUsuario": "lucia"
  }
}
```

Sin sesión:

```json
{
  "autenticado": false,
  "usuario": null
}
```

### Reglas de seguridad

- La contraseña se hashea con `scrypt` y nunca se devuelve.
- El login responde siempre `CREDENCIALES_INVALIDAS`, sin indicar si falló el usuario o la contraseña.
- El servidor toma el usuario de la sesión; nunca acepta `usuarioId` desde el cuerpo.
- Límite orientativo: 5 intentos fallidos por IP e identificador cada 15 minutos.

## Películas e integración TMDB

Las búsquedas y tendencias pasan por el Adapter de TMDB y guardan una copia normalizada en el catálogo local. El resto de la API usa siempre el `peliculaId` interno.

### `GET /api/peliculas/buscar`

Parámetros:

- `q`: texto de 1 a 100 caracteres. Obligatorio.
- `page`: entero desde 1. Opcional.

Response `200`: colección de `PeliculaResumen`.

Errores: `VALIDACION_FALLIDA`, `TMDB_NO_DISPONIBLE`.

### `GET /api/peliculas/tendencias`

Parámetros: `page` opcional.

Response `200`: colección de `PeliculaResumen`.

Errores: `TMDB_NO_DISPONIBLE`.

### `GET /api/peliculas/:peliculaId`

Devuelve `PeliculaDetalle` desde el catálogo local.

Errores: `PELICULA_NO_ENCONTRADA`.

### `GET /api/peliculas/:peliculaId/resenas`

Devuelve las reseñas públicas de una película. Acepta `page` y `limit`.

Response `200`: colección de `Reseña`.

Errores: `PELICULA_NO_ENCONTRADA`.

## Visualizaciones

Todas las rutas requieren sesión. El historial es privado: un usuario nunca puede ver ni modificar el de otro. Se permiten varias visualizaciones de la misma película para registrar revisionados.

### `GET /api/visualizaciones`

Devuelve el historial del usuario autenticado.

Parámetros:

- `page`, `limit`.
- `orden`: `fecha_desc` (por defecto), `fecha_asc` o `puntuacion_desc`.

Response `200`: colección de `Visualización`.

Errores: `SESION_REQUERIDA`, `SESION_EXPIRADA`, `VALIDACION_FALLIDA`.

### `POST /api/visualizaciones`

Request:

```json
{
  "peliculaId": "8c2d4f1a-5e6b-4c7d-8a9e-0f1b2c3d4e5f",
  "fecha": "2026-10-30",
  "puntuacion": 4
}
```

`puntuacion` es opcional; se puede omitir o enviar `null`. `fecha` no puede ser futura.

Response `201` con `Location: /api/visualizaciones/:id`: `Visualización`.

Errores: `SESION_REQUERIDA`, `PELICULA_NO_ENCONTRADA`, `FECHA_FUTURA`, `PUNTUACION_INVALIDA`, `CONTENIDO_NO_SOPORTADO`.

### `GET /api/visualizaciones/:id`

Response `200`: `Visualización`.

Si el registro no existe o pertenece a otro usuario: `404 NO_ENCONTRADO`.

### `PATCH /api/visualizaciones/:id`

Request con al menos uno de estos campos:

```json
{
  "fecha": "2026-10-29",
  "puntuacion": null
}
```

Response `200`: `Visualización` actualizada.

Errores: `SESION_REQUERIDA`, `NO_ENCONTRADO`, `FECHA_FUTURA`, `PUNTUACION_INVALIDA`, `SOLICITUD_INVALIDA`.

### `DELETE /api/visualizaciones/:id`

Response `204`.

Errores: `SESION_REQUERIDA`, `NO_ENCONTRADO`.

## Reseñas

Las reseñas son públicas y son independientes de las visualizaciones. Un usuario puede tener como máximo una reseña por película; para cambiarla debe usar `PATCH`. El autor es el único que puede editarla o eliminarla.

### `GET /api/resenas/recientes`

Público. Devuelve las últimas reseñas publicadas.

Parámetros: `page`, `limit`.

Response `200`: colección de `Reseña`.

### `GET /api/resenas/mias`

Requiere sesión. Devuelve las reseñas del usuario autenticado.

Parámetros: `page`, `limit`.

Response `200`: colección de `Reseña`.

### `GET /api/resenas/:id`

Público. Devuelve una reseña.

Response `200`: `Reseña`.

Errores: `NO_ENCONTRADO`.

### `POST /api/resenas`

Requiere sesión.

Request:

```json
{
  "peliculaId": "8c2d4f1a-5e6b-4c7d-8a9e-0f1b2c3d4e5f",
  "comentario": "Una película que invita a pensar."
}
```

Validaciones:

- `comentario`: 1 a 5000 caracteres después de recortar espacios. No se admiten textos vacíos.
- Una sola reseña por usuario y película.

Response `201` con `Location: /api/resenas/:id`: `Reseña`.

Errores: `SESION_REQUERIDA`, `PELICULA_NO_ENCONTRADA`, `VALIDACION_FALLIDA`, `RESENA_DUPLICADA`, `CONTENIDO_NO_SOPORTADO`.

### `PATCH /api/resenas/:id`

Requiere sesión y autoría.

Request:

```json
{
  "comentario": "Cambio de opinión después de un segundo visionado."
}
```

Response `200`: `Reseña`.

Errores: `SESION_REQUERIDA`, `NO_ENCONTRADO`, `NO_AUTORIZADO`, `VALIDACION_FALLIDA`.

### `DELETE /api/resenas/:id`

Requiere sesión y autoría.

Response `204`.

Errores: `SESION_REQUERIDA`, `NO_ENCONTRADO`, `NO_AUTORIZADO`.

## Estadísticas

### `GET /api/estadisticas/me`

Requiere sesión. Devuelve estadísticas básicas del usuario autenticado.

Response `200`:

```json
{
  "totalVisualizaciones": 12,
  "peliculasUnicas": 10,
  "promedioPuntuacion": 4.2,
  "totalResenas": 3,
  "distribucionPuntuacion": {
    "1": 0,
    "2": 1,
    "3": 2,
    "4": 5,
    "5": 3
  }
}
```

`promedioPuntuacion` es `null` si no hay visualizaciones puntuadas.

Errores: `SESION_REQUERIDA`.

## Salud del servicio

### `GET /api/salud`

Público.

Response `200`:

```json
{
  "estado": "ok"
}
```

## Matriz de permisos

| Recurso | Público | Autenticado | Autor/Dueño |
| --- | --- | --- | --- |
| Buscar y ver películas | Sí | Sí | — |
| Ver reseñas y últimas reseñas | Sí | Sí | — |
| Registrarse e iniciar sesión | Sí | — | — |
| Ver sesión actual | Sí | Sí | — |
| Crear visualización | No | Sí | — |
| Ver, editar o borrar historial | No | No | Sí |
| Crear reseña | No | Sí | — |
| Editar o borrar reseña | No | No | Sí |
| Ver estadísticas propias | No | No | Sí |

## Flujo esperado del frontend

1. Al cargar la aplicación, llamar a `GET /api/auth/sesion`.
2. Usar `fetch` con `credentials: "same-origin"` y `Content-Type: application/json`.
3. Si una acción protegida devuelve `401`, pedir login y retomar la acción después de autenticarse.
4. No enviar `usuarioId`; el servidor lo obtiene de la sesión.
5. Para reseñar o registrar una visualización, primero buscar la película y usar el `id` interno devuelto.

## Fuera de esta versión

No forman parte del contrato inicial:

- Recomendadas personalizadas.
- Watchlist, seguimiento entre usuarios, me gusta y comentarios sobre reseñas.
- Perfiles públicos completos.
- Series, temporadas y episodios.
- Moderación y reportes.
- Recuperación de contraseña.
- Roles administrativos.

Estas funciones requieren nuevas rutas y deben agregarse al contrato antes de implementarse.

## Notas de implementación

- En las rutas de reseñas, declarar `/recientes` y `/mias` antes de `/:id`.
- Centralizar la traducción de errores de dominio a HTTP en un `errorHandler`.
- `PeliculaRepository` debe ofrecer búsqueda por `id` y por `tmdbId`, y guardar o actualizar películas normalizadas.
- El Adapter de TMDB nunca debe exponer su estructura interna: transforma a `Pelicula` y normaliza errores.
- La API key de TMDB se lee del entorno en el servidor y nunca se envía al cliente.
- Los tests de integración deben usar un store en memoria y un cliente HTTP contra una instancia de prueba.
