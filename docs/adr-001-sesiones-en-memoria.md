# ADR-001: Sesiones en memoria con cookie HttpOnly

- **Estado:** Aceptado
- **Fecha:** Noviembre de 2026
- **Decisores:** Equipo 7

## Contexto

La aplicación necesita autenticar usuarios, mantener la sesión entre peticiones y proteger las rutas privadas. El despliegue inicial es una sola instancia en Render free y no hay un servicio externo de sesiones.

## Decisión

Usar `express-session` con el almacén en memoria predeterminado y una cookie de sesión llamada `fg_sesion`.

- `httpOnly: true`: JavaScript del navegador no puede leer la cookie.
- `sameSite: 'lax'`: limita el envío de la cookie en peticiones cruzadas.
- `secure` en producción: la cookie solo viaja por HTTPS.
- `maxAge` de 7 días.
- `saveUninitialized: false` y `resave: false` para no crear sesiones vacías ni reescribir sesiones sin cambios.
- La sesión se regenera al iniciar sesión para reducir la fijación de sesión.
- En producción se configura `trust proxy` para que Express detecte HTTPS detrás del proxy de Render.

## Consecuencias

**Positivas**

- Es simple de implementar y de explicar.
- El frontend no manipula tokens: la cookie es la única credencial.
- La cookie no es accesible desde JavaScript, lo que reduce el impacto de un XSS.
- No requiere Redis ni una base de datos de sesiones.

**Negativas**

- Las sesiones viven en memoria: se pierden al reiniciar el servidor o al hacer un deploy.
- No escala horizontalmente: dos instancias no comparten sesiones.
- No hay un token CSRF explícito; la protección se apoya en `sameSite=lax` y en el middleware que exige JSON en las rutas de escritura.
- El almacén en memoria no es recomendado por Express para producción a gran escala.

## Alternativas consideradas

- **JWT:** evita estado en el servidor, pero complica la revocación y el cierre de sesión inmediato.
- **Redis o base de datos:** permite compartir sesiones entre instancias y sobrevivir reinicios, pero agrega infraestructura y configuración.
- **Cookies firmadas propias:** requieren implementar expiración, revocación y regeneración, que `express-session` ya resuelve.

## Cuándo revisar esta decisión

Si se despliega con más de una instancia, si las sesiones deben sobrevivir reinicios o si se necesita revocación centralizada, hay que reemplazar el almacén por Redis o por un store respaldado por base de datos. También conviene agregar un token CSRF si aparecen formularios cross-site o flujos más expuestos.
