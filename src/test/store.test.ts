import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRACT_VERSION,
  MAX_BODY_CHARS,
  estimateTokens,
  truncateBody,
  isVersionMismatch,
  parseTraceJsonl,
} from '../trace/store';
import { FIXTURE_FULL_RUN, FIXTURE_MISMATCH_RUN, FIXTURE_MIXED_DOC } from './fixtures';

describe('estimateTokens', () => {
  it('implements ceil(chars / 4)', () => {
    assert.equal(estimateTokens(0), 0);
    assert.equal(estimateTokens(1), 1);
    assert.equal(estimateTokens(4), 1);
    assert.equal(estimateTokens(5), 2);
    assert.equal(estimateTokens(1820), 455);
  });

  it('returns 0 for non-positive or non-finite input', () => {
    assert.equal(estimateTokens(-3), 0);
    assert.equal(estimateTokens(NaN), 0);
  });
});

describe('truncateBody', () => {
  it('passes short bodies through untouched', () => {
    const body = 'x'.repeat(MAX_BODY_CHARS);
    assert.deepEqual(truncateBody(body), { text: body, truncated: false });
  });

  it('caps bodies past 20K chars', () => {
    const body = 'y'.repeat(MAX_BODY_CHARS + 1);
    const result = truncateBody(body);
    assert.equal(result.text.length, MAX_BODY_CHARS);
    assert.equal(result.truncated, true);
  });
});

describe('isVersionMismatch', () => {
  it('matches the contract version exactly', () => {
    assert.equal(CONTRACT_VERSION, '0.1');
    assert.equal(isVersionMismatch('0.1'), false);
    assert.equal(isVersionMismatch('0.2'), true);
    assert.equal(isVersionMismatch(undefined), true);
  });
});

describe('parseTraceJsonl', () => {
  it('parses the full 7-kind fixture with computed totals', () => {
    const { runs, warnings } = parseTraceJsonl(FIXTURE_FULL_RUN);
    assert.equal(warnings.length, 0);
    assert.equal(runs.length, 1);
    const run = runs[0];
    assert.equal(run.runId, '2026-10-28T12-00-00Z_py-demo_01');
    assert.equal(run.versionMismatch, false);
    assert.deepEqual(
      run.sections.map((s) => s.kind),
      ['system_prompt', 'tools', 'history', 'user_message', 'rag', 'env', 'other'],
    );
    assert.ok(run.sections.every((s) => s.kindKnown));
    // Store recomputes totals from sections (fixture's stored 476 is ignored).
    assert.equal(run.totalChars, 1904);
    assert.equal(run.totalTokensEst, 475);
  });

  it('falls back to body length for chars and estimator for tokens', () => {
    const { runs } = parseTraceJsonl(FIXTURE_FULL_RUN);
    const env = runs[0].sections[5];
    assert.equal(env.kind, 'env');
    assert.equal(env.chars, 60);
    assert.equal(env.tokensEst, 15);
  });

  it('keeps the tracer token count when it knows better', () => {
    const { runs } = parseTraceJsonl(FIXTURE_FULL_RUN);
    const other = runs[0].sections[6];
    assert.equal(other.tokensEst, 10);
  });

  it('preserves redacted bodies verbatim', () => {
    const { runs } = parseTraceJsonl(FIXTURE_FULL_RUN);
    const tools = runs[0].sections[1];
    assert.equal(tools.body, 'Authorization: [REDACTED]');
  });

  it('flags version mismatch without failing the run', () => {
    const { runs, warnings } = parseTraceJsonl(FIXTURE_MISMATCH_RUN);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].versionMismatch, true);
    assert.equal(runs[0].tracerVersion, '0.2');
    assert.ok(warnings.length >= 1); // unknown-kind warning below, not a version error
  });

  it('caps the 25K body for display and keeps it truncated', () => {
    const { runs } = parseTraceJsonl(FIXTURE_MISMATCH_RUN);
    const big = runs[0].sections[0];
    assert.equal(big.body.length, 25000);
    assert.equal(big.displayBody.length, MAX_BODY_CHARS);
    assert.equal(big.truncated, true);
  });

  it('warns on unknown kinds but shows them as-is', () => {
    const { runs, warnings } = parseTraceJsonl(FIXTURE_MISMATCH_RUN);
    const weird = runs[0].sections[1];
    assert.equal(weird.kind, 'prompt_cache');
    assert.equal(weird.kindKnown, false);
    assert.ok(warnings.some((w) => w.message.includes('prompt_cache')));
  });

  it('skips bad lines with warnings and keeps good runs', () => {
    const { runs, warnings } = parseTraceJsonl(FIXTURE_MIXED_DOC);
    assert.deepEqual(
      runs.map((r) => r.runId),
      ['run-a', 'run-b'],
    );
    assert.equal(warnings.length, 2);
    assert.deepEqual(
      warnings.map((w) => w.line),
      [2, 4],
    );
    assert.ok(warnings[0].message.includes('invalid JSON'));
    assert.ok(warnings[1].message.includes('missing run_id'));
  });
});
