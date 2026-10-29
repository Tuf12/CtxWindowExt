import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildExecArgs,
  checkCli,
  CliNotFoundError,
  CliTimeoutError,
  extractExecReply,
  resolveCliPath,
  runCli,
  Runner,
  testCliConnection,
} from '../provider/cli';

describe('buildExecArgs', () => {
  it('runs headless JSON with a cheap smoke shape and the prompt last', () => {
    assert.deepEqual(buildExecArgs({ prompt: 'hi' }), [
      'exec',
      '--json',
      '--reasoning-effort',
      'minimal',
      '--max-model-steps',
      '1',
      'hi',
    ]);
  });

  it('passes an explicit model through', () => {
    const args = buildExecArgs({ prompt: 'hi', model: 'custom-model' });
    assert.ok(args.includes('--model'));
    assert.ok(args.includes('custom-model'));
    assert.equal(args[args.length - 1], 'hi');
  });
});

describe('resolveCliPath', () => {
  const tmpHome = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-cli-'));

  it('honors an explicit path that exists', () => {
    const dir = tmpHome();
    const bin = path.join(dir, 'muse');
    fs.writeFileSync(bin, '#!/bin/sh\n');
    assert.equal(resolveCliPath({ explicit: bin }), bin);
  });

  it('rejects an explicit path that is missing', () => {
    assert.equal(resolveCliPath({ explicit: path.join(tmpHome(), 'nope') }), null);
  });

  it('finds the CLI on PATH', () => {
    const dir = tmpHome();
    fs.writeFileSync(path.join(dir, 'muse'), '#!/bin/sh\n');
    assert.equal(
      resolveCliPath({ pathEnv: `/nowhere${path.delimiter}${dir}`, homedir: tmpHome() }),
      path.join(dir, 'muse'),
    );
  });

  it('falls back to ~/.local/bin when PATH lacks it', () => {
    const home = tmpHome();
    const bindir = path.join(home, '.local', 'bin');
    fs.mkdirSync(bindir, { recursive: true });
    fs.writeFileSync(path.join(bindir, 'muse'), '#!/bin/sh\n');
    assert.equal(
      resolveCliPath({ pathEnv: '/nowhere', homedir: home }),
      path.join(bindir, 'muse'),
    );
  });

  it('returns null when nothing matches', () => {
    assert.equal(resolveCliPath({ pathEnv: '/nowhere', homedir: tmpHome() }), null);
  });
});

describe('extractExecReply', () => {
  it('prefers a result-typed event', () => {
    const stdout = [
      JSON.stringify({ type: 'status', text: 'working' }),
      JSON.stringify({ type: 'result', text: 'OK' }),
    ].join('\n');
    assert.equal(extractExecReply(stdout), 'OK');
  });

  it('reads one level of nesting', () => {
    const stdout = JSON.stringify({ type: 'done', payload: { content: 'nested reply' } });
    assert.equal(extractExecReply(stdout), 'nested reply');
  });

  it('concatenates streaming deltas when no full text exists', () => {
    const stdout = [
      JSON.stringify({ type: 'delta', delta: 'Hel' }),
      JSON.stringify({ type: 'delta', delta: 'lo' }),
    ].join('\n');
    assert.equal(extractExecReply(stdout), 'Hello');
  });

  it('falls back to raw text when stdout is not JSONL', () => {
    assert.equal(extractExecReply('  plain reply\n'), 'plain reply');
  });

  it('returns empty for unrecognized JSON so the caller can report it', () => {
    assert.equal(extractExecReply(JSON.stringify({ type: 'heartbeat', n: 3 })), '');
    assert.equal(extractExecReply(''), '');
  });
});

describe('runCli', () => {
  const okRunner: Runner = async () => ({
    stdout: `${JSON.stringify({ type: 'result', text: 'OK' })}\n`,
    stderr: '',
    exitCode: 0,
  });

  const withBin = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-cli-'));
    const bin = path.join(dir, 'muse');
    fs.writeFileSync(bin, '#!/bin/sh\n');
    return bin;
  };

  it('reports the reply on success', async () => {
    const result = await runCli({ prompt: 'hi', cliPath: withBin() }, okRunner);
    assert.equal(result.ok, true);
    assert.equal(result.reply, 'OK');
  });

  it('fails when no CLI resolves', async () => {
    let calls = 0;
    const counting: Runner = async () => {
      calls++;
      return { stdout: '', stderr: '', exitCode: 0 };
    };
    const result = await runCli(
      { prompt: 'hi', cliPath: path.join(os.tmpdir(), 'ctx-cli-missing') },
      counting,
    );
    assert.equal(result.ok, false);
    assert.equal(calls, 0);
    assert.ok(result.message.includes('not found'));
  });

  it('surfaces nonzero exits with the stderr tail', async () => {
    const failing: Runner = async () => ({ stdout: '', stderr: 'a\nb\nboom', exitCode: 2 });
    const result = await runCli({ prompt: 'hi', cliPath: withBin() }, failing);
    assert.equal(result.ok, false);
    assert.ok(result.message.includes('code 2'));
    assert.ok(result.message.includes('boom'));
  });

  it('maps runner failures to messages', async () => {
    const missing: Runner = async () => {
      throw new CliNotFoundError('x');
    };
    const notFound = await runCli({ prompt: 'hi', cliPath: withBin() }, missing);
    assert.equal(notFound.ok, false);
    assert.ok(notFound.message.includes('not found'));

    const slow: Runner = async () => {
      throw new CliTimeoutError(5);
    };
    const timedOut = await runCli({ prompt: 'hi', cliPath: withBin() }, slow);
    assert.equal(timedOut.ok, false);
    assert.ok(timedOut.message.includes('timed out'));
  });

  it('reports unparseable output with a sample', async () => {
    const weird: Runner = async () => ({
      stdout: `${JSON.stringify({ type: 'heartbeat' })}\n`,
      stderr: '',
      exitCode: 0,
    });
    const result = await runCli({ prompt: 'hi', cliPath: withBin() }, weird);
    assert.equal(result.ok, false);
    assert.ok(result.message.includes('could not parse'));
  });
});

describe('checkCli', () => {
  it('reports path and version when the CLI answers', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-cli-'));
    const bin = path.join(dir, 'muse');
    fs.writeFileSync(bin, '#!/bin/sh\n');
    const runner: Runner = async () => ({ stdout: 'muse 1.2.3\n', stderr: '', exitCode: 0 });
    assert.deepEqual(await checkCli(bin, runner), {
      found: true,
      path: bin,
      version: 'muse 1.2.3',
    });
  });

  it('reports missing when nothing resolves', async () => {
    const runner: Runner = async () => ({ stdout: '', stderr: '', exitCode: 0 });
    assert.deepEqual(
      await checkCli(path.join(os.tmpdir(), 'ctx-cli-missing'), runner),
      { found: false },
    );
  });
});

describe('testCliConnection', () => {
  it('sends the fixed smoke prompt', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-cli-'));
    const bin = path.join(dir, 'muse');
    fs.writeFileSync(bin, '#!/bin/sh\n');
    let seenArgs: string[] = [];
    const runner: Runner = async (_file, args) => {
      seenArgs = args;
      return { stdout: 'OK\n', stderr: '', exitCode: 0 };
    };
    const result = await testCliConnection({ cliPath: bin }, runner);
    assert.equal(result.ok, true);
    assert.equal(seenArgs[seenArgs.length - 1], 'Reply with exactly: OK');
  });
});
