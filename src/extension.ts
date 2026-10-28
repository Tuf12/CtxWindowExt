import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const stub = (phase: string) =>
    vscode.window.showInformationMessage(`CtxWindowExt: not yet implemented (${phase}).`);

  context.subscriptions.push(
    vscode.commands.registerCommand('ctxWindowExt.setApiKey', () => stub('Phase 1')),
    vscode.commands.registerCommand('ctxWindowExt.testConnection', () => stub('Phase 1')),
    vscode.commands.registerCommand('ctxWindowExt.tagCodebase', () => stub('Phase 4')),
    vscode.commands.registerCommand('ctxWindowExt.showTrace', () => stub('Phase 3')),
    vscode.commands.registerCommand('ctxWindowExt.removeInstrumentation', () => stub('Phase 4')),
  );
}

export function deactivate() {}
