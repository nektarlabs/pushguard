import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { log } from "../output/reporter.js";

const exec = promisify(execFile);

const HOOK_CONTENT = `npx pushguard\n`;

export async function init(cwd: string = process.cwd()): Promise<void> {
  const huskyDir = resolve(cwd, ".husky");

  // Check if husky is set up
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

  // Create the pre-push hook
  const hookPath = resolve(huskyDir, "pre-push");
  await writeFile(hookPath, HOOK_CONTENT, { mode: 0o755 });

  log("Created .husky/pre-push hook");
  log("pushguard will now analyze changes before each push.");
  console.error("");
  console.error("  Configuration (optional):");
  console.error('  Add a "pushguard" key to package.json or create .pushguard.json');
  console.error("");
}
