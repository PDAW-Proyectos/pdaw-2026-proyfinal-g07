import { fileURLToPath } from 'node:url';

const archivoPorDefecto = fileURLToPath(new URL('../data/fotograma.json', import.meta.url));

const esProduccion = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET ?? 'fotograma-desarrollo';

if (esProduccion && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET es obligatorio en producción.');
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dataFile: process.env.DATA_FILE ?? archivoPorDefecto,
  sessionSecret,
  esProduccion,
};
