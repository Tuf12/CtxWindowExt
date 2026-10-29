import * as vscode from 'vscode';
import { resolveConfig, SUPPORTED_MODELS } from '../provider/registry';
import { getApiKey, setStoredKey, ENV_KEY_NAME } from '../provider/keys';
import { testConnection } from '../provider/meta';

type ToView =
  | {
      type: 'status';
      hasKey: boolean;
      sourceLabel: string;
      model: string;
      models: string[];
      baseURL: string;
    }
  | { type: 'testResult'; ok: boolean; message: string };

type FromView =
  | { type: 'ready' }
  | { type: 'saveKey'; key: string }
  | { type: 'clearKey' }
  | { type: 'testConnection' }
  | { type: 'setModel'; model: string };

export class SetupViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'ctxWindowExt.setupView';

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly secrets: vscode.SecretStorage,
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg: FromView) => {
      switch (msg.type) {
        case 'ready':
          await this.postStatus(webviewView.webview);
          break;
        case 'saveKey': {
          const key = msg.key.trim();
          if (!key) {
            break;
          }
          await setStoredKey(this.secrets, key);
          await this.postStatus(webviewView.webview);
          break;
        }
        case 'clearKey':
          await setStoredKey(this.secrets, undefined);
          await this.postStatus(webviewView.webview);
          break;
        case 'setModel':
          if (SUPPORTED_MODELS.includes(msg.model)) {
            await vscode.workspace
              .getConfiguration('ctxWindowExt')
              .update('model', msg.model, vscode.ConfigurationTarget.Global);
          }
          await this.postStatus(webviewView.webview);
          break;
        case 'testConnection': {
          const { baseURL, model } = this.getConfig();
          const { key, source } = await getApiKey(this.secrets);
          if (!key) {
            await this.post(webviewView.webview, {
              type: 'testResult',
              ok: false,
              message: `No API key set. Enter one above or set ${ENV_KEY_NAME}.`,
            });
            break;
          }
          const result = await testConnection({ apiKey: key, baseURL, model });
          const via = source === 'secretStorage' ? 'stored key' : `${ENV_KEY_NAME} env var`;
          await this.post(webviewView.webview, {
            type: 'testResult',
            ok: result.ok,
            message: result.ok
              ? `Connected to ${model} via ${via} in ${result.latencyMs} ms. Reply: ${result.reply || '(empty)'}`
              : `Failed via ${via}: ${result.message}`,
          });
          break;
        }
      }
    });
  }

  private getConfig() {
    const cfg = vscode.workspace.getConfiguration('ctxWindowExt');
    return resolveConfig({
      baseURL: cfg.get<string>('baseURL'),
      model: cfg.get<string>('model'),
    });
  }

  private async postStatus(webview: vscode.Webview): Promise<void> {
    const { baseURL, model } = this.getConfig();
    const { key, source } = await getApiKey(this.secrets);
    const sourceLabel = !key
      ? 'No API key set'
      : source === 'secretStorage'
        ? 'API key: stored securely in VS Code'
        : `API key: using ${ENV_KEY_NAME} environment variable`;
    await this.post(webview, {
      type: 'status',
      hasKey: Boolean(key),
      sourceLabel,
      model,
      models: SUPPORTED_MODELS,
      baseURL,
    });
  }

  private async post(webview: vscode.Webview, msg: ToView): Promise<void> {
    await webview.postMessage(msg);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    padding: 12px 14px;
    line-height: 1.45;
  }
  h1 { font-size: 15px; font-weight: 600; margin: 2px 0 2px; }
  .tagline { color: var(--vscode-descriptionForeground); margin: 0 0 12px; }
  .about { margin: 0 0 14px; }
  h2 { font-size: 12px; font-weight: 600; margin: 16px 0 6px; }
  .status {
    padding: 6px 9px;
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    background: var(--vscode-input-background);
    margin-bottom: 4px;
  }
  .status.ok { border-left: 3px solid var(--vscode-testing-iconPassed, #3fb950); }
  .status.missing { border-left: 3px solid var(--vscode-testing-iconFailed, #f85149); }
  label { display: block; margin: 8px 0 3px; }
  select, input[type="password"] {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    padding: 5px 7px;
    font-family: inherit;
    font-size: inherit;
  }
  input[type="password"]:focus, select:focus, button:focus { outline: 1px solid var(--vscode-focusBorder); }
  .row { display: flex; gap: 6px; margin-top: 8px; }
  button {
    flex: 1;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px 10px;
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
  button:disabled { opacity: 0.55; cursor: default; }
  .meta { color: var(--vscode-descriptionForeground); font-size: 11px; margin-top: 6px; }
  #result { margin-top: 8px; white-space: pre-wrap; }
  #result.ok { color: var(--vscode-testing-iconPassed, #3fb950); }
  #result.err { color: var(--vscode-testing-iconFailed, #f85149); }
  ol.steps { padding-left: 18px; margin: 6px 0 0; }
  ol.steps li { margin: 3px 0; }
</style>
</head>
<body>
  <h1>CtxWindowExt</h1>
  <p class="tagline">Context Window Tracker for AI systems</p>
  <p class="about">Captures a run's context window from your own AI project and traces each
  section back to the code that produced it — with exact chars, estimated tokens,
  and click-to-source. Your app runs normally; the tracer writes a trace file and this
  extension renders it.</p>

  <h2>1 · Status</h2>
  <div id="status" class="status missing">Loading…</div>

  <h2>2 · Brain model</h2>
  <label for="model">Model used by this extension (your app may use any model)</label>
  <select id="model"></select>
  <div id="baseurl" class="meta"></div>

  <h2>3 · API key</h2>
  <label for="key">Meta Model API key — stored in VS Code SecretStorage, never in your code</label>
  <input id="key" type="password" placeholder="Paste key, then Save" autocomplete="off" spellcheck="false">
  <div class="row">
    <button id="save">Save key</button>
    <button id="clear" class="secondary">Clear</button>
  </div>

  <h2>4 · Verify</h2>
  <div class="row">
    <button id="test" class="secondary">Test connection</button>
  </div>
  <div id="result"></div>

  <h2>Next</h2>
  <ol class="steps">
    <li>Open your AI project folder.</li>
    <li>Run <b>Ctx: Tag Codebase</b> (Phase 4) to install the tracer.</li>
    <li>Run your app, then <b>Ctx: Show Trace</b> (Phase 3) to inspect the run.</li>
  </ol>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);

  function renderStatus(msg) {
    const el = $('status');
    el.textContent = msg.sourceLabel;
    el.className = 'status ' + (msg.hasKey ? 'ok' : 'missing');
    const sel = $('model');
    sel.textContent = '';
    for (const m of msg.models) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      if (m === msg.model) { opt.selected = true; }
      sel.appendChild(opt);
    }
    $('baseurl').textContent = 'Endpoint: ' + msg.baseURL;
    $('key').value = '';
  }

  function renderResult(msg) {
    const el = $('result');
    el.textContent = msg.message;
    el.className = msg.ok ? 'ok' : 'err';
    const btn = $('test');
    btn.disabled = false;
    btn.textContent = 'Test connection';
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'status') { renderStatus(msg); }
    else if (msg.type === 'testResult') { renderResult(msg); }
  });

  $('save').addEventListener('click', () => {
    const key = $('key').value;
    if (!key.trim()) { return; }
    vscode.postMessage({ type: 'saveKey', key });
  });
  $('clear').addEventListener('click', () => {
    vscode.postMessage({ type: 'clearKey' });
  });
  $('test').addEventListener('click', () => {
    const btn = $('test');
    btn.disabled = true;
    btn.textContent = 'Testing…';
    $('result').textContent = '';
    $('result').className = '';
    vscode.postMessage({ type: 'testConnection' });
  });
  $('model').addEventListener('change', (e) => {
    vscode.postMessage({ type: 'setModel', model: e.target.value });
  });

  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}
