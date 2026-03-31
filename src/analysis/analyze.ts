import type { GuardStagedConfig } from "../config/schema.js";
import type { AnalysisResult } from "../types.js";
import { analyzeWithClaude } from "./claude.js";
import { analyzeWithCodex } from "./codex.js";

export async function analyze(
  systemPrompt: string,
  userPrompt: string,
  config: GuardStagedConfig,
  cwd: string = process.cwd(),
): Promise<AnalysisResult> {
  switch (config.provider) {
    case "codex":
      return analyzeWithCodex(systemPrompt, userPrompt, config, cwd);
    case "claude":
    default:
      return analyzeWithClaude(systemPrompt, userPrompt, config, cwd);
  }
}
