import { api, mutations } from './api';

declare global {
  interface Document {
    readonly modelContext?: {
      registerTool(tool: {
        name: string;
        title: string;
        description: string;
        inputSchema: Record<string, unknown>;
        execute(input: unknown): unknown | Promise<unknown>;
        annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
      }, options?: { signal?: AbortSignal }): void | Promise<void>;
    };
  }
}

export function registerStudyTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return () => undefined;
  const lifecycle = new AbortController();
  const register = (tool: Parameters<typeof context.registerTool>[0]) => {
    void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined);
  };
  register({
    name: 'read_daily_study_plan',
    title: 'Read daily study plan',
    description: 'Read the currently calculated Nazemni daily study priorities without changing data.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => api('/daily-plan'),
  });
  register({
    name: 'create_study_task',
    title: 'Create study task',
    description: 'Create one concrete study task in Nazemni for a selected course.',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'string' },
        title: { type: 'string' },
        type: { type: 'string', enum: ['LECTURE', 'REVIEW', 'ASSIGNMENT', 'PROJECT', 'EXAM_PREP', 'PRACTICE', 'OTHER'] },
        priority: { type: 'string', enum: ['CRITICAL', 'IMPORTANT', 'OPTIONAL'] },
        dueAt: { type: 'string', format: 'date-time' },
      },
      required: ['courseId', 'title', 'type'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input) => {
      if (!input || typeof input !== 'object') throw new Error('Invalid task input');
      return mutations.create('/tasks', input);
    },
  });
  return () => lifecycle.abort();
}
