# Patrón elegido: Adapter

**Problema:** TMDB devuelve películas con una estructura externa que puede diferir del modelo de Fotograma.

**Aplicación prevista:** un `TMDBAdapter` transformará las respuestas de búsqueda y detalle al formato interno de `Pelicula` y normalizará los errores del proveedor. Los servicios de Fotograma usarán ese adaptador para no depender directamente de la representación de TMDB.

**Beneficio:** concentrar la integración en un módulo y poder probar los casos de uso con respuestas simuladas.
