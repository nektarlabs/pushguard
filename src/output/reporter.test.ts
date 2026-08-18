import { afterEach, describe, expect, it, vi } from "vitest";
import { reportResult } from "./reporter.js";

describe("reportResult", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints the translated summary below its issue", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});

    reportResult(
      {
        verdict: "fail",
        summary: "One issue found",
        issues: [
          {
            severity: "high",
            category: "bug",
            file: "src/example.ts",
            line: 10,
            message: "The value can be undefined.",
            translatedSummary: "Il valore può essere indefinito.",
            suggestion: "Check the value before using it.",
          },
        ],
      },
      false,
    );

    expect(output.mock.calls.flat().join("\n")).toContain("Il valore può essere indefinito.");
  });
});
