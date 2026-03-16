import type { GuardStagedConfig } from "../config/schema.js";
import type { DiffResult } from "../types.js";

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;

export function buildSystemPrompt(config: GuardStagedConfig): string {
  const categories = config.categories.join(", ");
  const blockIdx = SEVERITY_ORDER.indexOf(config.blockOnSeverity);
  const blockSeverities = SEVERITY_ORDER.slice(0, blockIdx + 1).join(", ");

  let prompt = `You are a code review guardian analyzing a git diff before push.
You are running in the project's root directory. When analyzing changes, consider how they interact with the rest of the codebase — read related files as needed to understand the full context (e.g. callers, imports, types, tests, configs).

Focus areas: ${categories}
Blocking severities: ${blockSeverities}

Rules:
- Set verdict to "fail" if any issue of severity ${blockSeverities} is found
- Set verdict to "warn" if issues exist but none meet the blocking threshold
- Set verdict to "pass" if no actionable issues are found
- Be precise about file paths and line numbers (from the diff headers)
- Only report real, actionable issues — no nitpicks unless "style" is in the focus areas
- For security issues, check for: hardcoded secrets, injection vulnerabilities, auth bypasses, insecure crypto, exposed sensitive data
- For bugs, check for: null/undefined errors, off-by-one, race conditions, unhandled exceptions
- For logic errors, check for: incorrect conditionals, inverted boolean logic, wrong operator (e.g. && vs ||), unreachable code paths, missing edge cases, incorrect state transitions, flawed control flow, wrong variable used in comparisons, off-by-one in loops/ranges
- For every issue, always include a "suggestion" field with a concrete fix (show the corrected code snippet when possible)
- Be concise in messages and suggestions
- When in doubt about how a changed function is used, read the relevant source files to verify before reporting an issue

Respond with ONLY a JSON object (no markdown, no code fences, no explanation) matching this exact schema:
{
  "verdict": "pass" | "warn" | "fail",
  "summary": "Brief summary of findings",
  "issues": [
    {
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "category": "security" | "bug" | "logic" | "performance" | "quality" | "style",
      "file": "path/to/file",
      "line": 42,
      "message": "Description of the issue",
      "suggestion": "How to fix it (include corrected code when possible)"
    }
  ]
}`;

  if (config.customPrompt) {
    prompt += `\n\nAdditional instructions:\n${config.customPrompt}`;
  }

  return prompt;
}

export function buildUserPrompt(diffResult: DiffResult): string {
  if (!diffResult.diff) {
    return "No changes to analyze.";
  }

  let prompt = `## Changed files\n${diffResult.files.join("\n")}\n\n`;

  if (diffResult.truncated) {
    prompt += `**Note:** The diff was truncated due to size. Focus on the available content.\n\n`;
  }

  prompt += `## Diff\n\`\`\`diff\n${diffResult.diff}\n\`\`\``;

  return prompt;
}
