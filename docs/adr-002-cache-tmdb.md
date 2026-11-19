# ADR-002: Cache en memoria para TMDB

- **Estado:** Aceptado
- **Fecha:** Noviembre de 2026
- **Decisores:** Equipo 7

## Contexto

Las búsquedas, tendencias, catálogo y tráiler dependen de TMDB. Repetir la misma consulta en cada visita agrega latencia, consume cuota de la API y hace que la experiencia dependa de la disponibilidad del proveedor. Los datos de TMDB cambian con poca frecuencia para una misma consulta.

## Decisión

Usar un `Map` en memoria dentro de `PeliculaService` con entradas que vencen por tiempo (TTL).

- Búsquedas: 60 segundos.
- Tendencias: 5 minutos.
- Catálogo: 5 minutos.
- Tráiler: 24 horas.
- Claves separadas por operación, consulta y página; por ejemplo `buscar:matrix:1` o `trailer:<id>`.
- Máximo de 200 entradas. Al superarlo se eliminan las vencidas y luego las más antiguas según el orden de inserción.
- Los errores de TMDB no se cachean: el siguiente pedido vuelve a intentar.
- Las recomendaciones no se cachean porque dependen de la actividad de cada usuario.
- El mapa de géneros se carga una vez por proceso y se reutiliza.

## Consecuencias

**Positivas**

- Reduce llamadas repetidas a TMDB y mejora la latencia percibida.
- Disminuye el riesgo de agotar la cuota o de fallar por indisponibilidad temporal.
- El TTL acota la antigüedad de los datos y el tamaño máximo acota el uso de memoria.
- No requiere infraestructura adicional.

**Negativas**

- Los datos pueden estar desactualizados hasta que vence el TTL.
- La cache es por proceso: no se comparte entre instancias y se pierde al reiniciar.
- La poda no es LRU estricta; usa el orden de inserción del `Map`.
- No hay invalidación manual desde el panel de administración.

## Alternativas consideradas

- **Sin cache:** más simple, pero cada visita repetía llamadas a TMDB y aumentaba la latencia.
- **Cache HTTP con `Cache-Control`:** útil para respuestas públicas, pero menos control sobre claves, TTL y errores del proveedor.
- **Redis:** permitiría compartir cache entre instancias, pero agrega un servicio que el despliegue actual no necesita.

## Cuándo revisar esta decisión

Si se ejecutan varias instancias, si se necesita invalidar datos desde administración o si TMDB cambia con más frecuencia, conviene evaluar una cache compartida o una estrategia de invalidación explícita.
