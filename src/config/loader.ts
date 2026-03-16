import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import type { GuardStagedConfig } from "./schema.js";
import { DEFAULTS } from "./defaults.js";

export async function loadConfig(cwd: string = process.cwd()): Promise<GuardStagedConfig> {
  const localOverrides = (await loadFromRc(cwd)) ?? (await loadFromPackageJson(cwd));
  const globalOverrides = await loadFromGlobalConfig();

  return { ...DEFAULTS, ...globalOverrides, ...localOverrides };
}

async function loadFromRc(cwd: string): Promise<Partial<GuardStagedConfig> | null> {
  try {
    const content = await readFile(resolve(cwd, ".pushguard.json"), "utf-8");
    return JSON.parse(content) as Partial<GuardStagedConfig>;
  } catch {
    return null;
  }
}

async function loadFromPackageJson(cwd: string): Promise<Partial<GuardStagedConfig> | null> {
  try {
    const content = await readFile(resolve(cwd, "package.json"), "utf-8");
    const pkg = JSON.parse(content) as Record<string, unknown>;
    if (pkg["pushguard"] && typeof pkg["pushguard"] === "object") {
      return pkg["pushguard"] as Partial<GuardStagedConfig>;
    }
    return null;
  } catch {
    return null;
  }
}

async function loadFromGlobalConfig(): Promise<Partial<GuardStagedConfig> | null> {
  try {
    const content = await readFile(resolve(homedir(), ".pushguard", "config.json"), "utf-8");
    return JSON.parse(content) as Partial<GuardStagedConfig>;
  } catch {
    return null;
  }
}
