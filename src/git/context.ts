import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import type { GuardStagedConfig } from "../config/schema.js";

const exec = promisify(execFile);

/**
 * Gathers full file contents for changed files and their direct dependents
 * (files that import/require the changed files), up to a size budget.
 */
export async function getRelatedContext(
  changedFiles: string[],
  config: GuardStagedConfig,
): Promise<Record<string, string>> {
  if (!config.includeContext || changedFiles.length === 0) {
    return {};
  }

  const cwd = process.cwd();
  const budget = config.maxContextSize;

  // Kick off git grep and changed-file reads in parallel
  const [changedContents, relatedFiles] = await Promise.all([
    readFilesBatch(changedFiles, cwd),
    findRelatedFiles(changedFiles, config),
  ]);

  const context: Record<string, string> = {};
  let totalSize = 0;

  // 1. Add changed files first (highest priority)
  for (const file of changedFiles) {
    if (totalSize >= budget) break;
    const content = changedContents.get(file);
    if (content === undefined) continue;

    const size = Buffer.byteLength(content);
    if (totalSize + size > budget) continue;

    context[file] = content;
    totalSize += size;
  }

  // 2. Read related files in parallel, then fill budget
  const relatedToRead = relatedFiles.filter((f) => !context[f]);
  const relatedContents = await readFilesBatch(relatedToRead, cwd);

  for (const file of relatedToRead) {
    if (totalSize >= budget) break;
    const content = relatedContents.get(file);
    if (content === undefined) continue;

    const size = Buffer.byteLength(content);
    if (totalSize + size > budget) continue;

    context[file] = content;
    totalSize += size;
  }

  return context;
}

/**
 * Reads multiple files concurrently, returning a map of path -> content.
 * Files that fail to read are silently omitted.
 */
async function readFilesBatch(files: string[], cwd: string): Promise<Map<string, string>> {
  const results = await Promise.allSettled(
    files.map(async (file) => {
      const content = await readFile(join(cwd, file), "utf-8");
      return [file, content] as const;
    }),
  );

  const map = new Map<string, string>();
  for (const result of results) {
    if (result.status === "fulfilled") {
      map.set(result.value[0], result.value[1]);
    }
  }
  return map;
}

/**
 * Finds files in the repo that import or require any of the changed files.
 */
async function findRelatedFiles(changedFiles: string[], config: GuardStagedConfig): Promise<string[]> {
  // Build search patterns from changed file names (without extensions)
  const moduleNames = changedFiles.map((f) => f.replace(/\.[^.]+$/, ""));

  if (moduleNames.length === 0) return [];

  const pattern = moduleNames.map((m) => escapeRegex(m)).join("|");

  try {
    const { stdout } = await exec("git", ["grep", "-l", "-E", `(import|require|from).*?(${pattern})`], {
      maxBuffer: 50 * 1024 * 1024,
    });

    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .filter((f: string) => !changedFiles.includes(f))
      .filter((f: string) => !matchesExcludePattern(f, config.exclude));
  } catch {
    // git grep returns exit code 1 when no matches found
    return [];
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesExcludePattern(file: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.startsWith("*.")) {
      return file.endsWith(pattern.slice(1));
    }
    if (pattern.endsWith("/**")) {
      return file.startsWith(pattern.slice(0, -3));
    }
    return file === pattern;
  });
}
