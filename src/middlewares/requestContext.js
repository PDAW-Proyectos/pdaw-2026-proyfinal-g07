import { randomUUID } from 'node:crypto';

const MAX_REQUEST_ID_LENGTH = 100;

export function requestContext(logger) {
  return (req, res, next) => {
    const idRecibido = req.get('X-Request-Id');
    const idValido =
      typeof idRecibido === 'string' &&
      idRecibido.length > 0 &&
      idRecibido.length <= MAX_REQUEST_ID_LENGTH;

    req.id = idValido ? idRecibido : randomUUID();
    res.set('X-Request-Id', req.id);

    const inicio = process.hrtime.bigint();

    res.on('finish', () => {
      const duracionMs = Number((process.hrtime.bigint() - inicio) / 1_000_000n);

      logger.info('solicitud', {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        ms: duracionMs,
      });
    });

    next();
  };
}
