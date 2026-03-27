import { parsePushRefs } from "../git/parse-stdin.js";
import { getDiff } from "../git/diff.js";
import { getRelatedContext } from "../git/context.js";
import { buildSystemPrompt, buildUserPrompt } from "../analysis/prompt.js";
import { analyzeWithClaude } from "../analysis/claude.js";
import { loadConfig } from "../config/loader.js";
import { log, reportStart, reportResult } from "../output/reporter.js";

export async function runPrePush(): Promise<number> {
  const config = await loadConfig();

  // Check if current branch should be skipped
  if (config.skipBranches.length > 0) {
    const branch = await getCurrentBranch();
    if (branch && config.skipBranches.some((p) => matchBranch(branch, p))) {
      log(`Skipping analysis for branch "${branch}"`);
      return 0;
    }
  }

  // Parse push refs from stdin
  const refs = await parsePushRefs();

  if (refs.length === 0) {
    return 0;
  }

  let hasFailure = false;

  for (const ref of refs) {
    if (ref.isDelete) {
      continue;
    }

    try {
      const diffResult = await getDiff(ref, config);

      if (diffResult.files.length === 0) {
        log("No relevant changes to analyze.");
        continue;
      }

      // Gather full file context for changed and related files
      diffResult.context = await getRelatedContext(diffResult.files, config);

      reportStart(diffResult.files.length);

      if (diffResult.truncated) {
        log("Diff was truncated due to size — analysis may be partial.");
      }

      const systemPrompt = buildSystemPrompt(config);
      const userPrompt = buildUserPrompt(diffResult);

      const result = await analyzeWithClaude(systemPrompt, userPrompt, config);
      reportResult(result, config.verbose);

      if (result.verdict === "fail") {
        hasFailure = true;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log(`Analysis error: ${msg}`);

      if (config.failOnError) {
        log("Push blocked due to analysis error (failOnError is enabled).");
        return 1;
      }

      log("Allowing push despite analysis error (fail-open mode).");
    }
  }

  return hasFailure ? 1 : 0;
}

async function getCurrentBranch(): Promise<string | null> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);

  try {
    const { stdout } = await exec("git", ["branch", "--show-current"]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function matchBranch(branch: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return branch.startsWith(pattern.slice(0, -1));
  }
  return branch === pattern;
}
