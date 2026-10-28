# Design

Draft v0.1. Decisions are hackathon-scoped and reversible; open questions are listed at the end.

## Principles

1. Agent-adapted, contract-fixed: Muse adapts capture code per language, but the trace JSONL shape and install rules never change per project.
2. Minimal footprint: 1 tracer file + one-line hooks, all marked, all removable.
3. Propose diff, then review: the agent proposes tagging as a normal VS Code diff (1 tracer file + hooks) the user keeps or reverts.
4. Two planes: extension brain (Meta Model API) is independent of the traced app's models (xAI, local OSS, anything).
5. Demo honesty: viewer only renders what the tracer wrote; no guessing provenance after the fact beyond labeled heuristics.

## Architecture

```
User's AI project (any stack)          CtxWindowExt (VS Code)              Meta Model API
┌──────────────────────────┐          ┌──────────────────────┐          ┌──────────────────┐
│ app builds messages[]    │          │ Tag (agent)          │  HTTPS   │ muse-spark-1.3   │
│  → ctx_trace hook ───────┼──JSONL──▶│ Trace store + viewer │◀────────▶│ api.meta.ai/v1   │
│  → user's model (any)    │          │ Tag / Remove         │  key in  │ 1M ctx / 128K out│
└──────────────────────────┘          └──────────────────────┘  Secret  └──────────────────┘
```

## User workflow (the steps)

1. Connect brain: `Ctx: Set API Key`, `Ctx: Test Connection`.
2. Tag codebase: `Ctx: Tag Codebase` — agent loops and writes tracer + hooks; user reviews the diff, keeps or reverts.
3. Run + prompt: user runs their program, sends a message to their AI; tracer appends one run record to `.ctx-tracker/trace.jsonl`.
4. View trace: `Ctx: Show Trace` — inspect sections, tokens, cost; click through to code.
5. Remove (optional): `Ctx: Remove Instrumentation` — delete tracer, revert hooks.

