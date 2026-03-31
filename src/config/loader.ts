import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import type { GuardStagedConfig } from "./schema.js";
import { DEFAULTS, DEFAULT_MODELS } from "./defaults.js";

export async function loadConfig(cwd: string = process.cwd()): Promise<GuardStagedConfig> {
  const localOverrides = (await loadFromRc(cwd)) ?? (await loadFromPackageJson(cwd));
  const globalOverrides = await loadFromGlobalConfig();

  const envOverrides = loadFromEnv();
  const merged = { ...DEFAULTS, ...globalOverrides, ...localOverrides, ...envOverrides };

  // If provider was changed but model wasn't explicitly set, use the provider's default model
  const modelExplicitlySet = envOverrides.model ?? localOverrides?.model ?? globalOverrides?.model;
  if (!modelExplicitlySet && merged.provider !== DEFAULTS.provider) {
    merged.model = DEFAULT_MODELS[merged.provider];
  }

  return merged;
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

const VALID_PROVIDERS: GuardStagedConfig["provider"][] = ["claude", "codex"];

function loadFromEnv(): Partial<GuardStagedConfig> {
  const overrides: Partial<GuardStagedConfig> = {};

  const provider = process.env.PUSHGUARD_PROVIDER?.toLowerCase();
  if (provider && VALID_PROVIDERS.includes(provider as GuardStagedConfig["provider"])) {
    overrides.provider = provider as GuardStagedConfig["provider"];
  }

  const model = process.env.PUSHGUARD_MODEL;
  if (model) {
    overrides.model = model;
  }

  return overrides;
}

async function loadFromGlobalConfig(): Promise<Partial<GuardStagedConfig> | null> {
  try {
    const content = await readFile(resolve(homedir(), ".pushguard", "config.json"), "utf-8");
    return JSON.parse(content) as Partial<GuardStagedConfig>;
  } catch {
    return null;
  }
}
