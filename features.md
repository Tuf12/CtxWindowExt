# Features

v0.1 scope for the hackathon. See `contract.md` for the frozen trace/install contract and `implementation_plan.md` for the build order.

## v1 scope

- **Provider brain (Meta first):** `Ctx: Set API Key` (SecretStorage, `MODEL_API_KEY` fallback) and `Ctx: Test Connection` against `muse-spark-1.3` at `https://api.meta.ai/v1`. Other providers are a settings stub only.
- **Agent tagging:** `Ctx: Tag Codebase` — Muse analyzes the open project and proposes a diff: exactly one tracer file per language (`ctx_trace.py` / `ctxTrace.ts`) plus one-line `CTX-TRACKER` hooks. User reviews, keeps, or reverts. Manifest-driven.
- **Trace viewer:** `Ctx: Show Trace` renders runs/sections from `.ctx-tracker/trace.jsonl` with exact `chars`, rough estimated `tokens_est` (`ceil(chars/4)`, always labeled estimated), and click-to-source that fails gracefully when files moved.
- **Clean removal:** `Ctx: Remove Instrumentation` deletes the tracer, restores hooked snippets byte-identical, keeps trace output (user data).
- **Universal language support by construction:** the agent adapts the tracer to whatever language the project uses. Python and TypeScript ship as reference templates + demo targets, not as a supported-languages list. Extension code never branches on language (`design.md` P6).

## Later ideas (post-hackathon)

- Exact token counts via real tokenizers (tiktoken / model-specific counters) alongside the rough estimator.
- More reference templates (Go, Rust, …) as few-shot examples for the agent — the contract already admits any language.
- Run-over-run trend view (which section is growing?).
- Optional cost plugins per provider (out of core; pricing varies too much to ship as a built-in).
- Trace sharing / export (markdown report of a run).

## Non-goals

- **No cost tracking in v1.** Per-model pricing varies too much to be meaningful; the viewer shows `chars` (exact) and `tokens_est` (rough estimate) only.
- **No exact token counts in v1.** `tokens_est` is explicitly approximate.
- **No blind auto-install.** Tagging always goes through a user-reviewed diff.
- **No post-hoc provenance guessing.** The viewer renders only what the tracer wrote; anything heuristic is labeled as such.
- **No lock-in to any app-side model.** The traced app may use any model (local or API); only the extension brain requires Meta.
