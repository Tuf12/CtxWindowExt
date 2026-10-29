// API key storage: SecretStorage first, MODEL_API_KEY env fallback.
// Type-only vscode import — erased at compile, safe to require headlessly.

import type * as vscode from 'vscode';

export const SECRET_STORAGE_KEY = 'ctxWindowExt.metaApiKey';
export const ENV_KEY_NAME = 'MODEL_API_KEY';

export type KeySource = 'secretStorage' | 'env' | 'none';

export async function getApiKey(
  secrets: vscode.SecretStorage,
): Promise<{ key?: string; source: KeySource }> {
  const stored = await secrets.get(SECRET_STORAGE_KEY);
  if (stored?.trim()) {
    return { key: stored.trim(), source: 'secretStorage' };
  }
  const env = process.env[ENV_KEY_NAME];
  if (env?.trim()) {
    return { key: env.trim(), source: 'env' };
  }
  return { source: 'none' };
}

export async function setStoredKey(
  secrets: vscode.SecretStorage,
  key: string | undefined,
): Promise<void> {
  if (key) {
    await secrets.store(SECRET_STORAGE_KEY, key);
  } else {
    await secrets.delete(SECRET_STORAGE_KEY);
  }
}

/** Safe display form: never reveals more than the last 4 characters. */
export function redactKey(key: string): string {
  return `••••${key.slice(-4)}`;
}
