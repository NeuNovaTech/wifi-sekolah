import { app } from './src/app.js';
import { config } from './src/config.js';
import { db } from './src/db.js';

const server = app.listen(config.app.port, config.app.host, () => {
  console.log('====================================================');
  console.log(' ' + config.app.name);
  console.log(` API    : http://${config.app.host}:${config.app.port}/api`);
  console.log(` Driver : ${db.driver}`);
  console.log(` Static : ${config.app.serveStatic ? 'aktif (mode uji lokal)' : 'nonaktif (dilayani Nginx)'}`);
  console.log('====================================================');
});

async function shutdown(signal) {
  console.log(`\n[api] ${signal} diterima, menutup server...`);

  server.close(async () => {
    try {
      await db.close?.();
    } catch (error) {
      console.error('[api] gagal menutup database:', error.message);
    }

    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
