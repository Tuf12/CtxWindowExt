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
- [ ] Phase 1 — provider brain
- [ ] Phase 2 — trace fixtures + store/watcher
- [ ] Phase 3 — viewer UI
- [ ] Phase 4 — agent tag loop
- [ ] Phase 5 — demo apps + E2E
- [ ] Phase 6 — submission polish

## Decision log

- 2026-10-28: Provider-first build order (Meta connection before UI/agent) to de-risk Stage 1 pass/fail judging.
- 2026-10-28: Fixtures before viewer — contract becomes executable truth via hand-written JSONL + unit tests.
- 2026-10-28: Other providers stay a settings stub; Meta-only is acceptable v1 if time is short.
- 2026-10-28: No cost feature anywhere in v1 (per-model pricing varies too much). Viewer shows exact `chars` + rough `tokens_est` (`ceil(chars/4)`), always labeled estimated. Scrubbed from README, contract, design, plan.
- 2026-10-28: Universal-by-construction (`design.md` P6): no language branches in extension code; Python/TS are reference templates + demos only. User challenged the 2-language framing; docs updated.

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
