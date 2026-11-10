import { fileURLToPath } from 'node:url';

const archivoPorDefecto = fileURLToPath(new URL('../data/fotograma.json', import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dataFile: process.env.DATA_FILE ?? archivoPorDefecto,
};
