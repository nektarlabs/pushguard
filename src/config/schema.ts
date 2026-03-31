export interface GuardStagedConfig {
  /** AI provider to use for analysis */
  provider: "claude" | "codex";
  /** Categories to check */
  categories: ("security" | "bug" | "logic" | "performance" | "quality" | "style")[];
  /** Minimum severity to block push */
  blockOnSeverity: "critical" | "high" | "medium" | "low";
  /** AI model to use */
  model: string;
  /** Max diff size in bytes before truncation */
  maxDiffSize: number;
  /** Whether to block push if Claude CLI fails */
  failOnError: boolean;
  /** File patterns to exclude from analysis */
  exclude: string[];
  /** Custom additional prompt instructions */
  customPrompt?: string;
  /** Whether to show the full analysis or just the verdict */
  verbose: boolean;
  /** Skip analysis for these branch patterns */
  skipBranches: string[];
  /** Timeout in milliseconds for Claude CLI */
  timeout: number;
  /** Whether to include full file contents of changed and related files */
  includeContext: boolean;
  /** Max size in bytes for context files */
  maxContextSize: number;
}
