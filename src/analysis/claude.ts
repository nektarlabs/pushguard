import { spawn } from "node:child_process";
import type { GuardStagedConfig } from "../config/schema.js";
import type { AnalysisResult } from "../types.js";

const TIMEOUT_MS = 60_000;

export async function analyzeWithClaude(
  systemPrompt: string,
  userPrompt: string,
  config: GuardStagedConfig,
): Promise<AnalysisResult> {
  const prompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

  const args = ["-p", prompt, "--output-format", "json", "--model", config.model, "--max-turns", "1"];

  const stdout = await spawnClaude(args);
  return parseClaudeResponse(stdout);
}

function spawnClaude(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
      env: {
        ...process.env,
        CLAUDE_CODE_ENTRYPOINT: undefined,
        CLAUDECODE: undefined,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Claude CLI timed out"));
    }, TIMEOUT_MS);

    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    child.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function parseClaudeResponse(raw: string): AnalysisResult {
  const response = JSON.parse(raw);

  // Claude CLI --output-format json wraps the result
  const text: string = response.result ?? response.content ?? raw;

  // Try to extract JSON from the text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in Claude response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as AnalysisResult;

  // Validate required fields
  if (!parsed.verdict || !parsed.summary || !Array.isArray(parsed.issues)) {
    throw new Error("Invalid analysis result structure");
  }

  if (!["pass", "warn", "fail"].includes(parsed.verdict)) {
    throw new Error(`Invalid verdict: ${parsed.verdict}`);
  }

  return parsed;
}
