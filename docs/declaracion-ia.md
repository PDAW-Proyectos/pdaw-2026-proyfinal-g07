# Declaración de uso de herramientas de IA

Este documento acompaña el registro del [README](../README.md) y cuenta qué herramientas de IA usamos, para qué las usamos y cómo comprobamos que lo que devolvieron servía. La responsabilidad por el código, los datos y las decisiones que entregamos es del equipo, no de las herramientas.

## Registro de uso

| Fecha    | Herramienta   | Aplicación                                                                              |
| -------- | ------------- | --------------------------------------------------------------------------------------- |
| Semana 1 | ChatGPT       | Redacción y organización de la documentación.                                           |
| Semana 2 | Claude Sonnet | Estilizado de páginas.                                                                  |
| Semana 4 | NotebookLM    | Aportes teóricos, ejemplificación y testing.                                            |
| Semana 5 | OpenCode      | Implementación del catálogo con TMDB y testing. Revisión de documentación. Comentarios. |
| Semana 6 | Claude Sonnet | Creación de usuarios de prueba.                                                         |

La tabla replica el registro del README. Las verificaciones aplicadas a cada uso fueron: relectura y edición del equipo en la documentación; revisión visual y `npm run format:check` en el estilizado; contraste con el material de la materia y ejecución en Jest para los aportes teóricos y los casos de prueba; `npm run format:check`, `npm run lint`, `npm test`, E2E opcional y revisión en el pull request para el catálogo; y `npm run seed:demo` con inicio de sesión y verificación de afinidades para los usuarios de prueba.

## Cómo la usamos

La IA fue un apoyo para redactar, proponer código, explicar errores y generar casos de prueba. No fue una fuente de verdad ni un reemplazo de la lectura del código.

- Cada sugerencia se contrastó con el contrato de API, con el código que ya existía y con la suite de pruebas.
- Ningún cambio se aceptó sin leerlo: revisamos nombres, capas, validaciones, permisos y mensajes de error.
- Una regla de negocio propuesta en el controlador se movía al servicio; una validación sola en el navegador se repetía en el servidor.
- Los secretos y credenciales nunca salieron del `.env`: no se pegaron claves en los prompts ni se versionaron.
- Las pruebas nuevas se escribieron pensando en el caso límite, no solo en el camino feliz: puntuación 0, 1, 5 y 6; fechas futuras; comentarios de 5000 y 5001 caracteres.

## Qué no delegamos

Las decisiones de arquitectura y de producto las tomó el equipo: sesiones con cookie en lugar de JWT, persistencia en JSON, caché de TMDB, puntuación opcional compartida entre reseña y visualización, mínimo de tres películas para calcular afinidad y recomendaciones con semilla de actividad. Esas decisiones están en los ADR, en el contrato y en las lecciones aprendidas, no en una conversación con la IA.

Tampoco delegamos la verificación. Que una prueba pase no significa que pruebe lo correcto, así que revisamos qué caso cubre y probamos los flujos a mano en el navegador, incluida la demo con `usuario` y `admin_demo`.

## Dónde puede fallar

La IA puede proponer APIs desactualizadas, código que funciona para el caso feliz pero no para los bordes, o pruebas que pasan sin cubrir el comportamiento esperado. También suele proponer soluciones que no abarcan todo el alcance del proyecto o que usan tecnologías y métodos que exceden lo visto en la cursada. Por eso la fuente de verdad es el contrato de API, el código revisado y la suite: cuando hay duda, gana la prueba que reproduce el problema. Si una sugerencia no se podía explicar en la defensa, no entraba al proyecto.

## Documentos de apoyo

En la defensa cada integrante tiene que poder explicar el código y las decisiones sin la herramienta. Los documentos de apoyo son:

- [Contrato de API](contrato_api.md)
- [ADR-001: sesiones en memoria](adr-001-sesiones-en-memoria.md)
- [ADR-002: caché de TMDB](adr-002-cache-tmdb.md)
- [Lecciones aprendidas](lecciones-aprendidas.md)
