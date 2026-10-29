// Provider registry: defaults for the extension brain.
// Pure module — no vscode import, so it stays headless-testable.
// Extension code reads workspace settings and passes overrides into resolveConfig().

export type ProviderId = 'meta';

export interface ProviderDefaults {
  id: ProviderId;
  displayName: string;
  baseURL: string;
  model: string;
  limits: { context: number; output: number };
}

export const SUPPORTED_MODELS: string[] = ['muse-spark-1.3'];

export const META_DEFAULTS: ProviderDefaults = {
  id: 'meta',
  displayName: 'Meta Model API',
  baseURL: 'https://api.meta.ai/v1',
  model: 'muse-spark-1.3',
  limits: { context: 1048576, output: 131072 },
};

export interface ProviderConfig {
  provider: ProviderId;
  baseURL: string;
  model: string;
}

export function resolveConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    provider: overrides.provider ?? META_DEFAULTS.id,
    baseURL: overrides.baseURL?.trim() || META_DEFAULTS.baseURL,
    model: overrides.model?.trim() || META_DEFAULTS.model,
  };
}
