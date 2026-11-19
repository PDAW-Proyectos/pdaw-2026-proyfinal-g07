# Lecciones aprendidas

## Qué funcionó

- **Contrato de API primero:** definir rutas, campos y errores antes de programar redujo retrabajo entre frontend, backend y pruebas.
- **Separación en capas:** controllers, services, repositories e integrations permitieron probar reglas de negocio sin levantar HTTP ni depender de TMDB.
- **Adapter de TMDB:** concentrar la integración en un módulo y aceptar un `fetchImpl` inyectable hizo que las pruebas no necesitaran red ni API key.
- **Persistencia con interfaz de repositorios:** el `JsonStore` fue suficiente para el alcance y permitió usar un `MemoryStore` en pruebas.
- **Pruebas de integración con store en memoria:** dieron confianza sobre sesiones, permisos, validaciones y códigos HTTP sin depender de un archivo real.
- **E2E opcional:** el flujo reseña-perfil se pudo probar con un navegador headless sin sumar Playwright/Puppeteer ni volver obligatoria la suite de CI.
- **Constantes compartidas en el frontend:** centralizar límites como el largo del comentario y el máximo de favoritas evitó valores repetidos.

## Qué costó

- **Persistencia JSON:** resolver escrituras concurrentes, rollback y escritura atómica requirió más cuidado que un `writeFile` directo. Además, el archivo completo se reescribe en cada mutación. No fue una decisión entre motores: el alcance del curso no incluía bases de datos, así que se adoptó JSON como restricción y no como ADR.
- **Sesiones en memoria:** son simples, pero se pierden al reiniciar y no permiten escalar horizontalmente. Express además advierte que `MemoryStore` no es para producción a gran escala.
- **Cache en memoria:** hay que explicar que es por proceso, que no se comparte y que puede quedar desactualizada hasta el TTL.
- **Render free:** el despliegue sin disco persistente obliga a aceptar pérdida de datos y cierre de sesiones en cada reinicio o deploy.
- **Documentación al final:** los ADR y la guía de uso se completaron tarde; conviene escribirlos junto con la decisión.
- **Filtros del index:** los filtros se aplican solo sobre la página actual de 20 películas, no sobre todo el catálogo. Es una decisión de alcance que debe explicarse para no prometer un filtrado global.
- **Cambios a medio terminar:** dejar una opción nueva a medio implementar entre controller y service genera código muerto y dudas en la defensa. Hay que cerrar o revertir antes de la entrega.

## Qué haríamos distinto

- **Persistencia:** si el proyecto creciera o necesitara datos garantizados en producción, migraríamos a SQLite o a una base administrada manteniendo la interfaz de repositorios.
- **Sesiones:** con más de una instancia, usaríamos Redis o un store respaldado por base de datos.
- **Despliegue:** definiríamos desde el inicio si se necesita persistencia real y, en ese caso, presupuestaríamos un plan con disco.
- **Seguridad HTTP:** agregaríamos `Cache-Control: no-store` para respuestas autenticadas y evaluaríamos un token CSRF además de `sameSite=lax`.
- **Documentación:** escribiríamos los ADR en el momento de cada decisión y mantendríamos el índice de `docs/` actualizado.
- **Defensa:** prepararíamos antes el guion de demo y ensayaríamos las preguntas de arquitectura, persistencia, sesiones, cache y seguridad.

## Evidencia para la defensa

- **199 pruebas** automatizadas pasan con Jest.
- **0 errores** de ESLint; quedan 3 advertencias preexistentes de complejidad/tipo.
- `format:check` y `lint` forman parte de la verificación local y de CI.
- La integración continua ejecuta `npm ci`, formato, lint y pruebas con cobertura.
- El E2E de reseña y perfil se ejecutó con Chrome/Edge headless y quedó documentado como opcional.
- El health check `/api/salud` responde `200` en producción.

## Conclusión

El proyecto priorizó un alcance acotado y verificable: una arquitectura simple, una integración externa aislada y decisiones explícitas sobre sesiones y cache. La persistencia JSON quedó acotada por el alcance del curso. Las limitaciones conocidas no se ocultan: están documentadas y tienen una ruta de migración clara.
