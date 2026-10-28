# Implementation Plan — CtxWindowExt

## Goal

Build the CtxWindowExt VS Code extension per `README.md`, `contract.md`, `design.md`, and `structure.md`, one phase at a time, so that by the Nov 4 9:00 PM ET submission deadline we have: Meta-brained codebase tagging (diff-reviewed), a fixed-contract trace file, a trace viewer with chars/estimated-token attribution and click-to-source, clean removal, and demo apps plus a 3-minute video (per `meta-global-ai-developer-hackathon-participant-guide` §7–8).

## Success Criteria

- `Ctx: Set API Key` + `Ctx: Test Connection` talk to `muse-spark-1.3` at `https://api.meta.ai/v1` (key in SecretStorage, `MODEL_API_KEY` fallback).
- `Ctx: Tag Codebase` produces a reviewable diff: exactly one tracer file per language + one-line `CTX-TRACKER` hooks + `install-manifest.json` (per `contract.md` §2).
- Running a demo app appends one valid run record per run to `.ctx-tracker/trace.jsonl` (per `contract.md` §1).
- `Ctx: Show Trace` renders sections, chars, estimated tokens, and click-to-source with zero project-code access required (per `contract.md` §3).
- `Ctx: Remove Instrumentation` deletes the tracer, restores hooked snippets, keeps trace output.
- Demo holds up live: tag → run → view → remove on both `py-demo` and `ts-demo`.

## Approach

- Contract-fixed, agent-adapted (`design.md` P1): `contract.md` is frozen at v0.1 and baked into agent prompts; only capture code varies per project.
- Build order follows dependency risk, not demo order: provider connection first (proves Meta integration, Stage 1 pass/fail), then trace store against hand-written fixtures (proves contract), then viewer, then the agent tag loop (the bonus-chasing agentic piece), then demos, then submission polish.
- Meta is the default and only required brain (`structure.md` provider defaults; `user-notes` judging note); other providers stay a settings option and are out of v1 scope if time is short.
- Each phase is independently verifiable and ends with an exit gate; do not start the next phase until the gate passes.

## Steps

### Phase 0 — Repo scaffolding + docs gap close

Goal: versioned, buildable extension skeleton; no unwritten references.

- [x] `git init`, public repo, `.gitignore` (node_modules, out, *.vsix, `.ctx-tracker/` trace output in examples only)
- [x] Write missing `features.md` (referenced by `README.md` Docs section but absent): v1 scope, later ideas, non-goals
- [x] `package.json` (commands: Set API Key, Test Connection, Tag Codebase, Show Trace, Remove Instrumentation; settings: provider, baseURL, model), `tsconfig.json`, `src/extension.ts` activation stub
- [x] `npm install` + `npm run compile` passes; extension loads in Extension Development Host
- [x] Update `README.md` status line once real code exists

Exit gate: `npm run compile` clean, extension activates with all five commands registered (stubs OK).

### Phase 1 — Provider brain (Meta Model API connection)

Goal: prove the Meta integration first (Stage 1 pass/fail needs obvious, central Meta usage).

Files: `src/provider/meta.ts`, `src/provider/registry.ts` (defer `cli.ts` unless needed).

- [ ] `registry.ts`: provider defaults meta / `https://api.meta.ai/v1` / `muse-spark-1.3` (limits ctx 1M / out 128K per `quick-start-guide`)
- [ ] `meta.ts`: OpenAI-SDK client with baseURL override, explicit apiKey passing (SDK does not auto-read `MODEL_API_KEY`)
- [ ] `Ctx: Set API Key` → SecretStorage; read fallback `MODEL_API_KEY` env
- [ ] `Ctx: Test Connection` → minimal `muse-spark-1.3` call, show success/failure message (surface 401/404 distinctly per `quick-start-guide` troubleshooting)
- [ ] Redaction helper: never log key material

Exit gate: live `Test Connection` succeeds against `api.meta.ai/v1` and fails gracefully with no key set.

### Phase 2 — Trace contract fixtures + store/watcher

Goal: the fixed contract becomes executable truth before any UI or agent exists.

Files: `src/trace/store.ts`, `src/trace/watcher.ts`, test fixtures.

- [ ] Hand-write 2–3 fixture `trace.jsonl` lines covering all 7 `kind` values, truncation flag, redacted secret, version mismatch (per `contract.md` §1, §4)
- [ ] `store.ts`: parse JSONL (skip bad lines with warning), per-section chars, `tokens_est = ceil(chars/4)` labeled estimated, totals
- [ ] Display rule: `chars` shown exact, `tokens_est` always labeled estimated; no cost column (per `contract.md` §3)
- [ ] `watcher.ts`: watch `.ctx-tracker/trace.jsonl`, re-parse on append
- [ ] Unit tests: parser, token estimator (`ceil(chars/4)`), truncation at 20K chars/section, mismatch warning path

Exit gate: `npm test` passes; store correctly parses fixtures and computes chars/tokens_est totals without touching any project source.

### Phase 3 — Trace viewer UI

Goal: `Ctx: Show Trace` delivers the core demo value on fixture data alone.

Files: `src/ui/panel.ts`, `src/ui/webview/*`.

- [ ] Webview lists runs (run_id, ts, model, totals) and per-run sections (label, kind, chars, tokens_est with "estimated" label)
- [ ] Section body view with truncation notice; full body never fetched from project code
- [ ] Click-to-source: `source.file` + `lines` → open editor; fail gracefully if file moved (per `contract.md` §3)
- [ ] Version-mismatch banner (warn, not error) when `tracer.version` ≠ `contract_version`
- [ ] Live refresh on new appended runs via watcher

Exit gate: viewer renders all fixtures correctly, survives deleted source files, updates within ~1s of a new appended line.

### Phase 4 — Agent tag loop (install + remove)

Goal: the Best Agentic Use-Case flow — analyze → propose diff → install → explain.

Files: `src/agent/prompts.ts`, `src/agent/tools.ts`, `src/agent/runner.ts`.

- [ ] `prompts.ts`: system prompt embedding `contract.md` install rules + trace shape verbatim (agent must not reinvent)
- [ ] `tools.ts`: listFiles, readFile, writeTracer, writeHooks, validate (validate checks: one tracer file, hook marker present, manifest complete, JSONL sample parses)
- [ ] `runner.ts`: multi-pass loop — map send sites internally → write tracer + hooks → validate → present as VS Code diff for keep/revert
- [ ] Reference tracer templates (Python `ctx_trace.py`, TS `ctxTrace.ts`): `wrap()` tagging, JSONL append, `MODEL_API_KEY`/`Authorization` redaction
- [ ] `Ctx: Remove Instrumentation`: read manifest, delete tracer, restore original snippets, keep `.ctx-tracker/trace.jsonl`
- [ ] `install-manifest.json`: tracer path, hooked files + original snippets, trace dir, `contract_version: "0.1"`

Exit gate: on a sample project, Tag produces exactly the contracted diff, Remove restores byte-identical sources, trace output survives.

### Phase 5 — Demo apps + end-to-end

Goal: prove the full loop on both supported languages.

Files: `examples/py-demo/`, `examples/ts-demo/` (NOT shipped; `src/` never imports them).

- [ ] `py-demo`: minimal app building messages (system + history + user) with a local/any-model send path
- [ ] `ts-demo`: same shape in TypeScript
- [ ] E2E script: Tag → run app → assert one valid JSONL line per run → Show Trace → Remove → assert sources restored
- [ ] Capture screenshots/GIFs of viewer for README and video

Exit gate: full E2E passes on both demos from a clean checkout; each run appends exactly one valid record.

### Phase 6 — Submission polish

Goal: shippable, judgable, public.

- [ ] `resources/` icons + walkthrough; real README quickstart (replace "planned, not yet implemented")
- [ ] `features.md` final scope check; non-goals honored
- [ ] Package `.vsix`, install from vsix in clean VS Code profile, rerun E2E
- [ ] 3-minute demo video script: problem → Tag diff → run → trace view → token-attribution story → Remove (lean into agentic flow per `user-notes`)
- [ ] Public repo check: new-work-only clarity, guides marked reference-only, no keys/secrets in history

Exit gate: clean-profile install works, video recorded, submission posted before Nov 4 9:00 PM ET.

## Validation Plan

- Per-phase exit gates above are the primary evidence; each ends with a concrete command or manual check (`npm run compile`, live `Test Connection`, `npm test`, fixture rendering, Tag/Remove round-trip, E2E script, clean-profile install).
- Highest-risk validation: Phase 4 Tag/Remove round-trip (agent output must obey `contract.md` byte-level install rules) — run it against both demo apps, not one.
- E2E black-box check (Phase 5): from clean checkout, the script must show exactly one new valid JSONL line per app run and byte-identical source restore after Remove.
- Manual checks that cannot be automated: viewer readability on a real 1M-context-scale trace body (truncation UX), diff review ergonomics, demo video watch-through.

## Risks / Open Questions

- `features.md` is referenced but missing — Phase 0 writes it; if its scope exceeds the above, re-phase before coding.
- No `git` repo yet — Phase 0 inits; new-work-only judging needs clean history from here.
- Meta API key/credits: claim $150 credits early (`participant-guide` §5); without a key Phase 1+ stalls — fallback is `MODEL_API_KEY` env + mocked provider for UI work only.
- Agent hook placement quality on arbitrary user code is the main technical risk; mitigation is the `validate` tool + diff review (human in the loop), not blind install.
- Token estimates stay rough (`ceil(chars/4)`): never present them as exact counts; `chars` is the precise number.
