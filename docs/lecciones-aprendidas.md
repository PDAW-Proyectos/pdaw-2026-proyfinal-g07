# Lecciones aprendidas

Escrito con el proyecto ya cerrado, reflexiones una vez detenido el desarrollo.

## Qué funcionó

- **Contrato de API primero.** Acordar rutas, campos y errores antes de programar nos ahorró retrabajo entre frontend, backend y pruebas. Cuando aparecía una duda, el contrato ya tenía la respuesta.
- **Separación en capas.** Controllers, services, repositories e integraciones nos dejaron probar reglas de negocio sin levantar HTTP ni depender de TMDB. La regla vive en un solo lugar y se puede señalar en la defensa.
- **Adapter de TMDB con `fetchImpl` inyectable.** Toda la integración externa quedó en un archivo y las pruebas corren sin red ni API key. También nos ayudó a distinguir un error de TMDB de un error nuestro.
- **Repositorios detrás de `JsonStore`.** Con la misma interfaz usamos un archivo en desarrollo y un `MemoryStore` en pruebas. Si mañana cambia el motor, los servicios no se enteran.
- **Pruebas de integración con cookie real.** Registrar un usuario, tomar el `Set-Cookie` y reenviarlo como haría un navegador nos dio confianza sobre sesiones, permisos y códigos HTTP.
- **E2E opcional.** El flujo reseña → perfil se probó con Edge/Chrome headless sin sumar Playwright ni volver obligatoria la suite de CI.
- **Datos de demo reproducibles.** `npm run seed:demo` + `npm run demo` generan siempre el mismo escenario (20 películas, cuatro usuarios y un admin) y no tocan `data/fotograma.json`. El seed necesita TMDB, pero una vez generado el archivo la presentación funciona sin red ni datos cargados a mano.
- **Despliegue como código.** `render.yaml` dejó el servicio reproducible y con health check propio; el mismo archivo documenta el build, el arranque y las variables, así que no dependemos de recordar la configuración del dashboard.
- **Reglas de producto pensadas antes de codificar.** La puntuación opcional compartida entre reseña y visualización, el promedio por usuario y el mínimo de tres películas para la afinidad salieron de preguntarnos qué quería ver el usuario, no de lo que era más fácil de programar.

## Qué costó

- **Persistencia JSON.** Resolver escrituras concurrentes, rollback y escritura atómica llevó más cuidado que un `writeFile` directo, y el archivo completo se reescribe en cada mutación. Fue una restricción del alcance del curso, no una decisión entre motores.
- **Sesiones en memoria.** Son simples y alcanzan para una instancia, pero se pierden al reiniciar y en Render se cierran en cada deploy. Express además avisa que `MemoryStore` no es para producción a gran escala.
- **Caché en memoria.** Hay que explicar que es por proceso, que no se comparte entre instancias y que puede quedar desactualizada hasta que vence el TTL.
- **Render free.** Sin disco persistente, `data/fotograma.json` y las sesiones se pierden en cada reinicio. Nos obligó a separar la demo local del despliegue y a decirlo antes de que lo pregunte el tribunal.
- **Filtros del inicio.** Se aplican sobre la página actual de 20 películas, no sobre todo el catálogo.
- **Sincronizar la nota entre reseña y visualización.** Una misma puntuación vive en dos registros y hay que decidir cuál manda (la reseña). Si se toca un solo lado, el promedio y la ficha quedan inconsistentes. Nos obligó a centralizar la regla en `PuntuacionService`.
- **Documentación al final.** Los ADR y la guía de uso se completaron tarde. Rinden más cuando se escriben junto con la decisión, no cuando hay que reconstruir por qué se hizo.
- **El bug de los pósters del perfil.** La imagen se creaba con `loading="lazy"` y oculta con `d-none`; el navegador no descarga una imagen lazy que no está visible, así que el evento `load` nunca se disparaba y quedaba el placeholder. Lo encontramos mirando el DOM (`complete`, `naturalWidth`, `display`), no probando cambios al azar. La corrección fue forzar `loading = 'eager'` antes de asignar `src`.

## Qué haríamos distinto

- **Persistencia:** si el proyecto creciera o necesitara datos garantizados en producción, migraríamos a SQLite o a una base administrada manteniendo la interfaz de repositorios.
- **Sesiones:** con más de una instancia usaríamos Redis o un store respaldado por base de datos, sin cambiar los middlewares.
- **Despliegue:** definiríamos desde el inicio si hace falta persistencia real y, en ese caso, presupuestaríamos un plan con disco montado.
- **Seguridad HTTP:** sumaríamos CSP y HSTS, `integrity` en Bootstrap, `Cache-Control: no-store` para respuestas autenticadas y un límite de intentos global, no solo en el login.
- **Pruebas:** fijaríamos un umbral mínimo de cobertura y, por cada bug, dejaríamos una prueba que lo reproduzca antes de corregirlo, empezando por el de los pósters.
- **Documentación:** escribiríamos los ADR en el momento de cada decisión y mantendríamos actualizado el índice de `docs/`.
- **Demo:** la automatizaríamos desde el principio, como terminó siendo `seed:demo`, para no depender de datos cargados a mano.
- **Defensa:** prepararíamos antes el guion de la demo y ensayaríamos las preguntas de arquitectura, persistencia, sesiones, caché y seguridad.

## Evidencia para la defensa

- **199 pruebas** automatizadas en **19 suites** pasan con Jest 30.
- **0 errores** de ESLint; quedan **3 advertencias** de complejidad preexistentes (`montarRutas` en `app.js`, el constructor de `Pelicula` y una función de `PeliculaRepository`).
- `format:check`, `lint` y `test` corren en local y en la integración continua.
- La CI ejecuta `npm ci`, `npm run format:check`, `npm run lint` y `npm test -- --coverage` con Node 22 en cada push a `main` y en cada pull request.
- El E2E de reseña y perfil se ejecutó con Chrome/Edge headless y quedó documentado como opcional, fuera de la CI.
- `GET /api/salud` responde `200` en local y en <https://fotograma-satw.onrender.com/api/salud>; es el health check del Blueprint de Render (`render.yaml`). El servicio está desplegado en el plan free, con las limitaciones de datos y sesiones ya descritas.
- La demo local se regenera con `npm run seed:demo` + `npm run demo`: 20 películas, cuatro usuarios y un admin, con afinidad de 100 %, 75 % y 25 % entre `usuario` y Lucía, Mateo y Sofía.

## Conclusión

Dadas las limitaciones por la cantidad de integrantes, el proyecto priorizó un alcance acotado y verificable, con una arquitectura simple, una integración externa aislada y decisiones explícitas sobre sesiones, caché y puntuaciones.
Las limitaciones están documentadas y tienen una ruta de migración clara. Los ítems propuestos en el backlog quedaron completados, aunque hayan atravesado simplificaciones en el proceso de desarrollo adaptativo.
