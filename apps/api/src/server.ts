import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { createNazemniAuth } from './auth.js';
import { OpenAIResponsesProvider } from './ai/provider.js';

const webDistPath = config.NODE_ENV === 'production'
  ? resolve(dirname(fileURLToPath(import.meta.url)), '../../../dist')
  : undefined;
const secureCookie = config.NODE_ENV === 'production' && new URL(config.WEB_ORIGIN).protocol === 'https:';

const auth = createNazemniAuth({
  baseURL: config.WEB_ORIGIN,
  webOrigin: config.WEB_ORIGIN,
  trustedOrigins: config.AUTH_TRUSTED_ORIGINS,
  secret: config.AUTH_SESSION_SECRET,
  sessionTtlDays: config.AUTH_SESSION_TTL_DAYS,
  secureCookie,
  registrationMode: config.REGISTRATION_MODE,
});

const aiConfig = {
  enabled: config.AI_ENABLED,
  providerName: config.AI_PROVIDER,
  model: config.AI_MODEL,
  maxOutputTokens: config.AI_MAX_OUTPUT_TOKENS,
  requestsPerMinute: config.AI_REQUESTS_PER_MINUTE,
  requestsPerDay: config.AI_REQUESTS_PER_DAY,
  maxMessageLength: config.AI_MAX_MESSAGE_LENGTH,
  maxToolIterations: config.AI_MAX_TOOL_ITERATIONS,
  timeoutMs: config.AI_TIMEOUT_MS,
  historyMaxMessages: config.AI_HISTORY_MAX_MESSAGES,
  historyMaxTokens: config.AI_HISTORY_MAX_TOKENS,
  inputTokenBudgetPerMinute: config.AI_INPUT_TOKEN_BUDGET_PER_MINUTE,
  maxConcurrentPerUser: config.AI_MAX_CONCURRENT_PER_USER,
};
const aiProvider = config.AI_ENABLED && config.AI_API_KEY
  ? new OpenAIResponsesProvider({ apiKey: config.AI_API_KEY, model: config.AI_MODEL, baseUrl: config.AI_BASE_URL })
  : undefined;

const server = createApp({
  webOrigin: config.WEB_ORIGIN,
  trustedOrigins: config.AUTH_TRUSTED_ORIGINS,
  webDistPath,
  auth,
  registrationMode: config.REGISTRATION_MODE,
  secureCookie,
  aiConfig,
  aiProvider,
}).listen(config.API_PORT, '0.0.0.0', () => {
  console.log('Nazemni API listening on port ' + config.API_PORT);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
