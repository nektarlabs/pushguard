import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULTS } from "../config/defaults.js";
import { runPrePush } from "./pre-push.js";

const mocks = vi.hoisted(() => ({
  analyze: vi.fn(),
  getDiff: vi.fn(),
  getRelatedContext: vi.fn(),
  loadConfig: vi.fn(),
  log: vi.fn(),
  parsePushRefs: vi.fn(),
}));

vi.mock("../analysis/analyze.js", () => ({ analyze: mocks.analyze }));
vi.mock("../analysis/prompt.js", () => ({
  buildSystemPrompt: vi.fn(() => "system prompt"),
  buildUserPrompt: vi.fn(() => "user prompt"),
}));
vi.mock("../config/loader.js", () => ({ loadConfig: mocks.loadConfig }));
vi.mock("../git/context.js", () => ({ getRelatedContext: mocks.getRelatedContext }));
vi.mock("../git/diff.js", () => ({ getDiff: mocks.getDiff }));
vi.mock("../git/parse-stdin.js", () => ({ parsePushRefs: mocks.parsePushRefs }));
vi.mock("../output/reporter.js", () => ({
  log: mocks.log,
  reportResult: vi.fn(),
  reportStart: vi.fn(),
}));

describe("runPrePush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfig.mockResolvedValue(DEFAULTS);
    mocks.parsePushRefs.mockResolvedValue([
      {
        localRef: "refs/heads/main",
        localSha: "local-sha",
        remoteRef: "refs/heads/main",
        remoteSha: "remote-sha",
        isNew: false,
        isDelete: false,
      },
    ]);
    mocks.getDiff.mockResolvedValue({
      diff: "+changed code",
      files: ["src/example.ts"],
      truncated: false,
      context: {},
    });
    mocks.getRelatedContext.mockResolvedValue({});
  });

  it("blocks the push when analysis fails", async () => {
    mocks.analyze.mockRejectedValue(new Error("provider timed out"));

    await expect(runPrePush()).resolves.toBe(1);
    expect(mocks.log).toHaveBeenCalledWith("Analysis error: provider timed out");
    expect(mocks.log).toHaveBeenCalledWith("Push blocked due to analysis error.");
  });
});
