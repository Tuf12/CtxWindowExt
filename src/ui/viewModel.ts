// Trace viewer view-model: shapes parsed runs into exactly what the webview needs.
// Pure module — no vscode import, headless-testable.
// Enforces contract.md §3 (chars exact, tokens_est estimated, no costs) and the
// Phase 3 payload rule: displayBody only — the full body never crosses to the webview.

import * as path from 'path';
import { CONTRACT_VERSION, ParsedRun, ParsedSection, ParseWarning } from '../trace/store';

export interface RunSummary {
  runId: string;
  ts: string;
  project: string;
  modelName: string;
  sectionCount: number;
  totalChars: number;
  totalTokensEst: number;
  versionMismatch: boolean;
}

export interface SectionView {
  id: string;
  label: string;
  kind: string;
  kindKnown: boolean;
  chars: number;
  /** Rough estimate — the UI must always label it estimated. */
  tokensEst: number;
  source: { file: string; lines: [number, number] };
  stack: string[];
  displayBody: string;
  truncated: boolean;
}

export interface RunDetailView {
  summary: RunSummary;
  tracerLang: string;
  tracerFile: string;
  tracerVersion: string;
  contractVersion: string;
  sections: SectionView[];
}

export type EmptyReason = 'no-workspace' | 'no-runs' | 'all-skipped';

export interface ViewerModel {
  runs: RunSummary[];
  selectedRunId: string | null;
  detail: RunDetailView | null;
  warnings: ParseWarning[];
  empty: EmptyReason | null;
}

export function summarizeRun(run: ParsedRun): RunSummary {
  return {
    runId: run.runId,
    ts: run.ts,
    project: run.project,
    modelName: run.modelName,
    sectionCount: run.sections.length,
    totalChars: run.totalChars,
    totalTokensEst: run.totalTokensEst,
    versionMismatch: run.versionMismatch,
  };
}

export function toSectionView(section: ParsedSection): SectionView {
  // NOTE: `body` is deliberately dropped — the webview only ever sees displayBody.
  return {
    id: section.id,
    label: section.label,
    kind: section.kind,
    kindKnown: section.kindKnown,
    chars: section.chars,
    tokensEst: section.tokensEst,
    source: { file: section.source.file, lines: [section.source.lines[0], section.source.lines[1]] },
    stack: [...section.stack],
    displayBody: section.displayBody,
    truncated: section.truncated,
  };
}

export function detailRun(run: ParsedRun): RunDetailView {
  return {
    summary: summarizeRun(run),
    tracerLang: run.tracerLang,
    tracerFile: run.tracerFile,
    tracerVersion: run.tracerVersion,
    contractVersion: CONTRACT_VERSION,
    sections: run.sections.map(toSectionView),
  };
}

export function buildViewModel(
  runs: ParsedRun[],
  warnings: ParseWarning[],
  opts: { selectedRunId?: string | null; workspaceOpen: boolean },
): ViewerModel {
  const summaries = runs.map(summarizeRun);
  if (summaries.length === 0) {
    return {
      runs: [],
      selectedRunId: null,
      detail: null,
      warnings,
      empty: opts.workspaceOpen ? (warnings.length > 0 ? 'all-skipped' : 'no-runs') : 'no-workspace',
    };
  }
  // Latest run (last appended line) is the default; an explicit selection wins
  // when it still exists, otherwise fall back to latest.
  let selected: ParsedRun | undefined;
  if (opts.selectedRunId) {
    selected = runs.find((run) => run.runId === opts.selectedRunId);
  }
  selected ??= runs[runs.length - 1];
  return {
    runs: summaries,
    selectedRunId: selected.runId,
    detail: detailRun(selected),
    warnings,
    empty: null,
  };
}

/**
 * Resolve a workspace-relative contract `source.file` against the workspace
 * root that owns the trace file. Absolute paths pass through normalized.
 */
export function resolveSourcePath(rootFsPath: string, sourceFile: string): string {
  if (path.isAbsolute(sourceFile)) {
    return path.normalize(sourceFile);
  }
  return path.join(rootFsPath, sourceFile);
}
