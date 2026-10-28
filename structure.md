# Structure

Proposed repo layout for the extension (draft v0.1). All code is generated with Muse Code; per-project glue is generated at runtime by Muse.

## Repo layout (planned)

```
.
├── README.md features.md structure.md design.md contract.md
├── package.json                 # extension manifest: commands, settings, views
├── src/
│   ├── extension.ts             # activation, command registration
│   ├── provider/
│   │   ├── meta.ts              # Meta Model API client (OpenAI SDK, baseURL override)
│   │   ├── cli.ts               # optional `muse` CLI passthrough
│   │   └── registry.ts          # provider pick: meta | openai-compatible | ollama | custom
│   ├── agent/
│   │   ├── prompts.ts           # system prompts + install rules (references contract.md)
│   │   ├── tools.ts             # listFiles, readFile, writeTracer, writeHooks, validate
│   │   └── runner.ts            # multi-pass tag loop (map internally, write hooks, manifest)
│   ├── trace/
│   │   ├── watcher.ts           # watches .ctx-tracker/trace.jsonl
│   │   └── store.ts             # parses runs, computes per section chars and rough token estimator, no costs
│   └── ui/
│       ├── panel.ts             # Ctx: Show Trace webview wiring
│       └── webview/             # trace viewer (sections, tokens, click-to-source)
├── resources/                   # icons, walkthrough assets
└── examples/                    # demo apps (NOT shipped): py-demo/, ts-demo
```

## Runtime pieces

- **Extension host:** owns settings, SecretStorage key, Meta API calls, diff apply/revert.
- **Webview:** renders runs/sections from the trace store; sends "open source" messages back.
- **Generated tracer (per user project):** one file, e.g. `ctx_trace.py` / `ctxTrace.ts`. Only job: wrap message building, tag sections, append JSONL.
- **Hooks (per user project):** one line per send site calling the tracer. Marked `CTX-TRACKER` for clean removal.
- **Trace output:** `<user-project>/.ctx-tracker/trace.jsonl` (gitignored) + `install-manifest.json` for revert.

## What lives where (rules)

- Fixed contract lives in `contract.md` and is baked into `src/agent/prompts.ts`. The agent must not invent a new trace shape.
- Provider defaults live in `src/provider/registry.ts`: meta / `https://api.meta.ai/v1` / `muse-spark-1.3`.
- Nothing in `src/` imports from `examples/`; examples are throwaway demo targets.
- User guides in repo root (`meta-global-ai-developer-hackathon-participant-guide`, `quick-start-guide`, `user-notes`) are reference only, not shipped.
