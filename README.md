# CtxWindowExt — Context Window Tracker for AI Systems

Status: Phase 2 complete — trace store + watcher tested (19/19 green). Phase 1 live key test still pending (dashboard access issue). Next: Phase 3 trace viewer. See `implementation_plan.md`. Built for the Meta Global AI Developer Hackathon.

## Problem

AI apps stitch prompts from system prompts, tools, history, RAG, and env state. Get it wrong and you get bloat, gaps, or noise. The context window is the model’s working memory; every token matters for cost, latency, and correctness. Without a clear line from each chunk back to the code that created it, you’re debugging blind.

## What this is

A VS Code extension that captures a run's context window from the user's *own* AI project and traces each section back to the code that produced it, with chars and estimated-token attribution per section and click-to-source.

- The extension is the host/UI layer: commands, provider connection, trace viewer, install/remove logic, and an agent harness. Muse does the code analysis and generates a tiny per-project tracer with one-line hooks.
- Muse (Meta Model API, `muse-spark-1.3`) analyzes the open project and generates a tiny per-project tracer plus one-line hooks.
- The user's app runs normally (any model: local or API call). The tracer writes a fixed-shape trace file. The extension renders it.

## Hackathon fit

- Track: Build for Your World (developer tool for a problem the author hit firsthand).
- Must-use: Meta Model API + Muse Code. Default brain: `muse-spark-1.3` at `https://api.meta.ai/v1`.
- Bonus target: Best Agentic Use-Case (analyze → propose diff → install → explain trace).
- Repo is public; all demoed work is new work built during the event (see `user-notes` for source guides).

## Quickstart (planned, not yet implemented)

1. Open your AI project in VS Code.
2. Install this extension, run `Ctx: Set API Key` (Meta Model API key, stored in SecretStorage; falls back to `MODEL_API_KEY`).
3. Run `Ctx: Test Connection` (expects `muse-spark-1.3` to answer).
4. Run `Ctx: Tag Codebase` → review the diff (1 tracer file + hooks), keep or revert.
5. Run your app, send a prompt to your AI.
6. Open `Ctx: Show Trace` → review sections, chars, estimated tokens, click through to source.
7. Run `Ctx: Remove Instrumentation` to revert cleanly.

## Docs

- [features.md](features.md) — v1 scope, later ideas, non-goals.
- [structure.md](structure.md) — repo layout and runtime pieces.
- [design.md](design.md) — architecture, decisions, open questions.
- [contract.md](contract.md) — fixed trace format + install rules the agent must obey.

## Source guides (in repo root)

- `meta-global-ai-developer-hackathon-participant-guide`
- `quick-start-guide`
