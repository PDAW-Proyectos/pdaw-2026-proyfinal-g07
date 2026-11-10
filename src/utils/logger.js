const NIVELES = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function crearLogger({ nivel = process.env.LOG_LEVEL ?? 'info', salida = process.stdout } = {}) {
  const umbral = NIVELES[nivel] ?? NIVELES.info;

  function registrar(nivelEvento, mensaje, contexto = {}) {
    if (NIVELES[nivelEvento] < umbral) {
      return;
    }

    const evento = {
      level: nivelEvento,
      time: new Date().toISOString(),
      msg: mensaje,
      ...contexto,
    };

    salida.write(`${JSON.stringify(evento)}\n`);
  }

  return {
    debug: (mensaje, contexto) => registrar('debug', mensaje, contexto),
    info: (mensaje, contexto) => registrar('info', mensaje, contexto),
    warn: (mensaje, contexto) => registrar('warn', mensaje, contexto),
    error: (mensaje, contexto) => registrar('error', mensaje, contexto),
  };
}

export const logger = crearLogger();
