import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PushRef, DiffResult } from "../types.js";
import type { GuardStagedConfig } from "../config/schema.js";

const exec = promisify(execFile);

export async function getDefaultBranch(): Promise<string> {
  try {
    const { stdout } = await exec("git", ["symbolic-ref", "refs/remotes/origin/HEAD", "--short"]);
    return stdout.trim().replace("origin/", "");
  } catch {
    return "main";
  }
}

export async function getDiff(pushRef: PushRef, config: GuardStagedConfig): Promise<DiffResult> {
  if (pushRef.isDelete) {
    return { diff: "", files: [], truncated: false };
  }

  let baseRef: string;

  if (pushRef.isNew) {
    const defaultBranch = await getDefaultBranch();
    try {
      const { stdout } = await exec("git", ["merge-base", `origin/${defaultBranch}`, pushRef.localSha]);
      baseRef = stdout.trim();
    } catch {
      // If merge-base fails, diff against the default branch tip
      baseRef = `origin/${defaultBranch}`;
    }
  } else {
    baseRef = pushRef.remoteSha;
  }

  // Get the list of changed files
  const { stdout: fileList } = await exec("git", [
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    `${baseRef}..${pushRef.localSha}`,
  ]);

  const files = fileList
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((f) => !matchesExcludePattern(f, config.exclude));

  if (files.length === 0) {
    return { diff: "", files: [], truncated: false };
  }

  // Get the full diff
  const { stdout: diff } = await exec("git", [
    "diff",
    "--diff-filter=ACMR",
    `${baseRef}..${pushRef.localSha}`,
    "--",
    ...files,
  ]);

  // Check size and truncate if needed
  if (Buffer.byteLength(diff) > config.maxDiffSize) {
    const { stdout: stat } = await exec("git", [
      "diff",
      "--stat",
      "--diff-filter=ACMR",
      `${baseRef}..${pushRef.localSha}`,
      "--",
      ...files,
    ]);

    const truncatedDiff = diff.slice(0, config.maxDiffSize);
    return {
      diff: `[TRUNCATED — diff exceeded ${config.maxDiffSize} bytes]\n\n## Diff stat\n${stat}\n\n## Partial diff\n${truncatedDiff}`,
      files,
      truncated: true,
    };
  }

  return { diff, files, truncated: false };
}

function matchesExcludePattern(file: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    // Simple glob matching: *.ext and dir/**
    if (pattern.startsWith("*.")) {
      return file.endsWith(pattern.slice(1));
    }
    if (pattern.endsWith("/**")) {
      return file.startsWith(pattern.slice(0, -3));
    }
    return file === pattern;
  });
}
