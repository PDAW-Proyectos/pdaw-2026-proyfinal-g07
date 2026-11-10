import { ErrorDominio } from '../utils/ErrorDominio.js';

const MAX_INTENTOS_PREDETERMINADOS = 5;
const VENTANA_PREDETERMINADA_MS = 15 * 60 * 1000;
const INTERVALO_LIMPIEZA = 128;

/**
 * Arma la clave del intento con la IP del cliente y el identificador enviado.
 * Se normaliza el identificador para que las variantes de mayúsculas compartan contador.
 */
function claveDeIntento(req) {
  const identificador = req.body?.identificador ?? req.body?.email ?? '';

  return `${req.ip ?? 'sin-ip'}|${String(identificador).trim().toLowerCase()}`;
}

/**
 * Limita los intentos fallidos de autenticación por IP e identificador.
 * Cuenta las respuestas 401 y 409 (credenciales inválidas y duplicados) y libera
 * la clave cuando la operación sale bien. Es un contador en memoria por proceso:
 * alcanza para una sola instancia, que es el despliegue previsto del proyecto.
 */
export function limitarIntentos({
  max = MAX_INTENTOS_PREDETERMINADOS,
  ventanaMs = VENTANA_PREDETERMINADA_MS,
  ahora = () => Date.now(),
  clave = claveDeIntento,
} = {}) {
  const registros = new Map();
  let solicitudesHastaLimpieza = 0;

  function limpiarVencidos(instante) {
    for (const [clave, registro] of registros) {
      if (instante - registro.inicio >= ventanaMs) {
        registros.delete(clave);
      }
    }
  }

  function registroVigente(clave, instante) {
    const registro = registros.get(clave);

    if (!registro || instante - registro.inicio >= ventanaMs) {
      return null;
    }

    return registro;
  }

  function registrarFallo(clave, instante) {
    const vigente = registroVigente(clave, instante);

    registros.set(clave, {
      inicio: vigente?.inicio ?? instante,
      cantidad: (vigente?.cantidad ?? 0) + 1,
    });
  }

  return (req, res, next) => {
    Promise.resolve()
      .then(() => clave(req))
      .then((resultado) => {
        const instante = ahora();
        const claveIntento = String(resultado);
        const vigente = registroVigente(claveIntento, instante);

        if (vigente && vigente.cantidad >= max) {
          const restanteMs = Math.max(0, ventanaMs - (instante - vigente.inicio));

          res.set('Retry-After', String(Math.ceil(restanteMs / 1000)));
          next(
            new ErrorDominio(
              'DEMASIADOS_INTENTOS',
              'Demasiados intentos fallidos. Esperá unos minutos antes de volver a intentar.',
            ),
          );
          return;
        }

        res.on('finish', () => {
          const momento = ahora();

          if (res.statusCode === 401 || res.statusCode === 409) {
            registrarFallo(claveIntento, momento);
          } else if (res.statusCode >= 200 && res.statusCode < 300) {
            registros.delete(claveIntento);
          }

          solicitudesHastaLimpieza += 1;

          if (solicitudesHastaLimpieza >= INTERVALO_LIMPIEZA) {
            solicitudesHastaLimpieza = 0;
            limpiarVencidos(momento);
          }
        });

        next();
      })
      .catch(next);
  };
}
