#!/usr/bin/env node

import { parseArgs } from "node:util";

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    strict: false,
    options: {
      husky: { type: "boolean", default: false },
    },
  });

  const command = positionals[0];

  switch (command) {
    case "init": {
      const { init } = await import("./setup/install.js");
      await init(process.cwd(), { husky: values.husky as boolean });
      break;
    }
    case "uninstall": {
      const { uninstall } = await import("./setup/install.js");
      await uninstall();
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
