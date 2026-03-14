import type { GuardStagedConfig } from "./schema.js";

export const DEFAULTS: GuardStagedConfig = {
  categories: ["security", "bug", "logic"],
  blockOnSeverity: "high",
  model: "claude-opus-4-6",
  maxDiffSize: 100_000,
  failOnError: false,
  exclude: ["*.lock", "*.min.js", "*.map", "dist/**", "node_modules/**"],
  verbose: false,
  skipBranches: [],
};
