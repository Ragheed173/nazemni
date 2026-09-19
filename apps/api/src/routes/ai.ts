import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import { z } from 'zod';
import { authUser } from '../auth.js';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { AIProviderError, type AIProvider } from '../ai/provider.js';
import { getAIRuntimeMetrics, recordAIRateLimit, runAIConversation, type AIRuntimeConfig } from '../ai/service.js';

const ok = (data: unknown) => ({ ok: true, data });

export function createAIRouter(config: AIRuntimeConfig, provider?: AIProvider) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: config.requestsPerMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (_request, response) => authUser(response).id,
    handler: (_request, response) => {
      recordAIRateLimit('internal');
      response.status(429).json({ ok: false, error: { code: 'AI_RATE_LIMIT', message: 'AI request limit reached' } });
    },
  });

  router.get('/status', (_request, response) => response.json(ok({ enabled: config.enabled, provider: config.enabled ? config.providerName : null, model: config.enabled ? config.model : null })));
  router.get('/admin/status', async (_request, response) => {
    if (authUser(response).role !== 'ADMIN') throw new AppError(403, 'Forbidden');
    const now = new Date(); const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [todayStats, monthStats] = await Promise.all([
      prisma.aIUsage.aggregate({ where: { date: { gte: today } }, _sum: { requestCount: true, inputTokens: true, outputTokens: true, errorCount: true } }),
      prisma.aIUsage.aggregate({ where: { date: { gte: month } }, _sum: { requestCount: true, inputTokens: true, outputTokens: true, errorCount: true } }),
    ]);
    const requestsToday = todayStats._sum.requestCount ?? 0;
    const inputTokensToday = todayStats._sum.inputTokens ?? 0;
    const outputTokensToday = todayStats._sum.outputTokens ?? 0;
    response.json(ok({ enabled: config.enabled, provider: config.providerName, model: config.model, requestsToday, requestsThisMonth: monthStats._sum.requestCount ?? 0, inputTokensToday, outputTokensToday, averageInputTokens: requestsToday ? Math.round(inputTokensToday / requestsToday) : 0, averageOutputTokens: requestsToday ? Math.round(outputTokensToday / requestsToday) : 0, errorsToday: todayStats._sum.errorCount ?? 0, errorsThisMonth: monthStats._sum.errorCount ?? 0, ...getAIRuntimeMetrics() }));
  });
  router.use((request, _response, next) => {
    if (!config.enabled || !provider) return next(new AppError(503, 'AI assistant is currently unavailable'));
    next();
  });

  router.get('/conversations', async (_request, response) => {
    const items = await prisma.aIConversation.findMany({ where: { userId: authUser(response).id }, orderBy: { updatedAt: 'desc' }, take: 100, select: { id: true, title: true, createdAt: true, updatedAt: true } });
    response.json(ok(items));
  });
  router.post('/conversations', async (request, response) => {
    const title = z.object({ title: z.string().trim().min(1).max(120).optional() }).strict().parse(request.body).title;
    const language = authUser(response).preferredLanguage;
    const item = await prisma.aIConversation.create({ data: { userId: authUser(response).id, title: title ?? (language === 'ar' ? 'محادثة جديدة' : 'New conversation') }, select: { id: true, title: true, createdAt: true, updatedAt: true } });
    response.status(201).json(ok(item));
  });
  router.get('/conversations/:id', async (request, response) => {
    const item = await prisma.aIConversation.findFirst({ where: { id: String(request.params.id), userId: authUser(response).id }, select: { id: true, title: true, createdAt: true, updatedAt: true, messages: { orderBy: { createdAt: 'asc' }, take: 200, select: { id: true, role: true, content: true, createdAt: true } } } });
    if (!item) throw new AppError(404, 'Resource not found');
    response.json(ok(item));
  });
  router.delete('/conversations/:id', async (request, response) => {
    const deleted = await prisma.aIConversation.deleteMany({ where: { id: String(request.params.id), userId: authUser(response).id } });
    if (!deleted.count) throw new AppError(404, 'Resource not found');
    response.status(204).end();
  });
  router.post('/conversations/:id/messages', limiter, async (request, response) => {
    const user = authUser(response);
    const input = z.object({ message: z.string().trim().min(1).max(config.maxMessageLength) }).strict().parse(request.body);
    const settings = await prisma.appSettings.findUnique({ where: { userId: user.id }, select: { timezone: true, language: true } });
    try {
      response.status(201).json(ok(await runAIConversation({ userId: user.id, language: settings?.language ?? user.preferredLanguage, timezone: settings?.timezone ?? 'Asia/Hebron', conversationId: String(request.params.id), message: input.message, provider: provider!, config })));
    } catch (error) {
      request.log.error({ event: 'ai_request_failed', userId: user.id, conversationId: request.params.id, error: error instanceof Error ? error.message : 'unknown' }, 'AI request failed');
      const providerBusy = user.preferredLanguage === 'ar' ? 'المساعد مشغول حاليًا بسبب حد الاستخدام المؤقت. جرّب مرة ثانية بعد أقل من دقيقة.' : 'The assistant is temporarily busy because of its usage limit. Try again in less than a minute.';
      if (error instanceof AIProviderError && error.status === 429) throw new AppError(429, providerBusy, 'AI_PROVIDER_RATE_LIMIT');
      if (error instanceof AppError && error.status === 429 && ['AI_CAPACITY_LIMIT', 'AI_CONCURRENCY_LIMIT'].includes(error.code ?? '')) throw new AppError(429, providerBusy, error.code);
      if (error instanceof AppError) throw error;
      throw new AppError(503, user.preferredLanguage === 'ar' ? 'تعذر الوصول إلى المساعد حاليًا. حاول مرة أخرى بعد قليل.' : 'The assistant is unavailable right now. Please try again shortly.');
    }
  });

  return router;
}
