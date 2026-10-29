// Trace panel: `Ctx: Show Trace` webview wiring.
// Thin VS Code layer over the pure view-model + watcher: resolves the trace file
// per active workspace folder, posts run-list + selected-run-detail messages,
// and opens click-to-source targets with graceful failure.

import * as path from 'path';
import * as vscode from 'vscode';
import { ParseWarning } from '../trace/store';
import { TraceUpdate, TraceWatcher, watchTraceFile } from '../trace/watcher';
import {
  buildViewModel,
  EmptyReason,
  resolveSourcePath,
  RunDetailView,
  RunSummary,
} from './viewModel';
import { getTraceHtml } from './webview/html';

type ToView =
  | {
      type: 'runs';
      runs: RunSummary[];
      selectedRunId: string | null;
      warnings: ParseWarning[];
      empty: EmptyReason | null;
    }
  | { type: 'detail'; detail: RunDetailView | null };

type FromView =
  | { type: 'ready' }
  | { type: 'selectRun'; runId: string }
  | { type: 'openSource'; file: string; lines: [number, number] };

export class TracePanel {
  private static current: TracePanel | null = null;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private watcher: TraceWatcher | null = null;
  private rootFsPath: string | null = null;
  /** Explicit user selection; null means follow the latest run. */
  private selectedRunId: string | null = null;
  private lastUpdate: TraceUpdate = { runs: [], warnings: [] };

  public static show(context: vscode.ExtensionContext): void {
    const root = resolveActiveRoot();
    if (TracePanel.current) {
      TracePanel.current.panel.reveal(vscode.ViewColumn.One);
      TracePanel.current.retarget(root);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'ctxWindowExt.trace',
      'Ctx: Trace',
      vscode.ViewColumn.One,
      { enableScripts: true, localResourceRoots: [context.extensionUri] },
    );
    TracePanel.current = new TracePanel(panel, context.extensionUri);
    TracePanel.current.retarget(root);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    panel.webview.html = getTraceHtml({ cspSource: panel.webview.cspSource, nonce: getNonce() });
    panel.webview.onDidReceiveMessage((msg: FromView) => void this.onMessage(msg));
    panel.onDidDispose(() => {
      this.watcher?.dispose();
      this.watcher = null;
      TracePanel.current = null;
    });
  }

  /** Point the panel at a workspace root (re-resolves on every Show Trace). */
  private retarget(root: string | null): void {
    if (root === this.rootFsPath && this.watcher) {
      this.postState();
      return;
    }
    this.watcher?.dispose();
    this.watcher = null;
    this.rootFsPath = root;
    this.selectedRunId = null;
    this.lastUpdate = { runs: [], warnings: [] };
    if (!root) {
      this.postState();
      return;
    }
    const traceFile = path.join(root, '.ctx-tracker', 'trace.jsonl');
    this.watcher = watchTraceFile(
      traceFile,
      {
        onUpdate: (update) => {
          this.lastUpdate = update;
          this.postState();
        },
        onError: (err) => {
          vscode.window.showWarningMessage(`Ctx: trace watch error: ${err.message}`);
        },
      },
      { debounceMs: 150 },
    );
    // The watcher only fires on fs events — push the initial state explicitly.
    void this.watcher.refresh();
  }

  private postState(): void {
    const model = buildViewModel(this.lastUpdate.runs, this.lastUpdate.warnings, {
      selectedRunId: this.selectedRunId,
      workspaceOpen: this.rootFsPath !== null,
    });
    const runsMsg: ToView = {
      type: 'runs',
      runs: model.runs,
      selectedRunId: model.selectedRunId,
      warnings: model.warnings,
      empty: model.empty,
    };
    const detailMsg: ToView = { type: 'detail', detail: model.detail };
    void this.panel.webview.postMessage(runsMsg);
    void this.panel.webview.postMessage(detailMsg);
  }

  private async onMessage(msg: FromView): Promise<void> {
    switch (msg.type) {
      case 'ready':
        this.postState();
        break;
      case 'selectRun': {
        this.selectedRunId = msg.runId;
        const model = buildViewModel(this.lastUpdate.runs, this.lastUpdate.warnings, {
          selectedRunId: this.selectedRunId,
          workspaceOpen: this.rootFsPath !== null,
        });
        await this.panel.webview.postMessage({
          type: 'runs',
          runs: model.runs,
          selectedRunId: model.selectedRunId,
          warnings: model.warnings,
          empty: model.empty,
        });
        await this.panel.webview.postMessage({ type: 'detail', detail: model.detail });
        break;
      }
      case 'openSource':
        await this.openSource(msg.file, msg.lines);
        break;
    }
  }

  private async openSource(file: string, lines: [number, number]): Promise<void> {
    if (!this.rootFsPath) {
      vscode.window.showWarningMessage('Ctx: no workspace folder open.');
      return;
    }
    const absPath = resolveSourcePath(this.rootFsPath, file);
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absPath));
      const start = clampLine(lines[0], doc);
      const end = clampLine(lines[1], doc);
      await vscode.window.showTextDocument(doc, {
        selection: new vscode.Range(start, 0, end, 0),
      });
    } catch {
      vscode.window.showWarningMessage(`Ctx: source not found (moved or deleted): ${file}`);
    }
  }
}

function resolveActiveRoot(): string | null {
  const editorUri = vscode.window.activeTextEditor?.document.uri;
  const folder = editorUri ? vscode.workspace.getWorkspaceFolder(editorUri) : undefined;
  return (
    folder?.uri.fsPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null
  );
}

function clampLine(oneBased: number, doc: vscode.TextDocument): number {
  const line = Math.floor(oneBased) - 1;
  if (!Number.isFinite(line) || line < 0) {
    return 0;
  }
  return Math.min(line, Math.max(doc.lineCount - 1, 0));
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}
