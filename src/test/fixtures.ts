// Hand-written trace fixtures implementing contract.md §1.
// Built with JSON.stringify so the JSONL is exactly what a tracer would emit.

const line = (value: unknown): string => JSON.stringify(value);

// One run covering all 7 section kinds. Expected totals:
//   chars: 120+200+400+80+1000+60+44 = 1904
//   tokens: 30+50+100+20+250+15+10 = 475 (last section keeps tracer's own 10)
export const FIXTURE_FULL_RUN: string = line({
  run_id: '2026-10-28T12-00-00Z_py-demo_01',
  ts: '2026-10-28T12:00:00Z',
  project: 'py-demo',
  tracer: { lang: 'python', file: 'ctx_trace.py', version: '0.1' },
  model: { name: 'user-model (any)', endpoint: 'not-recorded' },
  sections: [
    {
      id: 'sys-1',
      label: 'system_prompt',
      kind: 'system_prompt',
      chars: 120,
      source: { file: 'prompts/system.py', lines: [1, 40] },
      stack: ['build_messages (app.py:88)'],
      body: 'You are a helpful assistant.',
      truncated: false,
    },
    {
      id: 'tools-1',
      label: 'tools:search',
      kind: 'tools',
      chars: 200,
      source: { file: 'tools/search.py', lines: [10, 30] },
      stack: [],
      body: 'Authorization: [REDACTED]',
      truncated: false,
    },
    {
      id: 'hist-1',
      label: 'history',
      kind: 'history',
      chars: 400,
      source: { file: 'app.py', lines: [80, 95] },
      stack: ['build_messages (app.py:88)', 'send (app.py:120)'],
      body: 'prior turns...',
      truncated: false,
    },
    {
      id: 'user-1',
      label: 'user_message',
      kind: 'user_message',
      chars: 80,
      source: { file: 'app.py', lines: [118, 120] },
      stack: ['send (app.py:120)'],
      body: 'Summarize the notes.',
      truncated: false,
    },
    {
      id: 'rag-1',
      label: 'rag:notes-index',
      kind: 'rag',
      chars: 1000,
      source: { file: 'rag/retrieve.py', lines: [5, 50] },
      stack: ['retrieve (rag/retrieve.py:44)'],
      body: 'retrieved chunk...',
      truncated: false,
    },
    {
      id: 'env-1',
      label: 'env',
      kind: 'env',
      // chars omitted on purpose: store must fall back to body length (60).
      source: { file: 'config/env.py', lines: [1, 12] },
      stack: [],
      body: 'k=v;'.repeat(15),
      truncated: false,
    },
    {
      id: 'other-1',
      label: 'other:debug',
      kind: 'other',
      chars: 44,
      tokens_est: 10,
      source: { file: 'debug.py', lines: [3, 9] },
      stack: [],
      body: 'debug context',
      truncated: false,
    },
  ],
  totals: { chars: 1904, tokens_est: 476 },
});

// Tracer one minor version ahead: viewer must warn, not error.
export const FIXTURE_MISMATCH_RUN: string = line({
  run_id: '2026-10-28T12-05-00Z_ts-demo_01',
  ts: '2026-10-28T12:05:00Z',
  project: 'ts-demo',
  tracer: { lang: 'typescript', file: 'ctxTrace.ts', version: '0.2' },
  model: { name: 'user-model (any)', endpoint: 'not-recorded' },
  sections: [
    {
      id: 'big-1',
      label: 'rag:full-corpus',
      kind: 'rag',
      chars: 25000,
      source: { file: 'src/rag.ts', lines: [1, 200] },
      stack: [],
      body: 'A'.repeat(25000),
      truncated: true,
    },
    {
      id: 'weird-1',
      label: 'prompt_cache',
      kind: 'prompt_cache',
      chars: 40,
      source: { file: 'src/cache.ts', lines: [7, 9] },
      stack: [],
      body: 'cached prefix',
      truncated: false,
    },
  ],
  totals: { chars: 25040, tokens_est: 6260 },
});

// Mixed doc: valid run, garbage line, blank line, run missing sections, minimal run.
// Expected: 2 runs, 2 warnings (lines 2 and 4); line 3 ignored silently.
export const FIXTURE_MIXED_DOC: string = [
  line({
    run_id: 'run-a',
    ts: '2026-10-28T12:10:00Z',
    project: 'p',
    tracer: { lang: 'python', file: 'ctx_trace.py', version: '0.1' },
    model: { name: 'm', endpoint: 'not-recorded' },
    sections: [],
    totals: { chars: 0, tokens_est: 0 },
  }),
  'this is not json{',
  '',
  line({ run_id: 'run-broken', ts: '2026-10-28T12:11:00Z' }),
  line({
    run_id: 'run-b',
    ts: '2026-10-28T12:12:00Z',
    project: 'p',
    tracer: { lang: 'python', file: 'ctx_trace.py', version: '0.1' },
    model: { name: 'm', endpoint: 'not-recorded' },
    sections: [
      {
        id: 's-1',
        label: 'history',
        kind: 'history',
        chars: 8,
        source: { file: 'a.py', lines: [1, 2] },
        stack: [],
        body: 'hi there',
        truncated: false,
      },
    ],
    totals: { chars: 8, tokens_est: 2 },
  }),
].join('\n');
