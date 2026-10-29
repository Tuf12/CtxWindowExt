// Brain dispatch: attempts the selected provider chain in order.
// Pure except for the provider calls themselves — no vscode import.

import { normalizeSelection, ProviderId, ProviderSelection, resolveChain } from './registry';
import { testConnection as testMetaConnection, TestConnectionResult } from './meta';
import { Runner, testCliConnection } from './cli';

export interface BrainTestOptions {
  provider: ProviderSelection | string;
  apiKey?: string;
  baseURL: string;
  model: string;
  cliPath?: string;
  timeoutMs?: number;
}

export interface BrainDeps {
  runner?: Runner;
  metaTest?: typeof testMetaConnection;
}

const MAX_NOTE = 220;

function shorten(text: string): string {
  return text.length > MAX_NOTE ? `${text.slice(0, MAX_NOTE - 1)}…` : text;
}

export async function testBrainConnection(
  opts: BrainTestOptions,
  deps: BrainDeps = {},
): Promise<TestConnectionResult> {
  const chain = resolveChain(normalizeSelection(opts.provider));
  const failures: string[] = [];
  let latencyMs = 0;
  let lastLeg: ProviderId = chain[chain.length - 1];
  for (const leg of chain) {
    lastLeg = leg;
    if (leg === 'cli') {
      const result = await testCliConnection(
        { cliPath: opts.cliPath, timeoutMs: opts.timeoutMs },
        deps.runner,
      );
      latencyMs += result.latencyMs;
      if (result.ok) {
        return result;
      }
      failures.push(`Muse CLI: ${result.message}`);
      continue;
    }
    if (!opts.apiKey) {
      failures.push(
        'API key: none set (run "Ctx: Set API Key", set MODEL_API_KEY, or use the Muse CLI)',
      );
      continue;
    }
    const testMeta = deps.metaTest ?? testMetaConnection;
    const result = await testMeta({
      apiKey: opts.apiKey,
      baseURL: opts.baseURL,
      model: opts.model,
      timeoutMs: opts.timeoutMs,
    });
    latencyMs += result.latencyMs;
    if (result.ok) {
      return failures.length > 0
        ? { ...result, note: shorten(`Note: fell back to API key (${failures.join('; ')})`) }
        : result;
    }
    failures.push(`API key: ${result.message}`);
  }
  return {
    ok: false,
    used: lastLeg,
    latencyMs,
    message: failures.join(' '),
  };
}
