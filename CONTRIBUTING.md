# Acuerdos de trabajo y convenciones

## Acuerdos del equipo

- **Comunicación:** canal WhatsApp/Discord; respuesta dentro de 12 horas en días hábiles.
- **Disponibilidad:** fuera del horario de clase trabajamos en horario rotativo.
- **Decisiones técnicas:** por consenso; si no hay acuerdo en 10 minutos, elegimos la alternativa más simple que cumpla los requisitos y registramos el motivo. El Product Owner resuelve prioridades de alcance.
- **Bloqueos:** quien esté bloqueado más de 30 minutos lo comunica al otro integrante.
- **Ausencias:** se avisan con anticipación y se reasignan las issues en curso.
- **Desacuerdos:** se tratan en la retrospectiva, sobre hechos y no sobre personas.

## Flujo de trabajo (GitHub Flow)

1. Nadie trabaja directamente sobre `main`.
2. Cada issue se resuelve en una rama `tipo/número-descripción-breve`. Tipos: `feature`, `fix`, `refactor`, `test`, `docs`, `chore`. Ejemplo: `feature/12-registrar-visualizacion`.
3. Los commits siguen `tipo(alcance): resumen`. Ejemplo: `feat(visualizaciones): rechazar fechas futuras`.
4. Todo cambio entra mediante un pull request aprobado por el otro integrante y vinculado a su issue.
5. Las ramas se borran después de integrarse.

## Definición de terminado

Una historia está terminada cuando:

- [ ] Cumple todos sus criterios de aceptación.
- [ ] El código fue revisado y aprobado mediante un PR por el otro integrante.
- [ ] Las pruebas automatizadas correspondientes pasan localmente antes de integrar. Cuando la CI esté configurada, también deben pasar allí.
- [ ] Está integrada en `main` sin romper funcionalidades existentes.
- [ ] La documentación está actualizada cuando corresponde.

## Revisión de código

- Revisar responsabilidades, capas y nombres antes de los detalles.
- Etiquetar comentarios como `pregunta`, `sugerencia`, `bloqueante`, `elogio` o `detalle`.
- Comentar el código y explicar el motivo de cada observación.

## Código de terceros

Todo fragmento no trivial tomado de otra fuente se acompaña de su origen y licencia, cuando corresponda. El uso de IA se registra en el README.
