import { createInterface } from "node:readline";
import type { PushRef } from "../types.js";

const ZERO_SHA = "0000000000000000000000000000000000000000";

export async function parsePushRefs(input: NodeJS.ReadableStream = process.stdin): Promise<PushRef[]> {
  const refs: PushRef[] = [];

  const rl = createInterface({ input, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 4) continue;

    const [localRef, localSha, remoteRef, remoteSha] = parts;

    refs.push({
      localRef: localRef!,
      localSha: localSha!,
      remoteRef: remoteRef!,
      remoteSha: remoteSha!,
      isNew: remoteSha === ZERO_SHA,
      isDelete: localRef === "(delete)" || localSha === ZERO_SHA,
    });
  }

  return refs;
}
