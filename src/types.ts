export interface PushRef {
  localRef: string;
  localSha: string;
  remoteRef: string;
  remoteSha: string;
  isNew: boolean;
  isDelete: boolean;
}

export interface AnalysisIssue {
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: "security" | "bug" | "logic" | "performance" | "quality" | "style";
  file?: string;
  line?: number;
  message: string;
  suggestion: string;
}

export interface AnalysisResult {
  verdict: "pass" | "warn" | "fail";
  summary: string;
  issues: AnalysisIssue[];
}

export interface DiffResult {
  diff: string;
  files: string[];
  truncated: boolean;
  context: Record<string, string>;
}
