import type { GuardStagedConfig } from "./schema.js";

export const DEFAULT_MODELS: Record<GuardStagedConfig["provider"], string> = {
  claude: "claude-opus-4-8",
  codex: "gpt-5.6-sol",
};

export const DEFAULTS: GuardStagedConfig = {
  provider: "claude",
  categories: ["security", "bug", "logic"],
  blockOnSeverity: "high",
  model: DEFAULT_MODELS.claude,
  maxDiffSize: 100_000,
  exclude: ["*.lock", "*.min.js", "*.map", "dist/**", "node_modules/**"],
  verbose: false,
  skipBranches: [],
  timeout: 3_600_000,
  translateIssues: false,
  translationLanguage: "Italian",
  includeContext: true,
  maxContextSize: 500_000,
};
