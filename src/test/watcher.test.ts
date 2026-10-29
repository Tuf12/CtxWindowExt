import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { watchTraceFile, TraceUpdate } from '../trace/watcher';
import { FIXTURE_FULL_RUN, FIXTURE_MISMATCH_RUN } from './fixtures';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
  label: string,
): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(`timed out waiting for: ${label}`);
    }
    await sleep(25);
  }
}

describe('watchTraceFile', () => {
  let dir = '';
  let traceFile = '';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-trace-test-'));
    traceFile = path.join(dir, 'trace.jsonl');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('refreshes an existing file into parsed runs', async () => {
    fs.writeFileSync(traceFile, `${FIXTURE_FULL_RUN}\n`);
    const updates: TraceUpdate[] = [];
    const watcher = watchTraceFile(traceFile, {
      onUpdate: (update) => updates.push(update),
    });
    try {
      await watcher.refresh();
      assert.equal(updates.length, 1);
      assert.equal(updates[0].runs.length, 1);
      assert.equal(updates[0].runs[0].totalChars, 1904);
    } finally {
      watcher.dispose();
    }
  });

  it('treats a missing file as empty, not an error', async () => {
    const updates: TraceUpdate[] = [];
    const errors: Error[] = [];
    const watcher = watchTraceFile(traceFile, {
      onUpdate: (update) => updates.push(update),
      onError: (err) => errors.push(err),
    });
    try {
      await watcher.refresh();
      assert.equal(errors.length, 0);
      assert.equal(updates.length, 1);
      assert.deepEqual(updates[0].runs, []);
    } finally {
      watcher.dispose();
    }
  });

  it('emits an update when a run is appended', async () => {
    fs.writeFileSync(traceFile, `${FIXTURE_FULL_RUN}\n`);
    const updates: TraceUpdate[] = [];
    const watcher = watchTraceFile(
      traceFile,
      { onUpdate: (update) => updates.push(update) },
      { debounceMs: 20 },
    );
    try {
      await watcher.refresh();
      assert.equal(updates.length, 1);
      fs.appendFileSync(traceFile, `${FIXTURE_MISMATCH_RUN}\n`);
      await waitFor(() => updates.length >= 2, 5000, 'append update');
      const latest = updates[updates.length - 1];
      assert.equal(latest.runs.length, 2);
      assert.equal(latest.runs[1].versionMismatch, true);
    } finally {
      watcher.dispose();
    }
  });

  it('stops emitting after dispose', async () => {
    fs.writeFileSync(traceFile, `${FIXTURE_FULL_RUN}\n`);
    const updates: TraceUpdate[] = [];
    const watcher = watchTraceFile(
      traceFile,
      { onUpdate: (update) => updates.push(update) },
      { debounceMs: 20 },
    );
    await watcher.refresh();
    assert.equal(updates.length, 1);
    watcher.dispose();
    fs.appendFileSync(traceFile, `${FIXTURE_MISMATCH_RUN}\n`);
    await sleep(250);
    assert.equal(updates.length, 1);
  });

  it('reports watching a missing directory as an error, refresh still works', async () => {
    const missing = path.join(dir, 'nope', 'trace.jsonl');
    const updates: TraceUpdate[] = [];
    const errors: Error[] = [];
    const watcher = watchTraceFile(missing, {
      onUpdate: (update) => updates.push(update),
      onError: (err) => errors.push(err),
    });
    try {
      assert.equal(errors.length, 1);
      await watcher.refresh();
      assert.equal(updates.length, 1);
      assert.deepEqual(updates[0].runs, []);
    } finally {
      watcher.dispose();
    }
  });
});
