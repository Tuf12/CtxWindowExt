import * as vscode from 'vscode';
import { SELECTIONS, resolveConfig, SUPPORTED_MODELS } from '../provider/registry';
import type { ProviderSummary } from '../provider/registry';
import { getApiKey, setStoredKey, ENV_KEY_NAME } from '../provider/keys';
import { checkCli } from '../provider/cli';
import { testBrainConnection } from '../provider/brain';

type ToView =
  | {
      type: 'status';
      hasKey: boolean;
      sourceLabel: string;
      provider: string;
      providers: ProviderSummary[];
      model: string;
      models: string[];
      baseURL: string;
      cliDetail: string;
    }
  | { type: 'testResult'; ok: boolean; message: string };

type FromView =
  | { type: 'ready' }
  | { type: 'saveKey'; key: string }
  | { type: 'clearKey' }
  | { type: 'testConnection' }
  | { type: 'setModel'; model: string }
  | { type: 'setProvider'; provider: string };

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
            await this.updateSetting(webviewView.webview, 'model', msg.model);
          } else {
            await this.postStatus(webviewView.webview);
          }
          break;
        case 'setProvider':
          if (msg.provider === 'meta' || msg.provider === 'cli' || msg.provider === 'auto') {
            await this.updateSetting(webviewView.webview, 'provider', msg.provider);
          } else {
            await this.postStatus(webviewView.webview);
          }
          break;
        case 'testConnection': {
          const { provider, baseURL, model, cliPath } = this.getConfig();
          const { key, source } = await getApiKey(this.secrets);
          const result = await testBrainConnection({
            provider,
            apiKey: key,
            baseURL,
            model,
            cliPath,
          });
          const usedCli = result.used === 'cli';
          const via = usedCli
            ? 'terminal login'
            : source === 'secretStorage'
              ? 'stored key'
              : `${ENV_KEY_NAME} env var`;
          const target = usedCli ? 'Muse CLI' : model;
          const note = result.note ? ` ${result.note}` : '';
          await this.post(webviewView.webview, {
            type: 'testResult',
            ok: result.ok,
            message: result.ok
              ? `Connected to ${target} via ${via} in ${result.latencyMs} ms. Reply: ${result.reply || '(empty)'}.${note}`
              : `Failed via ${via}: ${result.message}`,
          });
          break;
        }
      }
    });
  }

  private getConfig() {
    const cfg = vscode.workspace.getConfiguration('ctxWindowExt');
    const resolved = resolveConfig({
      provider: cfg.get<string>('provider'),
      baseURL: cfg.get<string>('baseURL'),
      model: cfg.get<string>('model'),
    });
    return { ...resolved, cliPath: cfg.get<string>('cliPath')?.trim() || undefined };
  }

  private async postStatus(webview: vscode.Webview): Promise<void> {
    const { provider, baseURL, model, cliPath } = this.getConfig();
    const { key, source } = await getApiKey(this.secrets);
    let hasKey = Boolean(key);
    let sourceLabel = !key
      ? 'No API key set'
      : source === 'secretStorage'
        ? 'API key: stored securely in VS Code'
        : `API key: using ${ENV_KEY_NAME} environment variable`;
    let cliDetail = '';
    if (provider === 'cli') {
      const cli = await checkCli(cliPath);
      hasKey = cli.found;
      sourceLabel = cli.found
        ? `Muse CLI: detected${cli.version ? ` (${cli.version})` : ''}`
        : 'Muse CLI: not found — install it and log in from your terminal';
      cliDetail = cli.found
        ? `No key needed — uses your terminal login (${cli.path}).`
        : 'No key needed — but the `muse` binary was not found on PATH or ~/.local/bin.';
    } else if (provider === 'auto') {
      const cli = await checkCli(cliPath);
      hasKey = cli.found || Boolean(key);
      if (cli.found && key) {
        sourceLabel = 'Auto: CLI detected and API key set — CLI first, key as fallback';
      } else if (cli.found) {
        sourceLabel = `Auto: CLI detected${cli.version ? ` (${cli.version})` : ''} — API key fallback not set`;
      } else if (key) {
        sourceLabel = 'Auto: CLI not found — will use API key';
      } else {
        sourceLabel = 'Auto: no CLI and no API key set';
      }
      cliDetail = cli.found
        ? `Terminal login ready (${cli.path}); the API key below is the fallback.`
        : 'Muse CLI not found — the API key below is the active path.';
    }
    await this.post(webview, {
      type: 'status',
      hasKey,
      sourceLabel,
      provider,
      providers: SELECTIONS,
      model,
      models: SUPPORTED_MODELS,
      baseURL,
      cliDetail,
    });
  }

  private async post(webview: vscode.Webview, msg: ToView): Promise<void> {
    await webview.postMessage(msg);
  }

  /** Persist a setting, surface failures loudly, then always refresh status. */
  private async updateSetting(
    webview: vscode.Webview,
    key: 'model' | 'provider',
    value: string,
  ): Promise<void> {
    try {
      await vscode.workspace
        .getConfiguration('ctxWindowExt')
        .update(key, value, vscode.ConfigurationTarget.Global);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Ctx: could not save ${key} setting: ${err instanceof Error ? err.message : err}`,
      );
    }
    await this.postStatus(webview);
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

  <h2>2 · Brain provider</h2>
  <label for="provider">Which brain drives the extension (your app may use any model)</label>
  <select id="provider"></select>
  <div id="cliHint" class="meta"></div>

  <div id="modelSection">
  <h2>3 · Brain model</h2>
  <label for="model">Model used by this extension (your app may use any model)</label>
  <select id="model"></select>
  <div id="baseurl" class="meta"></div>
  </div>

  <div id="keySection">
  <h2>4 · API key</h2>
  <label for="key">Meta Model API key — stored in VS Code SecretStorage, never in your code</label>
  <input id="key" type="password" placeholder="Paste key, then Save" autocomplete="off" spellcheck="false">
  <div class="row">
    <button id="save">Save key</button>
    <button id="clear" class="secondary">Clear</button>
  </div>
  </div>

  <h2>5 · Verify</h2>
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
    const prov = $('provider');
    prov.textContent = '';
    for (const p of msg.providers) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.displayName;
      if (p.id === msg.provider) { opt.selected = true; }
      prov.appendChild(opt);
    }
    const pinnedCli = msg.provider === 'cli';
    $('modelSection').style.display = pinnedCli ? 'none' : '';
    $('keySection').style.display = pinnedCli ? 'none' : '';
    $('cliHint').textContent = msg.provider === 'meta' ? '' : msg.cliDetail;
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
  $('provider').addEventListener('change', (e) => {
    vscode.postMessage({ type: 'setProvider', provider: e.target.value });
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
