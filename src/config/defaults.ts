import type { GuardStagedConfig } from "./schema.js";

export const DEFAULT_MODELS: Record<GuardStagedConfig["provider"], string> = {
  claude: "claude-opus-4-7",
  codex: "gpt-5.3-codex",
};

export const DEFAULTS: GuardStagedConfig = {
  provider: "claude",
  categories: ["security", "bug", "logic"],
  blockOnSeverity: "high",
  model: DEFAULT_MODELS.claude,
  maxDiffSize: 100_000,
  failOnError: false,
  exclude: ["*.lock", "*.min.js", "*.map", "dist/**", "node_modules/**"],
  verbose: false,
  skipBranches: [],
  timeout: 300_000,
  includeContext: true,
  maxContextSize: 500_000,
};
