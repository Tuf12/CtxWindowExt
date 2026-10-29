// Provider registry: defaults for the extension brain.
// Pure module — no vscode import, so it stays headless-testable.
// Extension code reads workspace settings and passes overrides into resolveConfig().

/** Concrete brains — the runnable ends of a chain. */
export type ProviderId = 'meta' | 'cli';

/** What the user picks: a concrete brain, or the auto chain. */
export type ProviderSelection = 'auto' | ProviderId;

export const DEFAULT_SELECTION: ProviderSelection = 'auto';

export interface ProviderSummary {
  id: ProviderSelection;
  displayName: string;
  needsKey: boolean;
}

export const SELECTIONS: ProviderSummary[] = [
  { id: 'auto', displayName: 'Auto (CLI, then API key)', needsKey: false },
  { id: 'meta', displayName: 'Meta Model API', needsKey: true },
  { id: 'cli', displayName: 'Muse CLI (terminal login)', needsKey: false },
];

export function normalizeSelection(value: unknown): ProviderSelection {
  if (value === 'meta' || value === 'cli' || value === 'auto') {
    return value;
  }
  return DEFAULT_SELECTION;
}

/** Ordered concrete brains to attempt for a selection. */
export function resolveChain(selection: ProviderSelection): ProviderId[] {
  if (selection === 'meta') {
    return ['meta'];
  }
  if (selection === 'cli') {
    return ['cli'];
  }
  return ['cli', 'meta'];
}

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
  provider: ProviderSelection;
  baseURL: string;
  model: string;
}

export interface ProviderConfigOverrides {
  provider?: unknown;
  baseURL?: string;
  model?: string;
}

export function resolveConfig(overrides: ProviderConfigOverrides = {}): ProviderConfig {
  return {
    provider: normalizeSelection(overrides.provider ?? DEFAULT_SELECTION),
    baseURL: overrides.baseURL?.trim() || META_DEFAULTS.baseURL,
    model: overrides.model?.trim() || META_DEFAULTS.model,
  };
}
