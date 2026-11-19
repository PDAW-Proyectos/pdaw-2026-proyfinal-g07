# Declaración de uso de herramientas de IA

Este documento complementa el registro del [README](../README.md) y deja explícito qué herramientas de IA se usaron, para qué y cómo se verificó el resultado. La responsabilidad final del código y de las decisiones entregadas es del equipo.

## Registro de uso

| Momento | Herramienta | Aplicación | Verificación |
| --- | --- | --- | --- |
| Semana 1 | ChatGPT | Redacción y organización de la documentación inicial. | Revisión y edición del equipo. |
| Semana 5 | OpenCode | Implementación del catálogo con TMDB, pruebas y revisión de documentación y comentarios. | `npm run format:check`, `npm run lint`, `npm test` y revisión del equipo. |

## Criterios de uso

- La IA se usó como apoyo para redactar, proponer código, explicar errores y generar casos de prueba.
- Las sugerencias se contrastaron con el contrato de API, con el código existente y con pruebas automatizadas.
- No se aceptó código sin revisión: se verificaron nombres, capas, validaciones, permisos y mensajes de error.
- Las credenciales y secretos se manejan por variables de entorno; no se incluyen en el repositorio.
- Las decisiones de arquitectura y alcance quedan documentadas en los ADR y en el contrato, no solo en la conversación con la IA.

## Limitaciones

La IA puede proponer APIs desactualizadas, código que funciona para un caso pero no para los bordes, o pruebas que pasan sin cubrir el comportamiento esperado. Por eso el equipo no la usa como fuente de verdad: la fuente de verdad es el contrato de API, el código revisado y la suite de pruebas.

## Defensa

En la defensa, cada integrante debe poder explicar el código y las decisiones sin depender de la herramienta. Los documentos de apoyo son:

- [Contrato de API](contrato_api.md)
- [ADR-001: sesiones en memoria](adr-001-sesiones-en-memoria.md)
- [ADR-002: cache de TMDB](adr-002-cache-tmdb.md)
- [Lecciones aprendidas](lecciones-aprendidas.md)
