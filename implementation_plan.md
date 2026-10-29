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

- [x] `registry.ts`: provider defaults meta / `https://api.meta.ai/v1` / `muse-spark-1.3` (limits ctx 1M / out 128K per `quick-start-guide`)
- [x] `meta.ts`: OpenAI-SDK client with baseURL override, explicit apiKey passing (SDK does not auto-read `MODEL_API_KEY`)
- [x] `Ctx: Set API Key` → SecretStorage; read fallback `MODEL_API_KEY` env
- [x] `Ctx: Test Connection` → minimal `muse-spark-1.3` call, show success/failure message (surface 401/404 distinctly per `quick-start-guide` troubleshooting)
- [x] Redaction helper: never log key material
- [x] Sidebar Setup view (`src/ui/setupView.ts`): branded panel with about text, status, model select, key input + save/clear, Test connection button (primary UI; palette commands remain as secondary path)

Exit gate (revised 2026-10-28): live `Test Connection` succeeds via the sidebar Setup view and fails gracefully with no key set.

Live-verify status: negative path verified headless (dummy key → clean 401 message). Positive path PENDING user run through the sidebar UI — see MUSE.md journal.

### Phase 1b — CLI fallback brain (Muse passthrough)

Goal: unblock the brain without a Meta dashboard key; zero-config path for users already logged into Muse in their terminal. Meta stays the default (Stage 1 judging).

Files: `src/provider/cli.ts`, `src/provider/brain.ts`, registry/provider settings, Setup view provider picker.

- [x] `cli.ts`: `muse exec --json` runner (injectable spawn), defensive JSONL reply extraction, CLI resolution (setting → PATH → `~/.local/bin`), availability check; never passes or reads API keys
- [x] `brain.ts`: Test Connection dispatch on selected provider
- [x] Registry: `meta | cli` providers, `normalizeProviderId`; `package.json` provider enum + `cliPath` setting; Meta stays default
- [x] `Ctx: Test Connection` (palette + sidebar) dispatches per provider; no key required for CLI
- [x] Sidebar Setup view: provider picker, CLI status + "no key needed" hint, key/model sections hidden for CLI
- [x] Unit tests: arg building, reply extraction, path resolution, runner mapping, dispatch (`cli.test.ts`, `brain.test.ts`)
- [x] Auto chain (default): CLI first, API-key fallback; `meta`/`cli` pins preserved; results carry which brain answered + fallback note; Setup status describes the active path

Exit gate NEARLY PASSED 2026-10-29: `npm test` 63/63 green; headless detection OK (finds install, v1.4.14); user live-verified CLI Test Connection (3730 ms, Reply: OK, no key). Remaining: live Auto-default test (expect CLI success), graceful-fail check with CLI missing (bogus Cli Path → combined failure message), plus real `--json` sample as parser regression fixture.

Exit gate: live `Test Connection` succeeds with provider=Muse CLI (no key set), and fails gracefully when the CLI is missing.

Note: Ollama fallback (possible Phase 1c) deferred until user confirms `ollama serve` + pastes `ollama list` for the model tag.

### Phase 2 — Trace contract fixtures + store/watcher

Goal: the fixed contract becomes executable truth before any UI or agent exists.

Files: `src/trace/store.ts`, `src/trace/watcher.ts`, test fixtures.

- [x] Hand-write 2–3 fixture `trace.jsonl` lines covering all 7 `kind` values, truncation flag, redacted secret, version mismatch (per `contract.md` §1, §4)
- [x] `store.ts`: parse JSONL (skip bad lines with warning), per-section chars, `tokens_est = ceil(chars/4)` labeled estimated, totals
- [x] Display rule: `chars` shown exact, `tokens_est` always labeled estimated; no cost column (per `contract.md` §3)
- [x] `watcher.ts`: watch `.ctx-tracker/trace.jsonl`, re-parse on append
- [x] Unit tests: parser, token estimator (`ceil(chars/4)`), truncation at 20K chars/section, mismatch warning path

Exit gate PASSED 2026-10-28: `npm test` 19/19 green; fixtures parse with computed totals, zero project-source access.

Exit gate: `npm test` passes; store correctly parses fixtures and computes chars/tokens_est totals without touching any project source.

### Phase 3 — Trace viewer UI

Goal: `Ctx: Show Trace` delivers the core demo value on fixture data alone.

Files: `src/ui/panel.ts`, `src/ui/viewModel.ts` (pure, vscode-free), `src/ui/webview/*`.

Decisions (2026-10-29):

- Trace file resolves per active workspace folder: `<active-root>/.ctx-tracker/trace.jsonl` (one trace dir per root in multi-root workspaces; no shared file).
- One run shown at a time; latest run selected by default; run picker to switch.
- Section detail includes `stack` entries.
- Per-section history across runs ("previous input for a section") is V2 — recorded in `features.md`, out of v1.

- [x] Webview shows one run at a time (run picker: run_id, ts, model, totals); latest run selected by default
- [x] Per-run sections list (label, kind, chars, tokens_est with "estimated" label)
- [x] Section body view with truncation notice; full body never fetched from project code
- [x] Section detail includes `stack` entries
- [x] Click-to-source: `source.file` + `lines` resolved against the trace file's workspace root → open editor; fail gracefully if file moved (per `contract.md` §3)
- [x] Version-mismatch banner (warn, not error) when `tracer.version` ≠ `contract_version`
- [x] Parse-warnings row: surface store `ParseWarning`s (skipped lines, unknown kinds) in the viewer
- [x] Empty states: no workspace folder open, no trace file yet, all lines skipped — each renders a friendly message, never blank/error
- [x] Live refresh on new appended runs via watcher
- [x] View-model builder is vscode-free and unit-tested (`node:test`): latest-run default, warnings passthrough, body/displayBody shaping
- [x] Webview payload contains `displayBody` only (full `body` stripped); run-list + selected-run-detail messaging so payload doesn't grow with run count
- [x] Security: CSP nonce + `textContent`-only rendering of bodies (untrusted content), same pattern as `setupView.ts`

Exit gate PARTIAL 2026-10-29: `npm test` 36/36 green; headless probe OK (watcher→messages on all fixtures, 155 ms refresh, no body leak). GUI half PENDING user F5 run: fixture rendering in the webview, deleted-source survival, live refresh visible.

Exit gate: viewer renders all fixtures correctly (manual: copy each fixture into a scratch `<root>/.ctx-tracker/trace.jsonl` and check runs/sections/warnings/empty states), survives deleted source files, updates within ~1s of a new appended line; `npm test` green including view-model tests.

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

- [x] RESOLVED Phase 0: `features.md` written; scope fits this plan (was: referenced but missing).
- [x] RESOLVED Phase 0: git repo init'd with public remote; new-work-only history starts clean (was: no repo yet).
- Meta API key/credits: claim $150 credits early (`participant-guide` §5); without a key Phase 1+ stalls — fallback is `MODEL_API_KEY` env + mocked provider for UI work only.
- Agent hook placement quality on arbitrary user code is the main technical risk; mitigation is the `validate` tool + diff review (human in the loop), not blind install.
- Token estimates stay rough (`ceil(chars/4)`): never present them as exact counts; `chars` is the precise number.
