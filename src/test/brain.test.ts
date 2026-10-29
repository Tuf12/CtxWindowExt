import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { testBrainConnection } from '../provider/brain';
import { Runner } from '../provider/cli';
import { TestConnectionResult } from '../provider/meta';

const okCliRunner: Runner = async () => ({
  stdout: `${JSON.stringify({ type: 'result', text: 'OK' })}\n`,
  stderr: '',
  exitCode: 0,
});

const failCliRunner: Runner = async () => ({ stdout: '', stderr: 'boom', exitCode: 2 });

const mustNotRunCli: Runner = async () => {
  throw new Error('CLI leg must not run');
};

const okMeta = async (): Promise<TestConnectionResult> => ({
  ok: true,
  used: 'meta',
  latencyMs: 3,
  reply: 'OK',
  message: 'meta ok',
});

const mustNotCallMeta = async (): Promise<TestConnectionResult> => {
  throw new Error('meta leg must not run');
};

const withBin = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-brain-'));
  const bin = path.join(dir, 'muse');
  fs.writeFileSync(bin, '#!/bin/sh\n');
  return bin;
};

describe('testBrainConnection', () => {
  it('auto uses the CLI when it answers and never touches meta', async () => {
    const result = await testBrainConnection(
      { provider: 'auto', baseURL: '', model: '', cliPath: withBin() },
      { runner: okCliRunner, metaTest: mustNotCallMeta },
    );
    assert.equal(result.ok, true);
    assert.equal(result.used, 'cli');
    assert.equal(result.note, undefined);
  });

  it('auto falls back to the API key with a note when the CLI fails', async () => {
    const result = await testBrainConnection(
      { provider: 'auto', apiKey: 'k', baseURL: 'b', model: 'm', cliPath: withBin() },
      { runner: failCliRunner, metaTest: okMeta },
    );
    assert.equal(result.ok, true);
    assert.equal(result.used, 'meta');
    assert.ok(result.note?.includes('fell back'));
  });

  it('auto reports both legs when everything fails', async () => {
    const result = await testBrainConnection(
      { provider: 'auto', baseURL: '', model: '' },
      { runner: failCliRunner },
    );
    assert.equal(result.ok, false);
    assert.ok(result.message.includes('Muse CLI'));
    assert.ok(result.message.includes('API key'));
  });

  it('pinned cli never falls back', async () => {
    const result = await testBrainConnection(
      { provider: 'cli', apiKey: 'k', baseURL: '', model: '', cliPath: '/definitely/not/here' },
      { metaTest: mustNotCallMeta },
    );
    assert.equal(result.ok, false);
    assert.ok(result.message.includes('not found'));
  });

  it('pinned meta uses the key path only', async () => {
    const result = await testBrainConnection(
      { provider: 'meta', apiKey: 'k', baseURL: 'b', model: 'm' },
      { runner: mustNotRunCli, metaTest: okMeta },
    );
    assert.equal(result.ok, true);
    assert.equal(result.used, 'meta');
  });

  it('pinned meta without a key asks for one', async () => {
    const result = await testBrainConnection({ provider: 'meta', baseURL: 'b', model: 'm' });
    assert.equal(result.ok, false);
    assert.ok(result.message.includes('Muse CLI'));
  });

  it('unknown provider strings resolve to auto', async () => {
    const result = await testBrainConnection(
      { provider: 'wat', baseURL: '', model: '', cliPath: withBin() },
      { runner: okCliRunner },
    );
    assert.equal(result.ok, true);
    assert.equal(result.used, 'cli');
  });
});
