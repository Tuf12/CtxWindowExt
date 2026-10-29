// Meta Model API client (OpenAI SDK with baseURL override).
// Pure module — no vscode import. Never logs or returns key material.

import OpenAI from 'openai';

export interface TestConnectionOptions {
  apiKey: string;
  baseURL: string;
  model: string;
  timeoutMs?: number;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  latencyMs: number;
  reply?: string;
}

export async function testConnection(opts: TestConnectionOptions): Promise<TestConnectionResult> {
  const started = Date.now();
  const client = new OpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL,
    timeout: opts.timeoutMs ?? 60000,
    maxRetries: 0,
  });
  try {
    const response = await client.responses.create({
      model: opts.model,
      input: 'Reply with exactly: OK',
      reasoning: { effort: 'low' },
    });
    const latencyMs = Date.now() - started;
    const reply = (response.output_text ?? '').trim();
    return {
      ok: true,
      latencyMs,
      reply,
      message: `Connected to ${opts.model} in ${latencyMs} ms. Reply: ${reply || '(empty)'}`,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: describeError(err, opts.model),
    };
  }
}

function describeError(err: unknown, model: string): string {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 401) {
      return 'Invalid API key (401). Check the key and confirm it matches one in the Model API dashboard.';
    }
    if (err.status === 404) {
      return `Model not found (404). Use a valid model ID such as ${model} exactly.`;
    }
    if (err.status === 429) {
      return 'Rate limited or out of credits (429). Check the Billing page for available credits.';
    }
    return `API error (${err.status ?? 'unknown status'}): ${err.message}`;
  }
  if (err instanceof Error) {
    return `Request failed: ${err.message}`;
  }
  return 'Request failed with an unknown error.';
}
