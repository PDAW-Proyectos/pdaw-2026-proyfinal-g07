import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const archivoDemo = resolve(
  process.env.DEMO_DATA_FILE ?? fileURLToPath(new URL('../data/demo.json', import.meta.url)),
);

if (!existsSync(archivoDemo)) {
  console.error('No existe la demo. Ejecutá primero: npm run seed:demo');
  process.exit(1);
}

process.env.DATA_FILE = archivoDemo;
process.env.ADMIN_EMAIL = '';
process.env.ADMIN_PASSWORD = '';

await import('../src/server.js');
