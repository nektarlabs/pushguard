import type { AnalysisResult, AnalysisIssue } from "../types.js";

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: COLORS.red + COLORS.bold,
  high: COLORS.red,
  medium: COLORS.yellow,
  low: COLORS.cyan,
  info: COLORS.dim,
};

const PREFIX = `${COLORS.magenta}pushguard${COLORS.reset}`;

export function log(message: string): void {
  console.error(`${PREFIX}: ${message}`);
}

export function reportStart(fileCount: number): void {
  log(`Analyzing ${fileCount} changed file${fileCount === 1 ? "" : "s"} before push...`);
}

export function reportResult(result: AnalysisResult, verbose: boolean): void {
  console.error("");

  if (result.issues.length > 0) {
    for (const issue of result.issues) {
      reportIssue(issue);
    }
    console.error("");
  }

  if (verbose) {
    log(result.summary);
  }

  const verdictLine = formatVerdict(result);
  log(verdictLine);
  console.error("");
}

function reportIssue(issue: AnalysisIssue): void {
  const color = SEVERITY_COLORS[issue.severity] ?? COLORS.dim;
  const severity = `${color}${issue.severity.toUpperCase()}${COLORS.reset}`;
  const category = `${COLORS.dim}${issue.category}${COLORS.reset}`;

  let location = "";
  if (issue.file) {
    location = `  ${COLORS.dim}${issue.file}${issue.line ? `:${issue.line}` : ""}${COLORS.reset}`;
  }

  console.error(`  ${severity}  ${category}${location}`);
  console.error(`  ${issue.message}`);

  if (issue.suggestion) {
    console.error(`  ${COLORS.dim}> ${issue.suggestion}${COLORS.reset}`);
  }

  console.error("");
}

function formatVerdict(result: AnalysisResult): string {
  const issueCounts = countBySeverity(result.issues);
  const countStr = Object.entries(issueCounts)
    .map(([sev, count]) => `${count} ${sev}`)
    .join(", ");

  switch (result.verdict) {
    case "fail":
      return `${COLORS.red}${COLORS.bold}Push BLOCKED${COLORS.reset} (${countStr})`;
    case "warn":
      return `${COLORS.yellow}Push allowed with warnings${COLORS.reset} (${countStr})`;
    case "pass":
      return `${COLORS.green}Push OK${COLORS.reset} — no issues found`;
  }
}

function countBySeverity(issues: AnalysisIssue[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const issue of issues) {
    counts[issue.severity] = (counts[issue.severity] ?? 0) + 1;
  }
  return counts;
}
