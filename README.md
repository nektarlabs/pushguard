# pushguard

Pre-push hook that analyzes your code changes with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) before pushing. Catches security issues, bugs, logic errors, and code quality problems automatically.

## Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- Node.js >= 22.14.0
- Git

## Install

```bash
npm install -g @nektarlabs/pushguard
```

## Setup

### Global (recommended)

```bash
pushguard init
```

This installs a global git `pre-push` hook at `~/.pushguard/hooks/` and configures `core.hooksPath` so pushguard runs on every push in any repository. No per-repo setup or dependencies required.

If the repository has local hooks (`.husky/pre-push` or `.git/hooks/pre-push.local`), they are chained automatically and run before pushguard.

To uninstall:

```bash
pushguard uninstall
```

### With Husky (per-project)

```bash
pnpm add -D @nektarlabs/pushguard husky
npx pushguard init --husky
```

This creates a `.husky/pre-push` hook that runs pushguard before every push in that project.

## Skipping pushguard

To temporarily skip pushguard on a push:

```bash
PUSHGUARD_SKIP=1 git push
```

## How it works

1. You run `git push`
2. Pushguard computes the diff of all unpushed commits
3. The diff is sent to Claude Code for analysis
4. Claude returns a structured verdict with categorized issues
5. Push is **blocked** if any issue meets the severity threshold, otherwise allowed

## Manual analysis

You can run the analysis manually at any time without pushing:

```bash
pushguard analyze
```

This diffs your unpushed commits against the remote tracking branch (or `origin/main` as fallback) and runs the same analysis as the pre-push hook.

## Configuration

Pushguard loads configuration with the following priority (highest first):

1. `.pushguard.json` in the repo root
2. `"pushguard"` key in the repo's `package.json`
3. `~/.pushguard/config.json` (global config, shared across all repos)
4. Built-in defaults

Add a `"pushguard"` key to your `package.json`, create a `.pushguard.json` file, or set global defaults in `~/.pushguard/config.json`:

```json
{
  "categories": ["security", "bug", "logic", "performance", "quality", "style"],
  "blockOnSeverity": "high",
  "model": "claude-opus-4-6",
  "maxDiffSize": 100000,
  "failOnError": false,
  "exclude": ["*.lock", "*.min.js", "*.map", "dist/**"],
  "verbose": false,
  "skipBranches": ["develop"],
  "timeout": 300000,
  "customPrompt": "Also check for proper error handling"
}
```

### Options

| Option            | Default                                                         | Description                                                                  |
| ----------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `categories`      | `["security", "bug", "logic"]`                                  | What to check: `security`, `bug`, `logic`, `performance`, `quality`, `style` |
| `blockOnSeverity` | `"high"`                                                        | Minimum severity to block push: `critical`, `high`, `medium`, `low`          |
| `model`           | `"claude-opus-4-6"`                                             | Claude model to use                                                          |
| `maxDiffSize`     | `100000`                                                        | Max diff size in bytes before truncation                                     |
| `failOnError`     | `false`                                                         | Block push if Claude CLI errors (fail-open by default)                       |
| `exclude`         | `["*.lock", "*.min.js", "*.map", "dist/**", "node_modules/**"]` | File patterns to skip                                                        |
| `verbose`         | `false`                                                         | Show full analysis summary                                                   |
| `skipBranches`    | `[]`                                                            | Branch patterns to skip (supports trailing `*` wildcard)                     |
| `timeout`         | `300000`                                                        | Timeout in milliseconds for Claude CLI (default 5 min)                       |
| `customPrompt`    | —                                                               | Additional instructions for the review                                       |

## Example output

```
pushguard: Analyzing 3 changed files before push...

  CRITICAL  security  src/auth/login.ts:42
  Hardcoded API secret exposed in source code
  > Move to environment variable: const API_KEY = process.env.API_KEY

  HIGH  bug  src/utils/parse.ts:18
  Uncaught exception when input is null
  > Add null check: if (input == null) return []

  HIGH  logic  src/billing/calc.ts:55
  Wrong comparison operator causes free tier users to be charged
  > Change `>=` to `>`: if (usage > FREE_TIER_LIMIT)

pushguard: Push BLOCKED (1 critical, 2 high)
```

## License

MIT
