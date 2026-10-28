# Contract (fixed — agent must obey)

v0.1. This is the one piece Muse must not reinvent per project. If the tracer output or install breaks this file, the install is invalid.

## 1. Trace file

- Path: `<project>/.ctx-tracker/trace.jsonl` (append-only, one JSON object per line, one line per run).
- Encoding: UTF-8. Large bodies allowed; viewer truncates past 20K chars per section with `truncated: true`.

### Run record (one line)

```json
{
  "run_id": "2026-10-27T08-30-00Z_py-demo_01",
  "ts": "2026-10-27T08:30:00Z",
  "project": "py-demo",
  "tracer": { "lang": "python", "file": "ctx_trace.py", "version": "0.1" },
  "model": { "name": "user-model (any)", "endpoint": "not-recorded" },
  "sections": [
    {
      "id": "sys-1",
      "label": "system_prompt",
      "kind": "system_prompt",
      "chars": 1820,
      "tokens_est": 455,
      "source": { "file": "prompts/system.py", "lines": [1, 40] },
      "stack": ["build_messages (app.py:88)", "send (app.py:120)"],
      "body": "You are...",
      "truncated": false
    }
  ],
  "totals": { "chars": 1820, "tokens_est": 455 }
}
```

### Rules

- `kind` must be one of: `system_prompt | tools | history | user_message | rag | env | other`.
- `label` is free text but should start with the kind (e.g. `rag:notes-index`).
- `source.file` is workspace-relative. `lines` is `[start, end]` 1-based, best effort.
- `tokens_est` = `ceil(chars / 4)` in v1 unless the tracer knows better; viewer labels it estimated.
- No secrets: tracer must redact `MODEL_API_KEY`-like values and `Authorization` headers if ever seen.

## 2. Install rules

- New files: exactly one tracer file per language (`ctx_trace.py`, `ctxTrace.ts`), plus `.ctx-tracker/install-manifest.json`.
- Edits: one hook line per send site, containing the marker `CTX-TRACKER`.
  - Python shape: `messages = ctx_trace.wrap(messages, section="history")  # CTX-TRACKER`
  - TS shape: `messages = ctxTrace.wrap(messages, "history"); // CTX-TRACKER`
- Manifest records: tracer path, every hooked file + original snippet, trace dir. Remove = delete tracer + restore snippets + keep trace output (user data, never auto-delete).

## 3. Viewer expectations

- Viewer reads only `trace.jsonl`; it must render with zero project-code access (works even if source files moved — click-to-source just fails gracefully).
- Viewer shows `chars` (exact) and `tokens_est` (rough estimate, always labeled estimated). No cost column in v1: per-model pricing varies too much to be meaningful.

## 4. Versioning

- `tracer.version` and a matching `contract_version: "0.1"` line in the manifest. Viewer warns (not errors) on mismatch.
