# MUSE.md — Working Journal (CtxWindowExt)

Project memory for Muse Code sessions. Append entries as work happens; keep each entry short (date, what changed, decisions, next step).

## Project snapshot

- VS Code extension: traces an AI app's context window back to source, with chars + estimated-token attribution + click-to-source. No cost feature (per-model pricing varies too much).
- Brain: Meta Model API, `muse-spark-1.3` @ `https://api.meta.ai/v1` (OpenAI-SDK compatible). Key in SecretStorage, `MODEL_API_KEY` fallback.
- Contract frozen at v0.1 (`contract.md`): `.ctx-tracker/trace.jsonl`, one tracer file + `CTX-TRACKER` hooks, manifest-driven remove.
- Track: Build for Your World. Bonus target: Best Agentic Use-Case. Deadline: Nov 4 9:00 PM ET. Public repo, new work only, 3-min video.
- Build order: `implementation_plan.md` Phases 0→6. Phase gates must pass before advancing.

## Phase tracker

- [x] Phase 0 — scaffolding + docs gap close (done 2026-10-28, uncommitted; user owns commits)
- [ ] Phase 1 — provider brain (code done 2026-10-28; positive live test BLOCKED on Meta dashboard key access — gate reopens before Phase 4)
- [ ] Phase 1b — CLI fallback brain (code done 2026-10-29, 58/58 green; live CLI test PASSED by user 2026-10-29; missing-CLI negative check still open)
- [x] Phase 2 — trace fixtures + store/watcher (done 2026-10-28, 19/19 tests green)
- [ ] Phase 3 — viewer UI (code done 2026-10-29, 36/36 tests green; GUI half of gate PENDING user F5 run)
- [ ] Phase 4 — agent tag loop
- [ ] Phase 5 — demo apps + E2E
- [ ] Phase 6 — submission polish

## Decision log

- 2026-10-28: Provider-first build order (Meta connection before UI/agent) to de-risk Stage 1 pass/fail judging.
- 2026-10-28: Fixtures before viewer — contract becomes executable truth via hand-written JSONL + unit tests.
- 2026-10-28: Other providers stay a settings stub; Meta-only is acceptable v1 if time is short.
- 2026-10-28: No cost feature anywhere in v1 (per-model pricing varies too much). Viewer shows exact `chars` + rough `tokens_est` (`ceil(chars/4)`), always labeled estimated. Scrubbed from README, contract, design, plan.
- 2026-10-28: Universal-by-construction (`design.md` P6): no language branches in extension code; Python/TS are reference templates + demos only. User challenged the 2-language framing; docs updated.
- 2026-10-28: Sidebar Setup view is the primary UX (user rejected palette-only key entry as sketchy). Palette commands stay as secondary path. Phase 1 exit gate revised: verify via sidebar UI.
- 2026-10-29: CLI fallback brain (Phase 1b): `muse exec` passthrough for keyless use; Meta stays default (judging). Ollama deferred to possible 1c pending `ollama list`.
- 2026-10-29: Auto provider chain is the default UX (CLI first, API-key fallback); explicit `meta`/`cli` pins preserved. Pin Meta for the judging demo/video to keep central Meta usage obvious.

## Journal

### 2026-10-28 — Planning session

- Read README, contract, design, structure, user-notes, quick-start-guide, participant guide.
- Found gaps: `features.md` referenced but missing; no git repo yet.
- Wrote `implementation_plan.md` (7 phases with checklists + exit gates) and this journal.
- Next: Phase 0 — `git init`, `features.md`, `package.json`/`tsconfig`/`extension.ts` skeleton.

### 2026-10-28 — Phase 5 demo targets discussion

- User offered their own AI projects as Phase 5 demo targets instead of / alongside synthetic py-demo + ts-demo.
- My take (pending user confirm): keep tiny synthetic demos as regression fixtures + judge-friendly repro, add one real project as Phase 5b real-world proof. Real code proves the agent on arbitrary stacks; synthetic keeps E2E hermetic.
- Caveats noted: tag only git-clean copies, watch for secret leakage in traces, keep new-work-only clarity (extension is the new work; target app is just the target).
- User confirmed: synthetic demos stay (judges need a ready-made repro); real project added as Phase 5b. Fold 5a/5b split into implementation_plan.md when starting Phase 5.

### 2026-10-28 — Phase 0 executed

- User had already run `git init` + first commit + remote (`origin` → github.com/Tuf12/CtxWindowExt, branch `main`). I added `.gitignore` only.
- Added: `features.md`, `LICENSE` (MIT), `package.json`, `tsconfig.json`, `src/extension.ts` (5 stub commands), `.vscodeignore`.
- `npm install` needed `--cache /tmp/npm-cache` (sandbox blocks `~/.npm`); compiled clean, all 5 commands verified in `out/extension.js`.
- Left everything uncommitted — user owns commits. Next: Phase 1 provider brain (needs Meta API key for live test).

### 2026-10-28 — Phase 1 code done, live test pending

- Added `src/provider/{registry,keys,meta}.ts`; wired `Ctx: Set API Key` + `Ctx: Test Connection` in `src/extension.ts`. `openai` added as dependency.
- Provider modules are vscode-free (type-only import in keys.ts) so compiled output is headless-testable.
- Negative path verified: dummy key → `Invalid API key (401)...`, exit 1. Sandbox needed a ProxyAgent harness (`/tmp/ctx-test.js` + undici in `/tmp/ctx-proxy`) — Node fetch ignores proxy env; harness-only, zero repo impact.
- Positive path needs the user's real key: either `export MODEL_API_KEY=...; node /tmp/ctx-test.js` (tests compiled code, key never printed) or F5 → Set API Key → Test Connection (tests full extension path). Do NOT ask for the key in chat.
- 2026-10-28: user deferred the positive live test ("move to the end when we have something to connect to"). Noted misconception: Test Connection targets Meta's API (exists now), not something we build later. Accepted; gate recorded as deferred. Latest safe point to close it: before Phase 4 agent work. Phases 2–3 don't touch the provider, so order is safe.
- 2026-10-28: user then rejected palette-only UX outright; built sidebar Setup view instead (`src/ui/setupView.ts` + activity-bar container `ctxwindowext` + `resources/ctx-icon.svg`). Styled with VS Code theme vars (no custom palette/gradients). Deferral superseded: user will verify through the sidebar UI.
- 2026-10-28: user blocked on key access — Meta dashboard created 2 keys without revealing them, logout loop prevents creating another. Positive live test stays open. Recovery: different browser/incognito, Discord #office-hours (Meta team, 10–11 AM ET weekdays). NOT blocking Phases 2–3 (no provider touch); backstop still before Phase 4.

### 2026-10-28 — Phase 2 executed

- Added `src/trace/store.ts` (parse, estimate, truncate, version check) and `src/trace/watcher.ts` (fs.watch + debounced re-parse). Both vscode-free.
- Fixtures in `src/test/fixtures.ts`: 7-kind run (totals 1904 chars / 475 est), version-mismatch run (25K body, unknown kind), mixed doc (garbage + blank + broken + minimal lines).
- Test harness: `node:test` + `assert/strict`, `npm test` = compile + `node --test out/test/`. 19/19 green first run. Compiled tests excluded from vsix via `.vscodeignore`.
- Decisions: store recomputes totals from sections (ignores stored totals); unknown kinds kept as-is with warning; missing trace file = empty, not error.
- Open question for later: extension-level proxy support (VS Code `http.proxy` settings) — out of Phase 1 scope, fine for direct-internet users.

### 2026-10-29 — Phase 3 scope review

- User decisions: trace file per active workspace folder (multi-root = one `.ctx-tracker/` per root); one run at a time, latest by default; include `stack` in section detail; per-section history deferred to V2 (`features.md`).
- Folded 5 review concerns into Phase 3: warnings row, empty states, view-model tests, displayBody-only payload, CSP/textContent security pattern.
- Still no Meta API key (2026-10-29); positive live test stays open, backstop before Phase 4. Doc hygiene cleaned (stale Phase 1 gate line, resolved risks, duplicate tracker lines).
- Next: implement Phase 3.

### 2026-10-29 — Phase 3 executed

- Added `src/ui/viewModel.ts` (pure: run summaries, displayBody-only detail, latest-default selection, empty states, source-path resolve), `src/ui/webview/html.ts` (pure HTML shell, inline script, textContent-only), `src/ui/panel.ts` (wiring: per-folder trace resolve, watcher, run-list + detail messages, click-to-source with graceful fail). Wired `Ctx: Show Trace`.
- Tests: `src/test/viewModel.test.ts` + `src/test/traceHtml.test.ts`, 17 new; `npm test` 36/36 green. Headless probe `/tmp/ctx-phase3-probe.js`: all fixtures through watcher→messages, 155 ms refresh, no body leak.
- Decisions: webview script stays inline in `html.ts` (tsconfig has no DOM lib; matches setupView pattern); explicit run selection sticks across appends, missing selection falls back to latest; warnings list capped at 50 in the view.
- GUI half of exit gate needs user F5: fixture rendering, deleted-source survival, visible live refresh.

### 2026-10-29 — Phase 1b executed

- Added `src/provider/cli.ts` (exec runner, defensive JSONL extraction, PATH+~/.local/bin resolution, availability check) and `src/provider/brain.ts` (Test Connection dispatch). Registry + settings + Setup view now offer meta | cli; Meta stays default.
- Tests: `cli.test.ts` + `brain.test.ts`, 22 new; `npm test` 58/58 green. Headless probe `/tmp/ctx-phase1b-probe.js`: resolves real install (v1.4.14).
- Parser shape is defensive-pending-real-output: still need user paste of `muse exec --json` stdout to lock it with a regression test.
- Debug session: provider selection silently not sticking — root cause was the user's own corrupt `settings.json` (VS Code refused all writes to it), not extension code. Hardened `setupView.ts` so settings-write failures surface via popup and the UI always re-syncs to stored values.
- User live-verified CLI Test Connection 2026-10-29 (3730 ms, Reply: OK, no key). Missing-CLI negative check still open.
- Next: close 1b gate (negative check + `--json` fixture); then Phase 4 agent loop can target the CLI brain.

### 2026-10-29 — Auto provider chain

- Registry: `auto | meta | cli` selections, `resolveChain` (auto → CLI then meta); results carry `used` + fallback `note`; `Test Connection` (both paths) and Setup status describe the active brain.
- Tests: `brain.test.ts` now 7 chain tests (fallback, pins, unknown→auto); `npm test` 63/63 green.
- Next: user live-verifies Auto default + missing-CLI combined failure; still want the `--json` paste.
