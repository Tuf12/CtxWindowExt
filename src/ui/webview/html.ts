// Trace viewer HTML shell: pure builder, no vscode import, headless-testable.
// Inline script + styles follow the setupView.ts pattern (CSP nonce, VS Code
// theme vars only). The script renders section bodies with textContent only —
// trace content is untrusted and must never reach innerHTML.

export interface TraceHtmlOptions {
  cspSource: string;
  nonce: string;
}

export function getTraceHtml(opts: TraceHtmlOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${opts.cspSource} 'unsafe-inline'; script-src 'nonce-${opts.nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-editor-foreground);
    background: var(--vscode-editor-background);
    padding: 14px 20px 30px;
    margin: 0 auto;
    max-width: 960px;
    line-height: 1.45;
  }
  header { margin-bottom: 12px; }
  h1 { font-size: 15px; font-weight: 600; margin: 0 0 8px; }
  .runrow { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
  label { color: var(--vscode-descriptionForeground); }
  select {
    flex: 1 1 320px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    padding: 5px 7px;
    font-family: inherit;
    font-size: inherit;
  }
  select:focus, button.source:focus { outline: 1px solid var(--vscode-focusBorder); }
  #totals { font-weight: 600; white-space: nowrap; }
  #meta { color: var(--vscode-descriptionForeground); font-size: 11px; margin-top: 6px; }
  #banner {
    border: 1px solid var(--vscode-inputValidation-warningBorder, #b89500);
    background: var(--vscode-inputValidation-warningBackground, transparent);
    padding: 7px 10px;
    margin: 0 0 12px;
  }
  #warnings {
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    background: var(--vscode-input-background);
    padding: 7px 10px;
    margin: 0 0 12px;
  }
  .warn-head { font-weight: 600; margin-bottom: 4px; }
  .warn-list { margin: 0; padding-left: 18px; }
  .warn-list li { margin: 2px 0; }
  .warn-more { color: var(--vscode-descriptionForeground); margin-top: 4px; }
  .card {
    border: 1px solid var(--vscode-panel-border);
    padding: 10px 12px;
    margin: 0 0 12px;
  }
  .card-head { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  .label { font-weight: 600; }
  .kind {
    font-family: var(--vscode-editor-font-family);
    font-size: 11px;
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    padding: 1px 6px;
    color: var(--vscode-descriptionForeground);
  }
  .kind.unknown { border-style: dashed; }
  .unknown-note { font-size: 11px; color: var(--vscode-descriptionForeground); }
  .counts { margin: 4px 0 6px; }
  button.source {
    background: none;
    border: none;
    padding: 0;
    color: var(--vscode-textLink-foreground);
    font-family: var(--vscode-editor-font-family);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }
  button.source:hover { text-decoration: underline; }
  .stack {
    margin: 6px 0 0;
    padding-left: 18px;
    font-family: var(--vscode-editor-font-family);
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
  }
  pre.body {
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    padding: 8px 10px;
    overflow: auto;
    max-height: 420px;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: var(--vscode-editor-font-family);
    font-size: 12px;
  }
  .truncated { font-size: 11px; color: var(--vscode-descriptionForeground); }
  .empty { color: var(--vscode-descriptionForeground); padding: 18px 0; }
</style>
</head>
<body>
<header>
  <h1>Context Trace</h1>
  <div class="runrow">
    <label for="runs">Run</label>
    <select id="runs"></select>
    <span id="totals"></span>
  </div>
  <div id="meta"></div>
</header>
<div id="banner" hidden></div>
<div id="warnings" hidden></div>
<main id="content"></main>
<script nonce="${opts.nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const MAX_WARNINGS = 50;
  const EMPTY_TEXT = {
    'no-workspace': 'No folder open. Open your AI project folder, then run Ctx: Show Trace.',
    'no-runs': 'No runs recorded yet. Once your app runs with the tracer installed, runs appear here automatically.',
    'all-skipped': 'The trace file has no valid runs. Every line was skipped - see the warnings above.'
  };

  let state = { runs: [], selectedRunId: null, warnings: [], empty: 'no-runs' };
  let detail = null;

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) { e.className = className; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }

  function tokensLabel(n) { return '\\u2248' + n + ' tokens (estimated)'; }

  function renderPicker() {
    const sel = $('runs');
    sel.textContent = '';
    if (!state.runs.length) {
      sel.hidden = true;
      return;
    }
    sel.hidden = false;
    for (let i = state.runs.length - 1; i >= 0; i--) {
      const r = state.runs[i];
      const opt = document.createElement('option');
      opt.value = r.runId;
      opt.textContent = r.runId + ' \\u00b7 ' + r.modelName;
      if (r.runId === state.selectedRunId) { opt.selected = true; }
      sel.appendChild(opt);
    }
  }

  function renderBanner() {
    const banner = $('banner');
    banner.textContent = '';
    if (!detail || !detail.summary.versionMismatch) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    banner.textContent = 'Warning: tracer version "' + detail.tracerVersion +
      '" does not match contract version "' + detail.contractVersion + '". Showing data as-is.';
  }

  function renderWarnings() {
    const box = $('warnings');
    box.textContent = '';
    if (!state.warnings.length) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.appendChild(el('div', 'warn-head', state.warnings.length + ' trace line(s) need attention:'));
    const list = el('ul', 'warn-list');
    const shown = state.warnings.slice(0, MAX_WARNINGS);
    for (const w of shown) {
      list.appendChild(el('li', null, 'line ' + w.line + ': ' + w.message));
    }
    box.appendChild(list);
    if (state.warnings.length > shown.length) {
      box.appendChild(el('div', 'warn-more', '\\u2026and ' + (state.warnings.length - shown.length) + ' more'));
    }
  }

  function renderContent() {
    const content = $('content');
    content.textContent = '';
    if (state.empty) {
      content.appendChild(el('div', 'empty', EMPTY_TEXT[state.empty] || EMPTY_TEXT['no-runs']));
      $('meta').textContent = '';
      $('totals').textContent = '';
      return;
    }
    if (!detail) {
      content.appendChild(el('div', 'empty', 'Loading run\\u2026'));
      return;
    }
    $('meta').textContent = 'project ' + detail.summary.project +
      ' \\u00b7 model ' + detail.summary.modelName +
      ' \\u00b7 tracer ' + detail.tracerFile + ' (' + detail.tracerLang + ')';
    $('totals').textContent = detail.summary.totalChars + ' chars \\u00b7 ' + tokensLabel(detail.summary.totalTokensEst);
    for (const s of detail.sections) {
      const card = el('section', 'card');
      const head = el('div', 'card-head');
      head.appendChild(el('strong', 'label', s.label));
      head.appendChild(el('span', 'kind' + (s.kindKnown ? '' : ' unknown'), s.kind));
      if (!s.kindKnown) {
        head.appendChild(el('span', 'unknown-note', 'unknown kind - shown as-is'));
      }
      card.appendChild(head);
      card.appendChild(el('div', 'counts', s.chars + ' chars \\u00b7 ' + tokensLabel(s.tokensEst)));
      const src = el('button', 'source', s.source.file + ':' + s.source.lines[0] + '\\u2013' + s.source.lines[1]);
      src.addEventListener('click', () => {
        vscode.postMessage({ type: 'openSource', file: s.source.file, lines: s.source.lines });
      });
      card.appendChild(src);
      if (s.stack.length) {
        const stack = el('ul', 'stack');
        for (const frame of s.stack) {
          stack.appendChild(el('li', null, frame));
        }
        card.appendChild(stack);
      }
      card.appendChild(el('pre', 'body', s.displayBody));
      if (s.truncated) {
        card.appendChild(el('div', 'truncated', 'Body truncated past 20,000 chars for display.'));
      }
      content.appendChild(card);
    }
  }

  function render() {
    renderPicker();
    renderBanner();
    renderWarnings();
    renderContent();
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'runs') {
      state = { runs: msg.runs, selectedRunId: msg.selectedRunId, warnings: msg.warnings, empty: msg.empty };
      render();
    } else if (msg.type === 'detail') {
      detail = msg.detail;
      render();
    }
  });

  $('runs').addEventListener('change', (e) => {
    vscode.postMessage({ type: 'selectRun', runId: e.target.value });
  });

  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}
