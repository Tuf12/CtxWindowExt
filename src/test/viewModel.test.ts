import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import { parseTraceJsonl } from '../trace/store';
import {
  buildViewModel,
  detailRun,
  resolveSourcePath,
  summarizeRun,
  toSectionView,
} from '../ui/viewModel';
import { FIXTURE_FULL_RUN, FIXTURE_MISMATCH_RUN, FIXTURE_MIXED_DOC } from './fixtures';

describe('summarizeRun / detailRun / toSectionView', () => {
  it('summarizes the full 7-kind fixture with computed totals', () => {
    const { runs } = parseTraceJsonl(FIXTURE_FULL_RUN);
    const summary = summarizeRun(runs[0]);
    assert.equal(summary.runId, '2026-10-28T12-00-00Z_py-demo_01');
    assert.equal(summary.sectionCount, 7);
    assert.equal(summary.totalChars, 1904);
    assert.equal(summary.totalTokensEst, 475);
    assert.equal(summary.versionMismatch, false);
  });

  it('carries tracer + contract versions into the detail for the banner', () => {
    const { runs } = parseTraceJsonl(FIXTURE_MISMATCH_RUN);
    const detail = detailRun(runs[0]);
    assert.equal(detail.tracerVersion, '0.2');
    assert.equal(detail.contractVersion, '0.1');
    assert.equal(detail.summary.versionMismatch, true);
  });

  it('strips the full body: section views expose displayBody only', () => {
    const { runs } = parseTraceJsonl(FIXTURE_MISMATCH_RUN);
    for (const section of runs[0].sections) {
      const view = toSectionView(section);
      assert.equal('body' in view, false);
      assert.equal(view.displayBody, section.displayBody);
      assert.equal(view.truncated, section.truncated);
    }
    // The 25K-char body arrives capped at the 20K display limit.
    assert.equal(runs[0].sections[0].body.length, 25000);
    assert.equal(toSectionView(runs[0].sections[0]).displayBody.length, 20000);
  });

  it('keeps stack entries for the section detail', () => {
    const { runs } = parseTraceJsonl(FIXTURE_FULL_RUN);
    const history = runs[0].sections.find((s) => s.id === 'hist-1');
    assert.ok(history);
    assert.deepEqual(toSectionView(history).stack, [
      'build_messages (app.py:88)',
      'send (app.py:120)',
    ]);
  });
});

describe('buildViewModel', () => {
  it('defaults to the latest run', () => {
    const { runs, warnings } = parseTraceJsonl(`${FIXTURE_FULL_RUN}\n${FIXTURE_MISMATCH_RUN}`);
    const model = buildViewModel(runs, warnings, { workspaceOpen: true });
    assert.equal(model.runs.length, 2);
    assert.equal(model.selectedRunId, '2026-10-28T12-05-00Z_ts-demo_01');
    assert.equal(model.detail?.summary.runId, '2026-10-28T12-05-00Z_ts-demo_01');
    assert.equal(model.empty, null);
  });

  it('honors an explicit selection while it exists', () => {
    const { runs, warnings } = parseTraceJsonl(`${FIXTURE_FULL_RUN}\n${FIXTURE_MISMATCH_RUN}`);
    const model = buildViewModel(runs, warnings, {
      selectedRunId: '2026-10-28T12-00-00Z_py-demo_01',
      workspaceOpen: true,
    });
    assert.equal(model.selectedRunId, '2026-10-28T12-00-00Z_py-demo_01');
    assert.equal(model.detail?.sections.length, 7);
  });

  it('falls back to latest when the selection is gone', () => {
    const { runs, warnings } = parseTraceJsonl(FIXTURE_FULL_RUN);
    const model = buildViewModel(runs, warnings, {
      selectedRunId: 'no-such-run',
      workspaceOpen: true,
    });
    assert.equal(model.selectedRunId, '2026-10-28T12-00-00Z_py-demo_01');
  });

  it('passes warnings through alongside valid runs', () => {
    const { runs, warnings } = parseTraceJsonl(FIXTURE_MIXED_DOC);
    const model = buildViewModel(runs, warnings, { workspaceOpen: true });
    assert.equal(model.runs.length, 2);
    assert.equal(model.empty, null);
    assert.deepEqual(
      model.warnings.map((w) => w.line),
      [2, 4],
    );
  });

  it('reports no-workspace when no folder is open', () => {
    const model = buildViewModel([], [], { workspaceOpen: false });
    assert.equal(model.empty, 'no-workspace');
    assert.equal(model.detail, null);
  });

  it('reports no-runs for an empty trace file', () => {
    const { runs, warnings } = parseTraceJsonl('');
    const model = buildViewModel(runs, warnings, { workspaceOpen: true });
    assert.equal(model.empty, 'no-runs');
  });

  it('reports all-skipped when every line failed to parse', () => {
    const { runs, warnings } = parseTraceJsonl('garbage{\nmore garbage{');
    assert.equal(runs.length, 0);
    const model = buildViewModel(runs, warnings, { workspaceOpen: true });
    assert.equal(model.empty, 'all-skipped');
    assert.equal(model.warnings.length, 2);
  });
});

describe('resolveSourcePath', () => {
  it('joins workspace-relative files onto the trace root', () => {
    assert.equal(
      resolveSourcePath('/ws/proj', 'prompts/system.py'),
      path.join('/ws/proj', 'prompts/system.py'),
    );
  });

  it('passes absolute paths through normalized', () => {
    const abs = path.join('/elsewhere', 'a.py');
    assert.equal(resolveSourcePath('/ws/proj', abs), abs);
  });
});
