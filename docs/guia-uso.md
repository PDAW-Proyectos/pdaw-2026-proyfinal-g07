# Guía de uso de Fotograma

Esta guía resume el recorrido principal de la aplicación y sirve como apoyo para la demo de la defensa. El contrato detallado de la API está en [contrato_api.md](contrato_api.md).

## Requisitos

- Node.js 22.13 o superior.
- `SESSION_SECRET` definido en `.env`.
- `TMDB_API_KEY` para búsquedas, tendencias, catálogo y tráiler.

```bash
npm install
npm start
```

La aplicación queda disponible en `http://localhost:3000`. Si no hay `TMDB_API_KEY`, las rutas de TMDB responden `502` con `TMDB_NO_DISPONIBLE`; el resto del sistema sigue funcionando con los datos locales.

## Demo en línea

El servicio está publicado en <https://fotograma-satw.onrender.com>. Usa el plan free de Render: se duerme tras unos 15 minutos sin uso, la primera visita puede tardar cerca de un minuto y los datos se pierden en cada reinicio o deploy. Las cuentas de la demo local no existen allí: hay que registrar una cuenta nueva o usar la cuenta administradora si se configuraron `ADMIN_EMAIL` y `ADMIN_PASSWORD` en el dashboard.

## Demo local reproducible

Para la defensa conviene usar un archivo separado de datos, `data/demo.json`, y dejar `data/fotograma.json` intacto:

```bash
npm run seed:demo
npm run demo
```

- `seed:demo` requiere `TMDB_API_KEY`, trae el catálogo actual de TMDB y **reemplaza** `data/demo.json`.
- Crea 20 películas, cuatro usuarios con reseñas/visualizaciones/favoritas cruzadas y una cuenta administradora.
- `demo` inicia el servidor con `DATA_FILE=data/demo.json` sin modificar `.env`.
- El catálogo y las tendencias del inicio se consultan en vivo a TMDB: mantener conexión durante la demo.
- Detener el servidor antes de volver a ejecutar `seed:demo`.

| Cuenta | Email | Contraseña |
| --- | --- | --- |
| Lucía | `lucia@fotograma.demo` | `Demo1234!` |
| Mateo | `mateo@fotograma.demo` | `Demo1234!` |
| Sofía | `sofia@fotograma.demo` | `Demo1234!` |
| Usuario demo | `usuario@fotograma.demo` | `contrasena` |
| Administrador | `admin@fotograma.demo` | `Demo1234!` |

También se puede iniciar sesión con los nombres de usuario `lucia`, `mateo`, `sofia`, `usuario` o `admin_demo`. La cuenta `usuario` comparte puntuaciones y favoritas con Lucía, así que su perfil muestra una afinidad alta con ella. Estas cuentas son solo para la demo local: no usar la contraseña ni el archivo demo en Render.

## Roles

| Rol | Puede hacer |
| --- | --- |
| Visitante | Buscar películas, ver fichas, leer reseñas, consultar perfiles públicos y crear una cuenta. |
| Usuario autenticado | Registrar visualizaciones, puntuar, publicar reseñas, usar la watchlist, elegir favoritas y ver sus estadísticas. |
| Administrador | Todo lo anterior y, además, listar/eliminar cuentas y moderar reseñas desde `admin.html`. |

## Registro e inicio de sesión

1. Usar el botón de acceso de la barra superior.
2. Completar el registro con nombre, nombre de usuario, email y contraseña.
3. Para iniciar sesión se puede usar el email o el nombre de usuario.
4. La sesión dura 7 días y se pierde si el servidor se reinicia.

Si se superan 5 intentos fallidos de login o registro para la misma IP y cuenta/identificador en 15 minutos, la API responde `429` con `Retry-After`. Hay que esperar a que termine la ventana o reiniciar el servidor en desarrollo.

## Buscar y explorar películas

- El buscador de la barra superior consulta TMDB por título y muestra los resultados en la grilla principal.
- En la página de inicio, el carrusel muestra las tendencias semanales de TMDB.
- La grilla sin búsqueda muestra el catálogo popular: películas con al menos 100 votos, ordenadas por cantidad de votos. No son necesariamente las mejor valoradas por promedio.
- Los filtros de género, puntuación y año, y el orden, se aplican en el navegador sobre las 20 películas de la página actual. Al cambiar de página se cargan otras 20.
- La opción “Más populares” mantiene el orden del catálogo; “Puntuación TMDB: mayor/menor” reordena solo la página visible.

## Ficha de película

La ficha muestra título, año, sinopsis, géneros, director, póster, puntuación de TMDB, promedio de puntuaciones de Fotograma, reseñas y tráiler oficial si existe.

Acciones disponibles:

- **Ver tráiler:** abre el video de YouTube en un modal.
- **Agregar a watchlist:** requiere sesión y no permite duplicados.
- **Registrar visualización:** pide la fecha; no se permiten fechas futuras. La puntuación es opcional.
- **Puntuar:** elegir de 1 a 5 estrellas. La nota se comparte con la reseña y cuenta en el promedio.
- **Escribir reseña:** comentario no vacío; la puntuación es opcional.

## Reseñas

- Un usuario puede tener una sola reseña por película.
- Solo el autor puede editar o eliminar su reseña.
- El administrador puede eliminar cualquier reseña desde el panel.
- Las reseñas públicas se pueden leer sin iniciar sesión.

## Historial, watchlist y favoritas

- **Películas vistas** (`vistas.html`): historial privado con filtros por género, puntuación y año.
- **Mi watchlist** (`watchlist.html`): películas pendientes, con opción de quitarlas.
- **Mi perfil** (`perfil.html`): estadísticas, reseñas, visualizaciones recientes y selección de hasta cinco favoritas.
- **Perfil público** (`usuario.html`): reseñas, favoritas y afinidad cinéfila agregada de otro usuario.

Las favoritas no se repiten y solo las puede modificar su dueño.

## Administración

1. Definir `ADMIN_EMAIL` y `ADMIN_PASSWORD` antes del primer arranque.
2. Iniciar sesión con esa cuenta.
3. Abrir `admin.html`.
4. Desde ahí se pueden eliminar cuentas y moderar reseñas.

Una cuenta común con el mismo email no se promueve automáticamente a administradora.

## Guion corto para la demo

1. Abrir la página de inicio y mostrar tendencias y catálogo.
2. Buscar una película y abrir su ficha.
3. Registrarse o iniciar sesión.
4. Registrar una visualización con fecha y puntuación.
5. Publicar una reseña y mostrarla en la ficha.
6. Agregar la película a la watchlist y elegir una favorita en el perfil.
7. Abrir el perfil público y mostrar la afinidad.
8. Entrar como administrador y mostrar la moderación.

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| Búsqueda o catálogo con `502` | Falta `TMDB_API_KEY` o TMDB no responde | Revisar la variable de entorno y la conectividad. |
| `429` al iniciar sesión | 5 fallos en 15 minutos para esa IP y cuenta/identificador | Esperar el tiempo indicado en `Retry-After` o reiniciar en desarrollo. |
| La sesión se cerró sola | El servidor se reinició | Volver a iniciar sesión. |
| Se perdieron datos en Render | El plan free no tiene disco persistente | Usar un plan pago con disco o aceptar la pérdida entre deploys. |
| El póster no carga | La imagen de TMDB no está disponible | La interfaz muestra el marcador de póster. |
