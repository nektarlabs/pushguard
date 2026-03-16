import { existsSync } from "node:fs";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { log } from "../output/reporter.js";

const exec = promisify(execFile);

const HUSKY_HOOK_CONTENT = `npx pushguard\n`;

const GLOBAL_HOOK_CONTENT = `#!/bin/sh

# pushguard global pre-push hook
# Runs pushguard on every git push

# Skip if PUSHGUARD_SKIP is set
if [ -n "$PUSHGUARD_SKIP" ]; then
  exit 0
fi

# Chain local hooks if they exist
LOCAL_HOOK="$(git rev-parse --git-dir 2>/dev/null)/hooks/pre-push.local"
if [ -f "$LOCAL_HOOK" ]; then
  "$LOCAL_HOOK" "$@"
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    exit $EXIT_CODE
  fi
fi

# Chain husky hook if it exists
HUSKY_HOOK=".husky/pre-push"
if [ -f "$HUSKY_HOOK" ]; then
  sh "$HUSKY_HOOK" "$@"
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    exit $EXIT_CODE
  fi
fi

pushguard "$@"
`;

export async function init(cwd: string = process.cwd(), options: { husky?: boolean } = {}): Promise<void> {
  if (options.husky) {
    await initHusky(cwd);
  } else {
    await initGlobal();
  }

  log("pushguard will now analyze changes before each push.");
  console.error("");
  console.error("  Configuration (optional):");
  console.error('  Add a "pushguard" key to package.json or create .pushguard.json');
  console.error("");
}

async function initGlobal(): Promise<void> {
  const hooksDir = resolve(homedir(), ".pushguard", "hooks");

  await mkdir(hooksDir, { recursive: true });

  const hookPath = resolve(hooksDir, "pre-push");
  await writeFile(hookPath, GLOBAL_HOOK_CONTENT, { mode: 0o755 });

  // Set global core.hooksPath
  await exec("git", ["config", "--global", "core.hooksPath", hooksDir]);

  log(`Created global pre-push hook at ${hookPath}`);
  log("Set git global core.hooksPath to " + hooksDir);
}

async function initHusky(cwd: string): Promise<void> {
  const huskyDir = resolve(cwd, ".husky");

  if (!existsSync(huskyDir)) {
    log("Husky not found. Initializing...");
    try {
      await exec("npx", ["husky", "init"], { cwd });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(
        `Failed to initialize Husky. Make sure husky is installed:\n  npm install -D husky\n\nError: ${msg}`,
      );
      process.exit(1);
    }
  }

  const hookPath = resolve(huskyDir, "pre-push");
  await writeFile(hookPath, HUSKY_HOOK_CONTENT, { mode: 0o755 });

  log("Created .husky/pre-push hook");
}

export async function uninstall(): Promise<void> {
  const hooksDir = resolve(homedir(), ".pushguard", "hooks");
  const pushguardDir = resolve(homedir(), ".pushguard");

  // Check if core.hooksPath points to our directory
  try {
    const { stdout } = await exec("git", ["config", "--global", "core.hooksPath"]);
    if (stdout.trim() === hooksDir) {
      await exec("git", ["config", "--global", "--unset", "core.hooksPath"]);
      log("Removed global core.hooksPath setting");
    } else {
      log("core.hooksPath points to " + stdout.trim() + " (not pushguard) — skipping");
    }
  } catch {
    log("No global core.hooksPath configured — skipping");
  }

  // Remove ~/.pushguard directory
  if (existsSync(pushguardDir)) {
    await rm(pushguardDir, { recursive: true });
    log("Removed " + pushguardDir);
  }

  log("pushguard global hook uninstalled.");
}
