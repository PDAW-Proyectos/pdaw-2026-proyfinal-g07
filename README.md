# Fotograma

> Un diario de cine para registrar películas vistas, organizar el historial y compartir opiniones.

Proyecto del equipo **7** para **7513 · Proyecto de Desarrollo de Aplicaciones Web** — Tecnicatura Universitaria en Programación Web y Móvil, DCIC, UNS.

## Ficha del proyecto

| Aspecto | Descripción |
| --- | --- |
| Problema | Los aficionados al cine necesitan registrar las películas que ven, organizar su historial y compartir opiniones. |
| Usuarios | Personas interesadas en el cine que desean registrar visualizaciones, calificar películas y consultar reseñas. |
| Funcionalidades núcleo | **1.** Buscar películas y consultar su información. **2.** Registrar visualizaciones con fecha y puntuación opcional y consultar el historial personal. **3.** Publicar y consultar reseñas. |
| Reglas de negocio | **1.** Solo usuarios autenticados pueden registrar visualizaciones y publicar reseñas. **2.** Las puntuaciones son enteras de 1 a 5. **3.** Solo el autor puede modificar o eliminar su reseña. **4.** No se permiten fechas futuras. **5.** No se admiten reseñas vacías. **6.** El historial personal es privado. |
| API externa | **TMDB:** búsqueda y consulta de título, sinopsis, año de estreno, géneros y póster. [Documentación](https://developer.themoviedb.org/docs/getting-started). |

### Alcance inicial

Películas, cuentas de usuario, historial personal, puntuaciones y reseñas públicas. Las estadísticas básicas son deseables. Series, perfiles públicos completos, seguimiento, me gusta, watchlist y moderación quedan fuera de esta versión. El alcance se revisa en cada planificación.

## Equipo y roles

| Integrante | GitHub | Roles |
| --- | --- | --- |
| Juan Pablo Rapetti | JuanRapetti | Product Owner y desarrollador |
| Manuel Campagnoli | manucampagnoli | Scrum Master y desarrollador |



## Ejecución y pruebas

Requiere **Node.js 22.13 o superior**.

```bash
npm install
npm test
npm start
```

Servidor: **http://localhost:3000**. 

Tecnologías: JavaScript, Node.js, Express, Jest.


## Documentación

- [Diagramas y boceto](docs/README.md).
- [Personas usuarias y escenarios](docs/usuarios.md).
- [Patrón elegido](docs/patron_elegido.md).
- [Acuerdos de trabajo y Definition of Done](CONTRIBUTING.md).
- [Matriz de riesgos](docs/riesgos.md).

## Uso de herramientas de IA

| Fecha | Herramienta | Aplicación |
| --- | --- | --- |
| Semana 1 | ChatGPT | Redacción y organización de la documentación. |

