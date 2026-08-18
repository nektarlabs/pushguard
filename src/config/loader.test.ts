import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULTS } from "./defaults.js";
import { loadConfig } from "./loader.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(() => Promise.reject(new Error("not found"))),
}));

describe("loadConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses PUSHGUARD_TIMEOUT as the highest-priority timeout", async () => {
    vi.stubEnv("PUSHGUARD_TIMEOUT", "7200000");

    const config = await loadConfig("/nonexistent");

    expect(config.timeout).toBe(7_200_000);
  });

  it.each(["0", "-1", "1.5", "not-a-number"])("ignores invalid PUSHGUARD_TIMEOUT value %s", async (timeout) => {
    vi.stubEnv("PUSHGUARD_TIMEOUT", timeout);

    const config = await loadConfig("/nonexistent");

    expect(config.timeout).toBe(DEFAULTS.timeout);
  });

  it.each(["1", "true"])("enables issue translations with PUSHGUARD_TRANSLATE_ISSUES=%s", async (value) => {
    vi.stubEnv("PUSHGUARD_TRANSLATE_ISSUES", value);

    const config = await loadConfig("/nonexistent");

    expect(config.translateIssues).toBe(true);
  });

  it.each(["0", "false"])("disables issue translations with PUSHGUARD_TRANSLATE_ISSUES=%s", async (value) => {
    vi.stubEnv("PUSHGUARD_TRANSLATE_ISSUES", value);

    const config = await loadConfig("/nonexistent");

    expect(config.translateIssues).toBe(false);
  });

  it("uses PUSHGUARD_TRANSLATION_LANGUAGE as the translation language", async () => {
    vi.stubEnv("PUSHGUARD_TRANSLATION_LANGUAGE", "Spanish");

    const config = await loadConfig("/nonexistent");

    expect(config.translationLanguage).toBe("Spanish");
  });
});
