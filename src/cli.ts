#!/usr/bin/env node

import { parseArgs } from "node:util";

async function main(): Promise<void> {
  const { positionals } = parseArgs({
    allowPositionals: true,
    strict: false,
  });

  const command = positionals[0];

  switch (command) {
    case "init": {
      const { init } = await import("./setup/install.js");
      await init();
      break;
    }
    case "analyze": {
      const { runAnalyze } = await import("./hooks/analyze.js");
      const exitCode = await runAnalyze();
      process.exit(exitCode);
      break;
    }
    default: {
      // Default: run as pre-push hook
      const { runPrePush } = await import("./hooks/pre-push.js");
      const exitCode = await runPrePush();
      process.exit(exitCode);
    }
  }
}

main().catch((error) => {
  console.error("guard-staged: Fatal error:", error);
  process.exit(1);
});
