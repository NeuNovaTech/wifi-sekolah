import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, driver } from '../src/db.js';
import { config } from '../src/config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaFile = driver === 'sqlite' ? 'schema.sqlite.sql' : 'schema.mysql.sql';
const schemaPath = path.join(here, schemaFile);

if (!fs.existsSync(schemaPath)) {
  console.error(`Skema tidak ditemukan: ${schemaPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(schemaPath, 'utf8');
const statements = sql
  .split(/\r?\n/)
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

console.log(`Memasang skema ${schemaFile} (${statements.length} pernyataan)...`);

for (const statement of statements) {
  await db.run(statement);
}

if (driver === 'sqlite') {
  console.log(`SQLite siap: ${config.db.sqlitePath}`);
} else {
  console.log(`MySQL siap: ${config.db.username}@${config.db.host}/${config.db.database}`);
}

await db.close?.();
