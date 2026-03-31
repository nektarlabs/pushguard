import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { GuardStagedConfig } from "../config/schema.js";
import type { AnalysisResult } from "../types.js";

export async function analyzeWithCodex(
  systemPrompt: string,
  userPrompt: string,
  config: GuardStagedConfig,
  cwd: string = process.cwd(),
): Promise<AnalysisResult> {
  const prompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

  const outputFile = join(tmpdir(), `pushguard-codex-${randomUUID()}.txt`);

  const args = ["exec", "-", "-m", config.model, "--sandbox", "read-only", "-o", outputFile];

  const stdout = await spawnCodex(args, prompt, cwd, config.timeout);

  // Read the last message from the output file, fall back to stdout
  let response: string;
  try {
    response = await readFile(outputFile, "utf-8");
    await unlink(outputFile).catch(() => {});
  } catch {
    response = stdout;
  }

  return parseCodexResponse(response);
}

function spawnCodex(args: string[], prompt: string, cwd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("codex", args, {
      cwd,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    // Feed prompt via stdin
    child.stdin.write(prompt);
    child.stdin.end();

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Codex CLI timed out"));
    }, timeoutMs);

    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Codex CLI exited with code ${code}: ${stderr}`));
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

function parseCodexResponse(raw: string): AnalysisResult {
  // Try to extract JSON from the text response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in Codex response");
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
