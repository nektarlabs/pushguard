import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserPrompt } from "./prompt.js";
import type { GuardStagedConfig } from "../config/schema.js";
import type { DiffResult } from "../types.js";
import { DEFAULTS } from "../config/defaults.js";

function makeConfig(overrides: Partial<GuardStagedConfig> = {}): GuardStagedConfig {
  return { ...DEFAULTS, ...overrides };
}

function makeDiff(overrides: Partial<DiffResult> = {}): DiffResult {
  return {
    diff: "--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new",
    files: ["file.ts"],
    truncated: false,
    context: {},
    ...overrides,
  };
}

describe("buildSystemPrompt", () => {
  it("includes configured categories", () => {
    const prompt = buildSystemPrompt(makeConfig({ categories: ["security", "bug"] }));
    expect(prompt).toContain("Focus areas: security, bug");
  });

  it("includes blocking severities up to configured threshold", () => {
    const prompt = buildSystemPrompt(makeConfig({ blockOnSeverity: "medium" }));
    expect(prompt).toContain("Blocking severities: critical, high, medium");
  });

  it("includes custom prompt when provided", () => {
    const prompt = buildSystemPrompt(makeConfig({ customPrompt: "Also check for typos" }));
    expect(prompt).toContain("Additional instructions:\nAlso check for typos");
  });

  it("does not include additional instructions when customPrompt is absent", () => {
    const prompt = buildSystemPrompt(makeConfig());
    expect(prompt).not.toContain("Additional instructions:");
  });

  it("mentions context files in the system prompt", () => {
    const prompt = buildSystemPrompt(makeConfig());
    expect(prompt).toContain("Full contents of the changed files and their direct dependents");
  });

  it("includes performance detection rules", () => {
    const prompt = buildSystemPrompt(makeConfig());
    expect(prompt).toContain("For performance issues, check for:");
    expect(prompt).toContain("n+1 query patterns");
    expect(prompt).toContain("synchronous blocking calls in async hot paths");
    expect(prompt).toContain("redundant re-computation");
  });
});

describe("buildUserPrompt", () => {
  it("returns no-changes message for empty diff", () => {
    const prompt = buildUserPrompt(makeDiff({ diff: "" }));
    expect(prompt).toBe("No changes to analyze.");
  });

  it("lists changed files", () => {
    const prompt = buildUserPrompt(makeDiff({ files: ["src/a.ts", "src/b.ts"] }));
    expect(prompt).toContain("## Changed files\nsrc/a.ts\nsrc/b.ts");
  });

  it("includes the diff in a code block", () => {
    const diff = "--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n-a\n+b";
    const prompt = buildUserPrompt(makeDiff({ diff }));
    expect(prompt).toContain("```diff\n" + diff + "\n```");
  });

  it("adds truncation note when diff is truncated", () => {
    const prompt = buildUserPrompt(makeDiff({ truncated: true }));
    expect(prompt).toContain("The diff was truncated due to size");
  });

  it("does not add truncation note when not truncated", () => {
    const prompt = buildUserPrompt(makeDiff({ truncated: false }));
    expect(prompt).not.toContain("truncated");
  });

  describe("context", () => {
    it("does not include context section when context is empty", () => {
      const prompt = buildUserPrompt(makeDiff({ context: {} }));
      expect(prompt).not.toContain("Full file contents");
    });

    it("includes context section header when context is provided", () => {
      const prompt = buildUserPrompt(makeDiff({ context: { "src/utils.ts": "export const x = 1;" } }));
      expect(prompt).toContain("## Full file contents (changed files and related files)");
    });

    it("includes instruction to only report issues on diffed code", () => {
      const prompt = buildUserPrompt(makeDiff({ context: { "src/utils.ts": "export const x = 1;" } }));
      expect(prompt).toContain("Only report issues on code that appears in the diff above");
    });

    it("includes file content with correct heading and extension", () => {
      const content = 'export function hello() { return "hi"; }';
      const prompt = buildUserPrompt(makeDiff({ context: { "src/hello.ts": content } }));
      expect(prompt).toContain("### src/hello.ts");
      expect(prompt).toContain("```ts\n" + content + "\n```");
    });

    it("includes multiple context files", () => {
      const prompt = buildUserPrompt(
        makeDiff({
          context: {
            "src/a.ts": "const a = 1;",
            "src/b.js": "const b = 2;",
            "lib/c.py": "c = 3",
          },
        }),
      );
      expect(prompt).toContain("### src/a.ts");
      expect(prompt).toContain("```ts\nconst a = 1;\n```");
      expect(prompt).toContain("### src/b.js");
      expect(prompt).toContain("```js\nconst b = 2;\n```");
      expect(prompt).toContain("### lib/c.py");
      expect(prompt).toContain("```py\nc = 3\n```");
    });

    it("context section appears after the diff section", () => {
      const prompt = buildUserPrompt(makeDiff({ context: { "src/x.ts": "code" } }));
      const diffPos = prompt.indexOf("## Diff");
      const contextPos = prompt.indexOf("## Full file contents");
      expect(diffPos).toBeGreaterThan(-1);
      expect(contextPos).toBeGreaterThan(diffPos);
    });
  });
});
