import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRelatedContext } from "./context.js";
import { DEFAULTS } from "../config/defaults.js";
import type { GuardStagedConfig } from "../config/schema.js";

// Mock node:child_process and node:fs/promises
vi.mock("node:child_process", () => {
  const fn = vi.fn();
  return {
    execFile: fn,
  };
});

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";

const mockExecFile = vi.mocked(execFile);
const mockReadFile = vi.mocked(readFile);

function makeConfig(overrides: Partial<GuardStagedConfig> = {}): GuardStagedConfig {
  return { ...DEFAULTS, ...overrides };
}

/**
 * Helper: make execFile call the callback with the given stdout.
 * node:child_process.execFile uses callback style before promisify wraps it.
 */
function mockGitGrep(stdout: string) {
  (mockExecFile as ReturnType<typeof vi.fn>).mockImplementation((...args: unknown[]) => {
    const cb = typeof args[2] === "function" ? args[2] : args[3];
    if (typeof cb === "function") cb(null, { stdout, stderr: "" });
    return undefined;
  });
}

function mockGitGrepNoMatch() {
  (mockExecFile as ReturnType<typeof vi.fn>).mockImplementation((...args: unknown[]) => {
    const cb = typeof args[2] === "function" ? args[2] : args[3];
    if (typeof cb === "function") cb(new Error("exit code 1"), { stdout: "", stderr: "" });
    return undefined;
  });
}

function mockFileContents(files: Record<string, string>) {
  (mockReadFile as ReturnType<typeof vi.fn>).mockImplementation((path: unknown) => {
    const pathStr = String(path);
    const rel = Object.keys(files).find((f) => pathStr.endsWith(f));
    if (rel && files[rel] !== undefined) {
      return Promise.resolve(files[rel]);
    }
    return Promise.reject(new Error("ENOENT"));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getRelatedContext", () => {
  it("returns empty when includeContext is false", async () => {
    const result = await getRelatedContext(["src/utils.ts"], makeConfig({ includeContext: false }));
    expect(result).toEqual({});
  });

  it("returns empty when no changed files", async () => {
    const result = await getRelatedContext([], makeConfig());
    expect(result).toEqual({});
  });

  it("includes full content of changed files", async () => {
    mockGitGrepNoMatch();
    mockFileContents({
      "src/utils.ts": "export const add = (a: number, b: number) => a + b;",
    });

    const result = await getRelatedContext(["src/utils.ts"], makeConfig());

    expect(result["src/utils.ts"]).toBe("export const add = (a: number, b: number) => a + b;");
  });

  describe("related file discovery (dependents of changed files)", () => {
    it("includes files that import the changed file", async () => {
      // Changed file: src/utils.ts
      // Related files: src/app.ts and src/handler.ts both import src/utils
      mockGitGrep("src/app.ts\nsrc/handler.ts\n");
      mockFileContents({
        "src/utils.ts": "export const helper = () => true;",
        "src/app.ts": 'import { helper } from "./utils";',
        "src/handler.ts": 'import { helper } from "../utils";',
      });

      const result = await getRelatedContext(["src/utils.ts"], makeConfig());

      expect(result["src/utils.ts"]).toBeDefined();
      expect(result["src/app.ts"]).toBe('import { helper } from "./utils";');
      expect(result["src/handler.ts"]).toBe('import { helper } from "../utils";');
    });

    it("picks up many dependents of a single changed utility file", async () => {
      // Scenario: src/auth.ts is changed, and 5 other files import it
      const dependents = [
        "src/routes/login.ts",
        "src/routes/signup.ts",
        "src/middleware/session.ts",
        "src/middleware/permissions.ts",
        "src/services/user.ts",
      ];

      mockGitGrep(dependents.join("\n") + "\n");
      mockFileContents({
        "src/auth.ts": "export function verifyToken(t: string) { return t.length > 0; }",
        "src/routes/login.ts": 'import { verifyToken } from "../auth";\napp.post("/login", verifyToken);',
        "src/routes/signup.ts": 'import { verifyToken } from "../auth";\napp.post("/signup", handler);',
        "src/middleware/session.ts": 'import { verifyToken } from "../auth";\nexport const session = verifyToken;',
        "src/middleware/permissions.ts": 'import { verifyToken } from "../auth";\nexport const check = verifyToken;',
        "src/services/user.ts": 'import { verifyToken } from "../auth";\nexport class UserService {}',
      });

      const result = await getRelatedContext(["src/auth.ts"], makeConfig());

      // The changed file itself
      expect(result["src/auth.ts"]).toBeDefined();

      // All 5 dependents should be included
      for (const dep of dependents) {
        expect(result[dep]).toBeDefined();
      }

      expect(Object.keys(result)).toHaveLength(6); // 1 changed + 5 dependents
    });

    it("does not duplicate changed files in the related set", async () => {
      // git grep might return the changed file itself — it should not appear twice
      mockGitGrep("src/utils.ts\nsrc/consumer.ts\n");
      mockFileContents({
        "src/utils.ts": "export const x = 1;",
        "src/consumer.ts": 'import { x } from "./utils";',
      });

      const result = await getRelatedContext(["src/utils.ts"], makeConfig());

      expect(Object.keys(result)).toHaveLength(2);
      expect(result["src/utils.ts"]).toBe("export const x = 1;");
      expect(result["src/consumer.ts"]).toBe('import { x } from "./utils";');
    });

    it("excludes related files matching exclude patterns", async () => {
      mockGitGrep("dist/bundle.js\nsrc/app.ts\n");
      mockFileContents({
        "src/utils.ts": "export const x = 1;",
        "src/app.ts": 'import { x } from "./utils";',
      });

      const result = await getRelatedContext(["src/utils.ts"], makeConfig({ exclude: ["dist/**"] }));

      expect(result["dist/bundle.js"]).toBeUndefined();
      expect(result["src/app.ts"]).toBeDefined();
    });

    it("handles git grep returning no matches gracefully", async () => {
      mockGitGrepNoMatch();
      mockFileContents({
        "src/isolated.ts": "const lonely = true;",
      });

      const result = await getRelatedContext(["src/isolated.ts"], makeConfig());

      expect(result["src/isolated.ts"]).toBe("const lonely = true;");
      expect(Object.keys(result)).toHaveLength(1);
    });
  });

  describe("size budget", () => {
    it("respects maxContextSize for changed files", async () => {
      mockGitGrepNoMatch();
      // Each file is 50 bytes, budget is 80 — only first file fits
      const content = "x".repeat(50);
      mockFileContents({
        "src/a.ts": content,
        "src/b.ts": content,
      });

      const result = await getRelatedContext(["src/a.ts", "src/b.ts"], makeConfig({ maxContextSize: 80 }));

      expect(result["src/a.ts"]).toBeDefined();
      expect(result["src/b.ts"]).toBeUndefined();
    });

    it("respects maxContextSize across changed and related files", async () => {
      // Changed file takes 60 bytes, budget is 100, related file is 60 bytes — doesn't fit
      mockGitGrep("src/consumer.ts\n");
      mockFileContents({
        "src/utils.ts": "x".repeat(60),
        "src/consumer.ts": "y".repeat(60),
      });

      const result = await getRelatedContext(["src/utils.ts"], makeConfig({ maxContextSize: 100 }));

      expect(result["src/utils.ts"]).toBeDefined();
      expect(result["src/consumer.ts"]).toBeUndefined();
    });

    it("fills budget with as many related files as possible", async () => {
      mockGitGrep("src/a.ts\nsrc/b.ts\nsrc/c.ts\n");
      mockFileContents({
        "src/changed.ts": "x".repeat(20),
        "src/a.ts": "a".repeat(30),
        "src/b.ts": "b".repeat(30),
        "src/c.ts": "c".repeat(30),
      });

      // Budget: 20 (changed) + 30 + 30 = 80, third related won't fit
      const result = await getRelatedContext(["src/changed.ts"], makeConfig({ maxContextSize: 85 }));

      expect(result["src/changed.ts"]).toBeDefined();
      expect(result["src/a.ts"]).toBeDefined();
      expect(result["src/b.ts"]).toBeDefined();
      expect(result["src/c.ts"]).toBeUndefined();
    });
  });

  describe("file read errors", () => {
    it("skips files that cannot be read", async () => {
      mockGitGrepNoMatch();
      mockFileContents({
        // src/deleted.ts is NOT in the map — will throw ENOENT
        "src/exists.ts": "const ok = true;",
      });

      const result = await getRelatedContext(["src/deleted.ts", "src/exists.ts"], makeConfig());

      expect(result["src/deleted.ts"]).toBeUndefined();
      expect(result["src/exists.ts"]).toBe("const ok = true;");
    });
  });
});
