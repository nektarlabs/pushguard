import { describe, expect, it } from "vitest";
import { extractClaudeErrorMessage } from "./claude.js";

describe("extractClaudeErrorMessage", () => {
  it("extracts Claude's result from an error JSON response", () => {
    const stdout = JSON.stringify({
      is_error: true,
      result: "Not logged in · Please run /login",
    });

    expect(extractClaudeErrorMessage(stdout, "")).toBe("Not logged in · Please run /login");
  });

  it("uses stderr when stdout has no useful error", () => {
    expect(extractClaudeErrorMessage("", "Authentication failed\n")).toBe("Authentication failed");
  });

  it("uses raw stdout when it is not JSON", () => {
    expect(extractClaudeErrorMessage("Model unavailable\n", "")).toBe("Model unavailable");
  });

  it("reports when Claude returned no error details", () => {
    expect(extractClaudeErrorMessage("", "")).toBe("No error details returned");
  });
});
