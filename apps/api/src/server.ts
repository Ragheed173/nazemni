import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';

const server = createApp(config.WEB_ORIGIN).listen(config.API_PORT, () => {
  console.log('Nazemni API listening on http://localhost:' + config.API_PORT);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
