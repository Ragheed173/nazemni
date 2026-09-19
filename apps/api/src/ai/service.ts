import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { AIProviderError, type AIGenerateInput, type AIProvider, type AIUsageNumbers } from './provider.js';
import { NAZEMNI_AI_SYSTEM_PROMPT } from './system-prompt.js';
import { executeAITool, selectAIToolDefinitions, type PendingConfirmation } from './tools.js';

export type AIRuntimeConfig = {
  enabled: boolean;
  providerName: string;
  model: string;
  maxOutputTokens: number;
  requestsPerMinute: number;
  requestsPerDay: number;
  maxMessageLength: number;
  maxToolIterations: number;
  timeoutMs: number;
  historyMaxMessages: number;
  historyMaxTokens: number;
  inputTokenBudgetPerMinute: number;
  maxConcurrentPerUser: number;
};

export const defaultAIRuntimeConfig: AIRuntimeConfig = {
  enabled: false,
  providerName: 'openai-compatible',
  model: 'openai/gpt-oss-20b',
  maxOutputTokens: 1200,
  requestsPerMinute: 10,
  requestsPerDay: 100,
  maxMessageLength: 4000,
  maxToolIterations: 4,
  timeoutMs: 30_000,
  historyMaxMessages: 8,
  historyMaxTokens: 1200,
  inputTokenBudgetPerMinute: 7000,
  maxConcurrentPerUser: 1,
};

const usageDate = (date = new Date()) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const confirms = (message: string) => /^(نعم|أكد|اكد|موافق|نفذ|yes|confirm|confirmed|proceed)[.!\s]*$/iu.test(message.trim());
const activeRequests = new Map<string, number>();
let tokenWindow: Array<{ at: number; tokens: number }> = [];
let runtimeRateLimits = { date: usageDate().toISOString(), internal: 0, provider: 0 };

export function recordAIRateLimit(kind: 'internal' | 'provider') {
  const date = usageDate().toISOString();
  if (runtimeRateLimits.date !== date) runtimeRateLimits = { date, internal: 0, provider: 0 };
  runtimeRateLimits[kind] += 1;
}

export function getAIRuntimeMetrics() {
  const date = usageDate().toISOString();
  if (runtimeRateLimits.date !== date) runtimeRateLimits = { date, internal: 0, provider: 0 };
  return { rateLimitEvents: runtimeRateLimits.internal + runtimeRateLimits.provider, providerRateLimitEvents: runtimeRateLimits.provider };
}

const approximateTokens = (value: string) => Math.ceil(value.length / 4);

export function boundAIHistory(
  historyNewestFirst: Array<{ role: string; content: string }>,
  maxMessages: number,
  maxTokens: number,
) {
  const selected: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let tokens = 0;
  for (const item of historyNewestFirst.slice(0, maxMessages)) {
    const itemTokens = approximateTokens(item.content) + 4;
    if (selected.length && tokens + itemTokens > maxTokens) break;
    selected.push({ role: item.role === 'USER' ? 'user' : 'assistant', content: item.content });
    tokens += itemTokens;
  }
  return selected.reverse();
}

export function estimateAIInputTokens(input: Pick<AIGenerateInput, 'instructions' | 'messages' | 'tools' | 'continuationItems'>) {
  return approximateTokens(JSON.stringify(input));
}

function reserveInputTokens(estimated: number, limit: number) {
  const cutoff = Date.now() - 60_000;
  tokenWindow = tokenWindow.filter((item) => item.at > cutoff);
  if (tokenWindow.reduce((sum, item) => sum + item.tokens, 0) + estimated > limit) {
    recordAIRateLimit('internal');
    throw new AppError(429, 'AI temporary token budget reached', 'AI_CAPACITY_LIMIT');
  }
  tokenWindow.push({ at: Date.now(), tokens: estimated });
}

function preloadedToolFor(message: string) {
  const value = message.toLowerCase();
  if (/(شو|ماذا|what).*(أدرس|ادرس|study).*(اليوم|today)|خطة اليوم|daily plan/u.test(value)) return 'getDailyPlan';
  if (/متراكم|التراكم|backlog|overdue/u.test(value)) return 'getBacklog';
  if (/وضعي بالمواد|وضعي الدراسي|حالتي الدراسية|overall.*(course|study)|how am i doing/u.test(value)) return 'getStudentState';
  return undefined;
}

export async function recordAIUsage(userId: string, config: AIRuntimeConfig, usage: AIUsageNumbers, error = false) {
  const date = usageDate();
  await prisma.aIUsage.upsert({
    where: { userId_date_provider_model: { userId, date, provider: config.providerName, model: config.model } },
    create: { userId, date, provider: config.providerName, model: config.model, requestCount: 1, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, errorCount: error ? 1 : 0 },
    update: { requestCount: { increment: 1 }, inputTokens: { increment: usage.inputTokens }, outputTokens: { increment: usage.outputTokens }, errorCount: error ? { increment: 1 } : undefined },
  });
}

export async function assertDailyAILimit(userId: string, config: AIRuntimeConfig) {
  const rows = await prisma.aIUsage.aggregate({ where: { userId, date: usageDate() }, _sum: { requestCount: true } });
  if ((rows._sum.requestCount ?? 0) >= config.requestsPerDay) throw new AppError(429, 'AI daily request limit reached');
}

function pendingFromMetadata(value: Prisma.JsonValue | null): PendingConfirmation | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const pending = (value as Record<string, unknown>).pendingConfirmation;
  if (!pending || typeof pending !== 'object' || Array.isArray(pending)) return undefined;
  const item = pending as Record<string, unknown>;
  if (typeof item.fingerprint !== 'string' || typeof item.toolName !== 'string' || typeof item.summary !== 'string') return undefined;
  return item as unknown as PendingConfirmation;
}

export async function runAIConversation(options: {
  userId: string;
  language: string;
  timezone: string;
  conversationId: string;
  message: string;
  provider: AIProvider;
  config: AIRuntimeConfig;
}) {
  const { userId, conversationId, provider, config } = options;
  if (options.message.length > config.maxMessageLength) throw new AppError(413, 'AI message is too long');
  await assertDailyAILimit(userId, config);
  const conversation = await prisma.aIConversation.findFirst({ where: { id: conversationId, userId }, select: { id: true, title: true } });
  if (!conversation) throw new AppError(404, 'Resource not found');

  const active = activeRequests.get(userId) ?? 0;
  if (active >= config.maxConcurrentPerUser) {
    recordAIRateLimit('internal');
    throw new AppError(429, 'Another AI request is already running', 'AI_CONCURRENCY_LIMIT');
  }
  activeRequests.set(userId, active + 1);

  try {
    const startedAt = Date.now();
    const previousAssistant = await prisma.aIMessage.findFirst({ where: { conversationId, role: 'ASSISTANT' }, orderBy: { createdAt: 'desc' }, select: { toolMetadata: true } });
    const pending = pendingFromMetadata(previousAssistant?.toolMetadata ?? null);
    const approvedFingerprint = pending && confirms(options.message) ? pending.fingerprint : undefined;
    await prisma.aIMessage.create({ data: { conversationId, role: 'USER', content: options.message } });
    if (conversation.title === 'New conversation' || conversation.title === 'محادثة جديدة') {
      await prisma.aIConversation.update({ where: { id: conversationId }, data: { title: options.message.trim().slice(0, 80) || conversation.title } });
    }

    const history = await prisma.aIMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'desc' }, take: config.historyMaxMessages, select: { role: true, content: true } });
    const messages = boundAIHistory(history, config.historyMaxMessages, config.historyMaxTokens);
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: options.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const instructions = `${NAZEMNI_AI_SYSTEM_PROMPT}\nContext: date=${localDate}; timezone=${options.timezone}; language=${options.language}.`;
    const selectedTools = selectAIToolDefinitions(options.message, approvedFingerprint ? pending?.toolName : undefined);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    const continuationItems: import('./provider.js').AIContinuationItem[] = [];
    let text = '';
    const usage = { inputTokens: 0, outputTokens: 0 };
    const toolLog: Array<{ name: string; ok: boolean; requiresConfirmation?: boolean }> = [];
    let pendingConfirmation: PendingConfirmation | undefined;

    const preloadedTool = approvedFingerprint ? undefined : preloadedToolFor(options.message);
    if (preloadedTool && selectedTools.some((tool) => tool.name === preloadedTool)) {
      const callId = `server-${preloadedTool}`;
      const output = await executeAITool(preloadedTool, {}, { userId, timezone: options.timezone });
      continuationItems.push({ type: 'tool_call', id: callId, name: preloadedTool, arguments: {} }, { type: 'tool_output', callId, output });
      toolLog.push({ name: preloadedTool, ok: true });
    }

    try {
    for (let iteration = 0; iteration <= config.maxToolIterations; iteration += 1) {
      const providerInput = { instructions, messages, tools: selectedTools, continuationItems, maxOutputTokens: config.maxOutputTokens, signal: controller.signal };
      reserveInputTokens(estimateAIInputTokens(providerInput), config.inputTokenBudgetPerMinute);
      const result = await provider.generateResponse(providerInput);
      usage.inputTokens += result.usage.inputTokens;
      usage.outputTokens += result.usage.outputTokens;
      text = result.text || text;
      if (!result.toolCalls.length) break;
      if (iteration === config.maxToolIterations) throw new AppError(502, 'AI tool iteration limit reached');
      for (const call of result.toolCalls) {
        continuationItems.push({ type: 'tool_call', id: call.id, name: call.name, arguments: call.arguments });
        let output: unknown;
        try {
          output = await executeAITool(call.name, call.arguments, { userId, timezone: options.timezone, approvedFingerprint });
        } catch (error) {
          output = { ok: false, error: error instanceof AppError ? error.message : 'Tool operation failed' };
        }
        const resultRecord = output && typeof output === 'object' && !Array.isArray(output) ? output as Record<string, unknown> : undefined;
        if (resultRecord?.requiresConfirmation && resultRecord.confirmation) pendingConfirmation = resultRecord.confirmation as PendingConfirmation;
        toolLog.push({ name: call.name, ok: resultRecord?.ok !== false, ...(resultRecord?.requiresConfirmation ? { requiresConfirmation: true } : {}) });
        continuationItems.push({ type: 'tool_output', callId: call.id, output });
      }
    }
    if (!text) text = options.language === 'ar' ? 'تعذر إنشاء رد مفيد حاليًا.' : 'A useful response could not be generated right now.';
    const message = await prisma.aIMessage.create({
      data: { conversationId, role: 'ASSISTANT', content: text, toolMetadata: { tools: toolLog, usage: { ...usage, totalTokens: usage.inputTokens + usage.outputTokens }, latencyMs: Date.now() - startedAt, ...(pendingConfirmation ? { pendingConfirmation } : {}) } as Prisma.InputJsonValue },
      select: { id: true, role: true, content: true, createdAt: true },
    });
    await recordAIUsage(userId, config, usage);
      return { message, usage, pendingConfirmation };
    } catch (error) {
      if (error instanceof AIProviderError && error.status === 429) recordAIRateLimit('provider');
      await recordAIUsage(userId, config, usage, true).catch(() => undefined);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  } finally {
    const remaining = (activeRequests.get(userId) ?? 1) - 1;
    if (remaining > 0) activeRequests.set(userId, remaining); else activeRequests.delete(userId);
  }
}
