import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { createNazemniAuth } from './auth.js';
import { OpenAIResponsesProvider } from './ai/provider.js';
import { createCourseSearchProvider } from './course-intelligence/search.js';
import { AICourseExtractor } from './course-intelligence/extract.js';
import { PrismaCourseCatalogRepository } from './course-intelligence/repository.js';
import { CourseIntelligenceService } from './course-intelligence/service.js';

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

const courseIntelligenceConfig = {
  enabled: config.COURSE_INTELLIGENCE_ENABLED,
  cacheDays: config.COURSE_INTELLIGENCE_CACHE_DAYS,
  maxSearchResults: config.COURSE_INTELLIGENCE_MAX_SEARCH_RESULTS,
  maxFetchedPages: config.COURSE_INTELLIGENCE_MAX_FETCHED_PAGES,
  maxSourceBytes: config.COURSE_INTELLIGENCE_MAX_SOURCE_BYTES,
  maxExtractedChars: config.COURSE_INTELLIGENCE_MAX_EXTRACTED_CHARS,
  aiContextChars: config.COURSE_INTELLIGENCE_AI_CONTEXT_CHARS,
  aiMaxOutputTokens: config.COURSE_INTELLIGENCE_AI_MAX_OUTPUT_TOKENS,
  timeoutMs: config.COURSE_INTELLIGENCE_TIMEOUT_MS,
  requestsPerMinute: config.COURSE_INTELLIGENCE_REQUESTS_PER_MINUTE,
};
const courseIntelligenceService = config.COURSE_INTELLIGENCE_ENABLED && config.COURSE_INTELLIGENCE_SEARCH_API_KEY && config.AI_API_KEY
  ? (() => {
      const provider = new OpenAIResponsesProvider({
        apiKey: config.AI_API_KEY,
        model: config.COURSE_INTELLIGENCE_AI_MODEL,
        baseUrl: config.COURSE_INTELLIGENCE_AI_BASE_URL,
      });
      return new CourseIntelligenceService(courseIntelligenceConfig, {
        search: createCourseSearchProvider(
          config.COURSE_INTELLIGENCE_SEARCH_PROVIDER,
          config.COURSE_INTELLIGENCE_SEARCH_API_KEY,
          config.COURSE_INTELLIGENCE_SEARCH_BASE_URL,
        ),
        extractor: new AICourseExtractor(provider, courseIntelligenceConfig.aiContextChars, courseIntelligenceConfig.aiMaxOutputTokens, courseIntelligenceConfig.timeoutMs),
        repository: new PrismaCourseCatalogRepository(),
      });
    })()
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
  courseIntelligenceConfig,
  courseIntelligenceService,
}).listen(config.API_PORT, '0.0.0.0', () => {
  console.log('Nazemni API listening on port ' + config.API_PORT);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
