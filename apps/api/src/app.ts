import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { entityRouter } from './routes/entities.js';
import { planningRouter } from './routes/planning.js';
import { errorHandler, notFound } from './errors.js';

export function createApp(webOrigin = 'http://localhost:5173') {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: webOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp());
  app.get('/health', (_req, res) => res.json({ ok: true, data: { status: 'healthy' } }));
  app.use('/api', entityRouter);
  app.use('/api', planningRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
