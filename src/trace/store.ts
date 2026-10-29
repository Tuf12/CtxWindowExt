// Trace store: parses `.ctx-tracker/trace.jsonl` into display-ready runs.
// Pure module — no vscode import, headless-testable.
// Implements contract.md §1 (run record), §3 (chars exact, tokens_est
// estimated, no costs), §4 (version warn, not error).

export const CONTRACT_VERSION = '0.1';
export const MAX_BODY_CHARS = 20000;

export const SECTION_KINDS = [
  'system_prompt',
  'tools',
  'history',
  'user_message',
  'rag',
  'env',
  'other',
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export interface TraceSource {
  file: string;
  lines: [number, number];
}

export interface ParsedSection {
  id: string;
  label: string;
  kind: string;
  kindKnown: boolean;
  chars: number;
  /** Rough estimate — the UI must always label it estimated. */
  tokensEst: number;
  source: TraceSource;
  stack: string[];
  body: string;
  /** True when the tracer flagged truncation OR display capping applied. */
  truncated: boolean;
  displayBody: string;
}

export interface ParsedRun {
  runId: string;
  ts: string;
  project: string;
  tracerLang: string;
  tracerFile: string;
  tracerVersion: string;
  versionMismatch: boolean;
  modelName: string;
  sections: ParsedSection[];
  totalChars: number;
  totalTokensEst: number;
}

export interface ParseWarning {
  line: number;
  message: string;
}

/** v1 estimator: ceil(chars / 4). Rough by design — never exact. */
export function estimateTokens(chars: number): number {
  if (!Number.isFinite(chars) || chars <= 0) {
    return 0;
  }
  return Math.ceil(chars / 4);
}

/** Viewer-side body cap: past MAX_BODY_CHARS the display text is cut. */
export function truncateBody(body: string): { text: string; truncated: boolean } {
  if (body.length <= MAX_BODY_CHARS) {
    return { text: body, truncated: false };
  }
  return { text: body.slice(0, MAX_BODY_CHARS), truncated: true };
}

/** True when the tracer version does not match the contract (warn, not error). */
export function isVersionMismatch(tracerVersion: unknown): boolean {
  return typeof tracerVersion !== 'string' || tracerVersion !== CONTRACT_VERSION;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNonNegativeInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function parseSource(value: unknown): TraceSource {
  const record = asRecord(value);
  const file = asString(record?.file, '(unknown)');
  const rawLines = record?.lines;
  let lines: [number, number] = [1, 1];
  if (Array.isArray(rawLines) && rawLines.length >= 2) {
    const start = asNonNegativeInt(rawLines[0]) ?? 1;
    const end = asNonNegativeInt(rawLines[1]) ?? start;
    lines = [start, end];
  }
  return { file, lines };
}

function parseSection(value: unknown, index: number, line: number): { section: ParsedSection | null; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];
  const record = asRecord(value);
  if (!record) {
    warnings.push({ line, message: `section[${index}] is not an object, skipped` });
    return { section: null, warnings };
  }
  const kind = asString(record.kind, 'other');
  const kindKnown = SECTION_KINDS.includes(kind as SectionKind);
  if (!kindKnown) {
    warnings.push({ line, message: `section[${index}] has unknown kind "${kind}", shown as-is` });
  }
  const body = asString(record.body);
  const chars = asNonNegativeInt(record.chars) ?? body.length;
  const tokensEst = asNonNegativeInt(record.tokens_est) ?? estimateTokens(chars);
  const display = truncateBody(body);
  return {
    section: {
      id: asString(record.id, `sec-${index}`),
      label: asString(record.label, kind),
      kind,
      kindKnown,
      chars,
      tokensEst,
      source: parseSource(record.source),
      stack: asStringArray(record.stack),
      body,
      truncated: record.truncated === true || display.truncated,
      displayBody: display.text,
    },
    warnings,
  };
}

export function parseTraceLine(
  lineText: string,
  lineNumber: number,
): { run: ParsedRun | null; warnings: ParseWarning[] } {
  if (lineText.trim() === '') {
    return { run: null, warnings: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(lineText);
  } catch {
    return { run: null, warnings: [{ line: lineNumber, message: 'invalid JSON, line skipped' }] };
  }
  const record = asRecord(parsed);
  const runId = asString(record?.run_id);
  const rawSections = record?.sections;
  if (!record || runId === '' || !Array.isArray(rawSections)) {
    return {
      run: null,
      warnings: [{ line: lineNumber, message: 'missing run_id or sections array, line skipped' }],
    };
  }
  const warnings: ParseWarning[] = [];
  const sections: ParsedSection[] = [];
  rawSections.forEach((entry, index) => {
    const result = parseSection(entry, index, lineNumber);
    warnings.push(...result.warnings);
    if (result.section) {
      sections.push(result.section);
    }
  });
  const tracer = asRecord(record.tracer) ?? {};
  const model = asRecord(record.model) ?? {};
  const tracerVersion = asString(tracer.version);
  return {
    run: {
      runId,
      ts: asString(record.ts),
      project: asString(record.project),
      tracerLang: asString(tracer.lang),
      tracerFile: asString(tracer.file),
      tracerVersion,
      versionMismatch: isVersionMismatch(tracer.version),
      modelName: asString(model.name, 'unknown'),
      sections,
      totalChars: sections.reduce((sum, section) => sum + section.chars, 0),
      totalTokensEst: sections.reduce((sum, section) => sum + section.tokensEst, 0),
    },
    warnings,
  };
}

export function parseTraceJsonl(text: string): { runs: ParsedRun[]; warnings: ParseWarning[] } {
  const runs: ParsedRun[] = [];
  const warnings: ParseWarning[] = [];
  text.split('\n').forEach((lineText, index) => {
    const result = parseTraceLine(lineText, index + 1);
    if (result.run) {
      runs.push(result.run);
    }
    warnings.push(...result.warnings);
  });
  return { runs, warnings };
}
