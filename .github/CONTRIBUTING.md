# Contributing to AddonExe

Thank you for your interest in contributing to **AddonExe**! We welcome bug reports, feature suggestions, documentation improvements, and high-quality code contributions.

AddonExe is a modular server management, economy, and gameplay suite designed for Minecraft Bedrock Edition using modern Bedrock Script APIs (`@minecraft/server`).

---

## Table of Contents

- [Code Owner & PR Governance](#code-owner--pr-governance)
- [Ways to Contribute](#ways-to-contribute)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Development Environment Setup](#development-environment-setup)
- [Contribution & Git Workflow](#contribution--git-workflow)
- [Architectural & Coding Standards](#architectural--coding-standards)
- [AI-Assisted Contributions Policy](#ai-assisted-contributions-policy)
- [Two-Stage Review Protocol](#two-stage-review-protocol)
- [Code of Conduct](#code-of-conduct)

---

## Code Owner & PR Governance

- **Repository Owner:** `@SjnExe` is the sole repository code owner (per `.github/CODEOWNERS`).
- **PR Approval:** All pull requests from contributors are reviewed and approved directly by `@SjnExe`.
- **Merge Governance:** The repository uses **Rebase & Merge** (`gh pr merge <pr> --rebase`) to preserve clean linear history with curated atomic commits. Squash merges are reserved strictly for single isolated changes or explicit owner direction.

---

## Ways to Contribute

- **Report Bugs:** Open a structured report via our [Bug Report Form](https://github.com/SjnExe/AddonExe/issues/new?template=bug_report.yml).
- **Propose Features:** Submit an idea via our [Feature Request Form](https://github.com/SjnExe/AddonExe/issues/new?template=feature_request.yml).
- **Improve Documentation:** Keep guides in `docs/` accurate, clear, and up-to-date with new releases.
- **Submit Pull Requests:** Write clean, strictly-typed TypeScript and contribute bug fixes, optimizations, or new modules.

---

## Reporting Bugs

Before reporting a bug:

1. Verify that you are using the latest release or canary build.
2. Review the [Troubleshooting Guide](../docs/troubleshooting.md) and [F.A.Q.](../docs/faq.md).
3. Search existing [GitHub Issues](https://github.com/SjnExe/AddonExe/issues) to avoid duplicates.
4. Enable the **Content Log** in Minecraft (`Settings -> Creator -> Enable Content Log GUI / File`) and include any `[Scripting][error]` or `[UI][error]` output in your report.

---

## Suggesting Features

When submitting feature suggestions:

- Describe the user use case and problem statement clearly.
- Consider Bedrock Script API capabilities and constraints.
- Suggest sensible default settings (all player-facing features must default to `enabled: false`).

---

## Development Environment Setup

AddonExe relies strictly on **Bun** and TypeScript.

```bash
# Clone the repository
git clone https://github.com/SjnExe/AddonExe.git
cd AddonExe

# Install dependencies (strictly locked)
bun install --frozen-lockfile
```

See [AGENTS.md](../AGENTS.md) for full architecture and development specifications.

---

## Contribution & Git Workflow

1. **Fork & Branch:** Create a feature branch off `main` with a descriptive name (e.g., `feat/bounty-tax-override`, `fix/xray-cave-detection`).
2. **Curated Atomic Commits:**
   - Every commit must be logical, self-contained, compilable, and pass all automated tests.
   - Do **NOT** create intermediate noise commits (e.g. `fix lint`, `fix typo`, `address comments`). Use `git commit --amend` or `git commit --fixup <hash>` with `git rebase -i --autosquash`.
   - Commit messages must follow Conventional Commits (e.g., `feat(anticheat): ...`, `fix(shop): ...`) with a detailed explanation in the commit body.
3. **Verify Locally:** Run the automated quality gate before opening a PR:
   ```bash
   bun fmt --changed && bun lint:check && bun test --parallel && bun run build
   ```
4. **Submit PR:** Open a PR against `main` using the provided [Pull Request Template](pull_request_template.md).

---

## Architectural & Coding Standards

Contributors must adhere to the core standards detailed in [AGENTS.md](../AGENTS.md):

- **Naming Conventions:**
  - Project variables, functions, parameters, properties, and filenames use `camelCase`.
  - Classes, interfaces, types, and enums use `PascalCase`.
  - **No `snake_case` or `UPPER_SNAKE_CASE`** in project TypeScript files (except where mandated by native Minecraft APIs or JSON UI schemas).
- **Vanilla Data Constants:** Always import block, item, entity, and dimension types from `@minecraft/vanilla-data`. Never hardcode `'minecraft:...'` strings.
- **Entity & Object Safety:**
  - Always verify `.isValid` on player and entity instances across tick boundaries, explosions, and hurt/die events.
  - Guard nullable values with strict type guards (`isDefined`, `isNonEmptyString`, `isNumber` from `@lib/guards.js`).
  - Sanitize dynamic string literals in `runCommand()` using `escapeCommandArg()` and wrap them in double quotes. Validate structured command syntax, such as coordinates and target selectors, against the expected grammar instead of quoting it.
- **Engine Performance & Lag Prevention:**
  - Prevent runaway iteration and mass synchronous native C++ engine calls (batch block lookups and decay sweeps).
  - Consolidate item drop entities using `new ItemStack(typeId, count)` rather than spawning single-item entities.
- **Player-Facing Feature Defaulting Policy:**
  - All player-facing survival, gameplay, QoL, and economy systems must default to **`enabled: false`**.
  - Only administrative, staff-only, or security systems may default to `enabled: true`.
- **Never Edit Build Artifacts:** Never modify files in `packs/behavior/scripts/` or generated `manifest.json`. Modify TypeScript files in `src/` and run `bun run build`.

---

## AI-Assisted Contributions Policy

AddonExe actively leverages AI pair programming, autonomous agent verification, and automated review bots to maintain high performance and rigorous quality standards across the codebase.

We welcome contributions developed with the assistance of artificial intelligence tools (e.g. GitHub Copilot, ChatGPT, Claude, Antigravity, Cursor). However, to protect server stability and Bedrock engine compatibility, human contributors must adhere to the following policies:

- **Full Human Authorship & Responsibility:** You are 100% accountable for every line of code you submit. Blindly copying and pasting raw LLM output without understanding it is strictly prohibited. You must be able to explain, defend, and debug your implementation during code review.
- **Engine Safety & Invariants:** AI tools frequently hallucinate non-existent Bedrock Script APIs or overlook critical engine invariants. Any AI-assisted code must verify entity validity (`.isValid`), import vanilla IDs from `@minecraft/vanilla-data`, inspect `event.brokenBlockPermutation` in `PlayerBreakBlockAfterEvent` handlers, and default player-facing features to `enabled: false`.
- **Mandatory Local Testing:** AI-generated code must pass the full local test suite (`bun test --parallel`), strict casing/typechecks (`bun lint:check`), and be verified in-game on a live Bedrock world before opening a PR. Untested or speculative AI code will be rejected without review.
- **Automated Bot Reviews:** Pull requests are automatically reviewed by CodeRabbit. Treat automated reviews as actionable feedback, verify findings against Bedrock runtime behavior, and resolve all review comments before requesting merge. Detailed instructions for AI coding agents reside in [AGENTS.md](../AGENTS.md).

---

## Two-Stage Review Protocol

Concluding any feature, refactor, or bugfix requires **2 consecutive zero-issue passes**:

1. **Stage 1 (Automated Validation & Snapshot Coherence):**
   Develop in a dedicated feature branch or isolated worktree with no unrelated modifications. Stage only your task-relevant modifications and newly created files (`git add <files>`) or specific hunks (`git add -p`). If unrelated working-tree modifications or untracked files exist, stash them (`git stash push --keep-index -u`) before running the validation suite so tests run against the exact intended commit snapshot without interference from uncommitted or untracked files:

   ```bash
   bun fmt --changed && bun lint:check && bun test --parallel && bun run build
   ```

   If `bun fmt --changed` formatted any task files, re-stage only the formatted task changes (`git add <files>` or `git add -p`) so the staged snapshot matches the tested working tree. If you stashed unrelated changes before validation, restore them (`git stash pop`) after committing your changes, and resolve any conflicts.

2. **Stage 2 (Comprehensive Diff Review):**
   Perform a thorough review across all change states against the PR target branch (defaulting to `main`):
   - Fetch the PR target branch: `git fetch -q https://github.com/SjnExe/AddonExe.git "${BASE_BRANCH:-main}" || exit 1`
   - Compute merge base (halting if no common ancestor exists): `MERGE_BASE="$(git merge-base FETCH_HEAD HEAD)" || exit 1`
   - Committed changes through `HEAD`: `git diff "$MERGE_BASE"..HEAD`
   - Staged changes: `git diff --staged`
   - Unstaged modifications: `git diff`
   - Untracked files: `git status --short`

   When assessing modifications to exported functions, event handlers, lifecycle hooks, or public types, do not review diff hunks in a vacuum—inspect the full enclosing file, related call sites, and test coverage to ensure system-wide semantic integrity:
   - **Correctness & Boundaries:** Check entity validity (`player.isValid`, `entity.isValid`), strict guards (`isDefined`, `isNonEmptyString`), array bounds, and error wrapping (`try/catch`).
   - **Test Rigor & Completeness:** Verify 1:1 bi-directional parity between newly added features/registries and test suites (ensuring unique registrations and comparing identities against discovered files, not counts alone), test negative conditions and exclusions, and assert mock/spy call counts and payloads.
   - **Performance & Engine Safety:** Respect the Bedrock 50ms tick budget, use O(1) Map/Set lookups over O(N) array scans in hot paths, batch native C++ calls, consolidate item entity drops (`new ItemStack`), and verify bundler tree-shaking.
   - **Bedrock Standards & UI:** Confirm vanilla data constants from `@minecraft/vanilla-data`, valid dark-mode section colors (`§`) and grid headers, and default `enabled: false` on player features.
   - **Architecture & Modularity:** Ensure zero circular dependencies, organize commands into domain barrels (`src/features/<domain>/commands/index.ts`), and add complete JSDoc docstrings to exported symbols.

3. **Reset Invariant:** Any code change during review resets the pass counter to 0. You must achieve **2 consecutive passes with zero issues found and zero edits made in the final pass**.

---

## Code of Conduct

All contributors and community members are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
