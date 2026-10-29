import * as vscode from 'vscode';
import { resolveConfig } from './provider/registry';
import { getApiKey, setStoredKey, redactKey, ENV_KEY_NAME } from './provider/keys';
import { testConnection } from './provider/meta';
import { SetupViewProvider } from './ui/setupView';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SetupViewProvider.viewId,
      new SetupViewProvider(context.extensionUri, context.secrets),
    ),
  );

  const stub = (phase: string) =>
    vscode.window.showInformationMessage(`CtxWindowExt: not yet implemented (${phase}).`);

  context.subscriptions.push(
    vscode.commands.registerCommand('ctxWindowExt.setApiKey', async () => {
      const input = await vscode.window.showInputBox({
        prompt: `Enter your Meta Model API key (stored securely). Leave empty to clear and fall back to ${ENV_KEY_NAME}.`,
        password: true,
        ignoreFocusOut: true,
      });
      if (input === undefined) {
        return; // user cancelled
      }
      const key = input.trim();
      await setStoredKey(context.secrets, key || undefined);
      if (key) {
        vscode.window.showInformationMessage(`Ctx: API key saved (ending ${redactKey(key)}).`);
      } else {
        vscode.window.showInformationMessage(
          `Ctx: stored key cleared. Will fall back to the ${ENV_KEY_NAME} environment variable.`,
        );
      }
    }),

    vscode.commands.registerCommand('ctxWindowExt.testConnection', async () => {
      const cfg = vscode.workspace.getConfiguration('ctxWindowExt');
      const { baseURL, model } = resolveConfig({
        baseURL: cfg.get<string>('baseURL'),
        model: cfg.get<string>('model'),
      });
      const { key, source } = await getApiKey(context.secrets);
      if (!key) {
        vscode.window.showErrorMessage(
          `Ctx: no API key found. Run "Ctx: Set API Key" or set the ${ENV_KEY_NAME} environment variable.`,
        );
        return;
      }
      const sourceLabel =
        source === 'secretStorage' ? `stored key (ending ${redactKey(key)})` : `${ENV_KEY_NAME} env var`;
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Ctx: testing connection to ${model}…`,
        },
        async () => {
          const result = await testConnection({ apiKey: key, baseURL, model });
          if (result.ok) {
            vscode.window.showInformationMessage(
              `Ctx: connected to ${model} via ${sourceLabel} in ${result.latencyMs} ms. Reply: ${result.reply || '(empty)'}`,
            );
          } else {
            vscode.window.showErrorMessage(`Ctx: connection failed (${sourceLabel}): ${result.message}`);
          }
        },
      );
    }),

    vscode.commands.registerCommand('ctxWindowExt.tagCodebase', () => stub('Phase 4')),
    vscode.commands.registerCommand('ctxWindowExt.showTrace', () => stub('Phase 3')),
    vscode.commands.registerCommand('ctxWindowExt.removeInstrumentation', () => stub('Phase 4')),
  );
}

export function deactivate() {}
