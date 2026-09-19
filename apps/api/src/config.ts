import 'dotenv/config';
import { z } from 'zod';

const exactOrigins = z.string().default('').transform((value, context) => {
  const origins = value.split(',').map((origin) => origin.trim()).filter(Boolean);
  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol) || origin.includes('*')) {
        throw new Error('Origin must be an exact HTTP(S) origin');
      }
    } catch {
      context.addIssue({ code: 'custom', message: 'AUTH_TRUSTED_ORIGINS must contain comma-separated exact HTTP(S) origins' });
      return z.NEVER;
    }
  }
  return origins;
});

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(4000),
  PORT: z.coerce.number().int().positive().optional(),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  AUTH_TRUSTED_ORIGINS: exactOrigins,
  AUTH_SESSION_SECRET: z.string().min(32),
  AUTH_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  REGISTRATION_MODE: z.enum(['OPEN', 'INVITE_ONLY', 'CLOSED']).default('INVITE_ONLY'),
  AI_ENABLED: z.string().default('false').transform((value) => value.toLowerCase() === 'true'),
  AI_PROVIDER: z.string().default('openai-compatible'),
  AI_MODEL: z.string().default('openai/gpt-oss-20b'),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(128).max(8192).default(1200),
  AI_REQUESTS_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(10),
  AI_REQUESTS_PER_DAY: z.coerce.number().int().min(1).max(10000).default(100),
  AI_MAX_MESSAGE_LENGTH: z.coerce.number().int().min(100).max(20_000).default(4000),
  AI_MAX_TOOL_ITERATIONS: z.coerce.number().int().min(1).max(10).default(4),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(30_000),
  AI_HISTORY_MAX_MESSAGES: z.coerce.number().int().min(2).max(20).default(8),
  AI_HISTORY_MAX_TOKENS: z.coerce.number().int().min(256).max(8000).default(1200),
  AI_INPUT_TOKEN_BUDGET_PER_MINUTE: z.coerce.number().int().min(1000).max(1_000_000).default(7000),
  AI_MAX_CONCURRENT_PER_USER: z.coerce.number().int().min(1).max(5).default(1),
}).superRefine((value, context) => {
  if (value.AI_ENABLED && !value.AI_API_KEY) context.addIssue({ code: 'custom', path: ['AI_API_KEY'], message: 'AI_API_KEY is required when AI_ENABLED=true' });
});

const parsed = schema.parse(process.env);
export const config = { ...parsed, API_PORT: parsed.PORT ?? parsed.API_PORT };
