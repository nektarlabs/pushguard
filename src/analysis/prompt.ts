import type { GuardStagedConfig } from "../config/schema.js";
import type { DiffResult } from "../types.js";

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;

export function buildSystemPrompt(config: GuardStagedConfig): string {
  const categories = config.categories.join(", ");
  const blockIdx = SEVERITY_ORDER.indexOf(config.blockOnSeverity);
  const blockSeverities = SEVERITY_ORDER.slice(0, blockIdx + 1).join(", ");

  let prompt = `You are a code review guardian analyzing a git diff before push.
You are running in the project's root directory. When analyzing changes, consider how they interact with the rest of the codebase. Full contents of the changed files and their direct dependents are provided below the diff for context — use them to understand imports, callers, types, and surrounding logic. If you need additional context beyond what is provided, read related files as needed.

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
- For performance issues, check for: O(n²) or worse loops that could be O(n), unbounded queries or fetches without pagination/limits, missing indexes on queried fields, synchronous blocking calls in async hot paths, large allocations inside loops, redundant re-computation that should be cached or memoized, n+1 query patterns, reading entire files or datasets when only a subset is needed
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

  // Include full file contents for context
  const contextEntries = Object.entries(diffResult.context);
  if (contextEntries.length > 0) {
    prompt += `\n\n## Full file contents (changed files and related files)\n`;
    prompt += `Use these to understand how the changes interact with the rest of the codebase. Only report issues on code that appears in the diff above.\n\n`;

    for (const [filePath, content] of contextEntries) {
      const ext = filePath.split(".").pop() ?? "";
      prompt += `### ${filePath}\n\`\`\`${ext}\n${content}\n\`\`\`\n\n`;
    }
  }

  return prompt;
}
