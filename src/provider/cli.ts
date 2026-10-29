// Muse CLI passthrough brain (`muse exec`).
// Auth rides on the user's existing CLI login: no API key is ever passed
// (never --api-key-stdin) or read here.
// The only impure dependency is an injectable runner, so this module stays
// headless-testable without the CLI installed.

import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ProviderId } from './registry';

export interface CliRunOptions {
  prompt: string;
  model?: string;
  timeoutMs?: number;
  cliPath?: string;
  effort?: string;
  maxSteps?: number;
}

export interface CliRunResult {
  ok: boolean;
  used: ProviderId;
  reply: string;
  latencyMs: number;
  message: string;
}

export interface CliAvailability {
  found: boolean;
  path?: string;
  version?: string;
}

export interface RunnerResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type Runner = (
  file: string,
  args: string[],
  timeoutMs: number,
) => Promise<RunnerResult>;

/** argv for a headless single-prompt run. Prompt goes last (positional). */
export function buildExecArgs(opts: {
  prompt: string;
  model?: string;
  effort?: string;
  maxSteps?: number;
}): string[] {
  const args = [
    'exec',
    '--json',
    '--reasoning-effort',
    opts.effort ?? 'minimal',
    '--max-model-steps',
    String(opts.maxSteps ?? 1),
  ];
  if (opts.model?.trim()) {
    args.push('--model', opts.model.trim());
  }
  args.push(opts.prompt);
  return args;
}

const EXECUTABLE_NAMES =
  process.platform === 'win32' ? ['muse', 'muse.cmd'] : ['muse'];

/**
 * Locate the CLI: explicit setting first, then PATH, then well-known
 * install dirs (VS Code's GUI-launched PATH often lacks ~/.local/bin).
 */
export function resolveCliPath(opts: {
  explicit?: string;
  pathEnv?: string;
  homedir?: string;
  existsSync?: (p: string) => boolean;
} = {}): string | null {
  const exists = opts.existsSync ?? fs.existsSync;
  const isFile = (p: string): boolean => {
    try {
      return exists(p) && !fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  };
  if (opts.explicit?.trim()) {
    const explicit = opts.explicit.trim();
    return isFile(explicit) ? explicit : null;
  }
  const home = opts.homedir ?? os.homedir();
  const dirs = [
    ...(opts.pathEnv ?? process.env.PATH ?? '').split(path.delimiter).filter(Boolean),
    path.join(home, '.local', 'bin'),
    path.join(home, 'bin'),
    '/usr/local/bin',
  ];
  for (const dir of dirs) {
    for (const name of EXECUTABLE_NAMES) {
      const candidate = path.join(dir, name);
      if (isFile(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

const TEXT_FIELDS = ['text', 'content', 'message', 'result', 'output', 'answer', 'reply'];
const DELTA_FIELDS = ['delta', 'text_delta', 'content_delta'];
const RESULT_TYPES = /^(result|final|complete|completed|done|answer|message|assistant|output)$/i;

function firstString(record: Record<string, unknown>, fields: string[]): string {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return '';
}

function nestedText(record: Record<string, unknown>): string {
  for (const wrapper of ['payload', 'data', 'result']) {
    const inner = record[wrapper];
    if (typeof inner === 'object' && inner !== null && !Array.isArray(inner)) {
      const text = firstString(inner as Record<string, unknown>, TEXT_FIELDS);
      if (text) {
        return text;
      }
    }
  }
  return '';
}

/**
 * Extract the final reply from `muse exec --json` JSONL.
 * Defensive by necessity: the event schema is consumed as observed, and
 * plain (non-JSON) stdout falls back to trimmed raw text.
 */
export function extractExecReply(stdout: string): string {
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  let lastFull = '';
  let deltas = '';
  let sawJson = false;
  for (const line of lines) {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof event !== 'object' || event === null || Array.isArray(event)) {
      continue;
    }
    sawJson = true;
    const record = event as Record<string, unknown>;
    const kind = [record.type, record.event, record.kind, record.name].find(
      (value): value is string => typeof value === 'string',
    );
    const full = firstString(record, TEXT_FIELDS) || nestedText(record);
    if (kind && RESULT_TYPES.test(kind) && full) {
      lastFull = full;
      continue;
    }
    const delta = firstString(record, DELTA_FIELDS);
    if (delta) {
      deltas += delta;
    } else if (full) {
      lastFull = full;
    }
  }
  if (lastFull) {
    return lastFull;
  }
  if (deltas) {
    return deltas;
  }
  return sawJson ? '' : stdout.trim();
}

export const defaultRunner: Runner = (file, args, timeoutMs) =>
  new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ stdout, stderr, exitCode: 0 });
          return;
        }
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
          reject(new CliNotFoundError(file));
          return;
        }
        if (error.killed) {
          reject(new CliTimeoutError(timeoutMs));
          return;
        }
        resolve({ stdout, stderr, exitCode: (error as { code?: number }).code ?? 1 });
      },
    );
  });

export class CliNotFoundError extends Error {}
export class CliTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Muse CLI timed out after ${timeoutMs} ms.`);
  }
}

export async function checkCli(
  cliPath?: string,
  runner: Runner = defaultRunner,
): Promise<CliAvailability> {
  const resolved = resolveCliPath({ explicit: cliPath });
  if (!resolved) {
    return { found: false };
  }
  try {
    const { stdout, exitCode } = await runner(resolved, ['--version'], 10000);
    if (exitCode !== 0) {
      return { found: true, path: resolved };
    }
    return { found: true, path: resolved, version: stdout.trim().split('\n')[0] };
  } catch {
    return { found: true, path: resolved };
  }
}

export async function runCli(
  opts: CliRunOptions,
  runner: Runner = defaultRunner,
): Promise<CliRunResult> {
  const started = Date.now();
  const resolved = resolveCliPath({ explicit: opts.cliPath });
  if (!resolved) {
    return {
      ok: false,
      used: 'cli',
      reply: '',
      latencyMs: Date.now() - started,
      message:
        'Muse CLI not found. Install it and log in from your terminal, or set "CtxWindowExt: Cli Path" to its location.',
    };
  }
  const timeoutMs = opts.timeoutMs ?? 120000;
  let result: RunnerResult;
  try {
    result = await runner(resolved, buildExecArgs(opts), timeoutMs);
  } catch (err) {
    if (err instanceof CliNotFoundError) {
      return {
        ok: false,
        used: 'cli',
        reply: '',
        latencyMs: Date.now() - started,
        message: `Muse CLI not found at ${resolved}. Check "CtxWindowExt: Cli Path".`,
      };
    }
    return {
      ok: false,
      used: 'cli',
      reply: '',
      latencyMs: Date.now() - started,
      message: err instanceof Error ? err.message : 'Muse CLI run failed.',
    };
  }
  const latencyMs = Date.now() - started;
  if (result.exitCode !== 0) {
    const detail = result.stderr.trim().split('\n').slice(-3).join(' ').trim();
    return {
      ok: false,
      used: 'cli',
      reply: '',
      latencyMs,
      message: `Muse CLI exited with code ${result.exitCode}.${detail ? ` ${detail}` : ''}`,
    };
  }
  const reply = extractExecReply(result.stdout);
  if (!reply) {
    const sample = result.stdout.trim().slice(0, 200);
    return {
      ok: false,
      used: 'cli',
      reply: '',
      latencyMs,
      message: `Muse CLI produced output this version could not parse.${sample ? ` Starts with: ${sample}` : ''}`,
    };
  }
  return { ok: true, used: 'cli', reply, latencyMs, message: `Muse CLI replied in ${latencyMs} ms.` };
}

/** Minimal smoke prompt used by Test Connection. */
export function testCliConnection(
  opts: { cliPath?: string; timeoutMs?: number } = {},
  runner: Runner = defaultRunner,
): Promise<CliRunResult> {
  return runCli(
    { prompt: 'Reply with exactly: OK', timeoutMs: opts.timeoutMs, cliPath: opts.cliPath },
    runner,
  );
}
