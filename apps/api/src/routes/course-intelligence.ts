import { Router } from 'express';
import { z } from 'zod';
import { authUser } from '../auth.js';
import { AppError } from '../errors.js';
import { durableRateLimit } from '../security.js';
import type { CourseIntelligenceService } from '../course-intelligence/service.js';
import type { CourseIntelligenceRuntimeConfig } from '../course-intelligence/types.js';

export const courseLookupInput = z.object({
  university: z.string().trim().min(2).max(200),
  program: z.string().trim().min(2).max(200),
  query: z.string().trim().min(2).max(200),
}).strict();
const questionInput = z.object({ question: z.string().trim().min(2).max(300) }).strict();
const idParam = z.object({ id: z.string().cuid() }).strict();
const ok = (data: unknown) => ({ ok: true, data });

export function createCourseIntelligenceRouter(config: CourseIntelligenceRuntimeConfig, service?: CourseIntelligenceService) {
  const router = Router();
  const requireFeature = () => {
    if (!config.enabled || !service) throw new AppError(404, 'Feature not available', 'FEATURE_DISABLED');
    return service;
  };
  const limiter = durableRateLimit({
    namespace: 'course-intelligence-lookup', windowMs: 60_000, limit: config.requestsPerMinute,
    key: (_request, response) => authUser(response).id,
  });

  router.get('/status', (_request, response) => response.json(ok({ enabled: config.enabled })));
  router.post('/lookup', (request, response, next) => {
    if (!config.enabled) { next(new AppError(404, 'Feature not available', 'FEATURE_DISABLED')); return; }
    limiter(request, response, next);
  }, async (request, response) => response.json(ok(await requireFeature().lookup(courseLookupInput.parse(request.body)))));
  router.get('/entries/:id', async (request, response) => response.json(ok(await requireFeature().get(idParam.parse(request.params).id))));
  router.post('/entries/:id/refresh', limiter, async (request, response) => response.json(ok(await requireFeature().refresh(idParam.parse(request.params).id))));
  router.post('/entries/:id/questions', async (request, response) => {
    const { id } = idParam.parse(request.params);
    const { question } = questionInput.parse(request.body);
    const language = authUser(response).preferredLanguage === 'en' ? 'en' : 'ar';
    response.json(ok({ answer: await requireFeature().answer(id, question, language) }));
  });
  return router;
}
