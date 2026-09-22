export type AIToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type AIToolCall = { id: string; name: string; arguments: unknown };
export type AIUsageNumbers = { inputTokens: number; outputTokens: number };
export type AIContinuationItem =
  | { type: 'tool_call'; id: string; name: string; arguments: unknown }
  | { type: 'tool_output'; callId: string; output: unknown };

export type AIGenerateInput = {
  instructions: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools: AIToolDefinition[];
  continuationItems?: AIContinuationItem[];
  maxOutputTokens: number;
  signal: AbortSignal;
};

export type AIGenerateResult = {
  responseId?: string;
  text: string;
  toolCalls: AIToolCall[];
  usage: AIUsageNumbers;
};

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generateResponse(input: AIGenerateInput): Promise<AIGenerateResult>;
  toolCalling(input: AIGenerateInput): Promise<AIGenerateResult>;
  structuredOutput<T>(input: AIGenerateInput, _schema: Record<string, unknown>): Promise<T>;
  streamResponse(input: AIGenerateInput): AsyncIterable<string>;
}

export class AIProviderError extends Error {
  constructor(public status: number) {
    super(`AI provider returned ${status}`);
  }
}

type OpenAIProviderOptions = { apiKey: string; model: string; baseUrl?: string };

export class OpenAIResponsesProvider implements AIProvider {
  readonly name = 'openai-compatible';
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: OpenAIProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  async generateResponse(input: AIGenerateInput): Promise<AIGenerateResult> {
    return this.request(input);
  }

  private async request(input: AIGenerateInput, structuredSchema?: Record<string, unknown>): Promise<AIGenerateResult> {
    const continuation = (input.continuationItems ?? []).map((item) => item.type === 'tool_call'
      ? { type: 'function_call', call_id: item.id, name: item.name, arguments: JSON.stringify(item.arguments) }
      : { type: 'function_call_output', call_id: item.callId, output: JSON.stringify(item.output) });
    const body: Record<string, unknown> = {
      model: this.model,
      instructions: input.instructions,
      max_output_tokens: input.maxOutputTokens,
      tools: input.tools.map((tool) => ({ type: 'function', ...tool, strict: false })),
      input: [...input.messages, ...continuation],
    };
    if (structuredSchema) {
      body.text = { format: { type: 'json_schema', name: 'nazemni_structured_output', schema: structuredSchema, strict: true } };
      body.reasoning = { effort: 'low' };
    }
    const response = await fetch(this.baseUrl + '/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: input.signal,
    });
    if (!response.ok) throw new AIProviderError(response.status);
    const payload = await response.json() as {
      id?: string;
      output_text?: string;
      output?: Array<{ type?: string; call_id?: string; name?: string; arguments?: string; content?: Array<{ type?: string; text?: string }> }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const toolCalls: AIToolCall[] = [];
    const textParts: string[] = [];
    for (const item of payload.output ?? []) {
      if (item.type === 'function_call' && item.call_id && item.name) {
        let args: unknown = {};
        try { args = JSON.parse(item.arguments ?? '{}'); } catch { throw new Error('Malformed AI tool arguments'); }
        toolCalls.push({ id: item.call_id, name: item.name, arguments: args });
      }
      if (item.type === 'message') {
        for (const content of item.content ?? []) if (content.type === 'output_text' && content.text) textParts.push(content.text);
      }
    }
    return {
      responseId: payload.id,
      text: payload.output_text ?? textParts.join('\n'),
      toolCalls,
      usage: { inputTokens: payload.usage?.input_tokens ?? 0, outputTokens: payload.usage?.output_tokens ?? 0 },
    };
  }

  toolCalling(input: AIGenerateInput) { return this.generateResponse(input); }

  async structuredOutput<T>(input: AIGenerateInput, schema: Record<string, unknown>): Promise<T> {
    const result = await this.request({ ...input, instructions: input.instructions + '\nReturn only valid JSON matching the provided schema.' }, schema);
    return JSON.parse(result.text) as T;
  }

  async *streamResponse(input: AIGenerateInput): AsyncIterable<string> {
    const result = await this.generateResponse(input);
    if (result.text) yield result.text;
  }
}

export class MockAIProvider implements AIProvider {
  readonly name = 'mock';
  readonly model = 'mock-ai-v1';
  readonly inputs: AIGenerateInput[] = [];
  private queue: AIGenerateResult[];

  constructor(results: AIGenerateResult[] = []) { this.queue = [...results]; }
  enqueue(result: AIGenerateResult) { this.queue.push(result); }
  async generateResponse(input: AIGenerateInput): Promise<AIGenerateResult> {
    this.inputs.push(input);
    return this.queue.shift() ?? { text: 'Mock response', toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 } };
  }
  toolCalling(input: AIGenerateInput) { return this.generateResponse(input); }
  async structuredOutput<T>(_input: AIGenerateInput, _schema: Record<string, unknown>): Promise<T> { void _input; void _schema; return {} as T; }
  async *streamResponse(input: AIGenerateInput): AsyncIterable<string> { yield (await this.generateResponse(input)).text; }
}
