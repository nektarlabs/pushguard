import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getDiff } from "../git/diff.js";
import { getRelatedContext } from "../git/context.js";
import { buildSystemPrompt, buildUserPrompt } from "../analysis/prompt.js";
import { analyzeWithClaude } from "../analysis/claude.js";
import { loadConfig } from "../config/loader.js";
import { log, reportStart, reportResult } from "../output/reporter.js";
import type { PushRef } from "../types.js";

const exec = promisify(execFile);

/**
 * Standalone analyze command — diffs unpushed commits against the remote
 * tracking branch without needing git hook stdin.
 */
export async function runAnalyze(): Promise<number> {
  const config = await loadConfig();

  const localSha = await resolveHead();
  const remoteSha = await resolveUpstream();

  if (!remoteSha) {
    log("No upstream tracking branch found. Use: git push -u origin <branch>");
    log("Falling back to diff against origin/main...");
    const fallback = await resolveFallback();
    if (!fallback) {
      log("Could not determine a base to diff against.");
      return 1;
    }
    return runDiffAndAnalyze({ remoteSha: fallback, localSha }, config);
  }

  return runDiffAndAnalyze({ remoteSha, localSha }, config);
}

async function runDiffAndAnalyze(
  refs: { remoteSha: string; localSha: string },
  config: Awaited<ReturnType<typeof loadConfig>>,
): Promise<number> {
  const pushRef: PushRef = {
    localRef: "HEAD",
    localSha: refs.localSha,
    remoteRef: "",
    remoteSha: refs.remoteSha,
    isNew: false,
    isDelete: false,
  };

  try {
    const diffResult = await getDiff(pushRef, config);

    if (diffResult.files.length === 0) {
      log("No unpushed changes to analyze.");
      return 0;
    }

    // Gather full file context for changed and related files
    diffResult.context = await getRelatedContext(diffResult.files, config);

    reportStart(diffResult.files.length);

    const systemPrompt = buildSystemPrompt(config);
    const userPrompt = buildUserPrompt(diffResult);
    const result = await analyzeWithClaude(systemPrompt, userPrompt, config);

    reportResult(result, config.verbose);
    return result.verdict === "fail" ? 1 : 0;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`Analysis error: ${msg}`);
    return config.failOnError ? 1 : 0;
  }
}

async function resolveHead(): Promise<string> {
  const { stdout } = await exec("git", ["rev-parse", "HEAD"]);
  return stdout.trim();
}

async function resolveUpstream(): Promise<string | null> {
  try {
    const { stdout } = await exec("git", ["rev-parse", "@{upstream}"]);
    return stdout.trim();
  } catch {
    return null;
  }
}

async function resolveFallback(): Promise<string | null> {
  try {
    const { stdout } = await exec("git", ["rev-parse", "origin/main"]);
    return stdout.trim();
  } catch {
    try {
      const { stdout } = await exec("git", ["rev-parse", "origin/master"]);
      return stdout.trim();
    } catch {
      return null;
    }
  }
}
