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
- **Engine Performance & Lag Prevention:**
  - Prevent runaway iteration and mass synchronous native C++ engine calls (batch block lookups and decay sweeps).
  - Consolidate item drop entities using `new ItemStack(typeId, count)` rather than spawning single-item entities.
- **Player-Facing Feature Defaulting Policy:**
  - All player-facing survival, gameplay, QoL, and economy systems must default to **`enabled: false`**.
  - Only administrative, staff-only, or security systems may default to `enabled: true`.
- **Never Edit Build Artifacts:** Never modify files in `packs/behavior/scripts/` or generated `manifest.json`. Modify TypeScript files in `src/` and run `bun run build`.

---

## AI-Assisted Contributions Policy

We welcome contributions developed with the assistance of artificial intelligence tools, LLMs, and agentic coding assistants. However, contributors bear **100% of the responsibility** to ensure the code is of top-tier quality:

- **Full Understanding & Authorship:** You must thoroughly understand the logic, architecture, and engine implications of any AI-assisted code you submit. You are the code author and must be able to explain, debug, and defend the implementation.
- **Engine Safety & Invariants:** AI tools often hallucinate non-existent Bedrock APIs or overlook engine invariants. All entity references must be strictly verified with `.isValid`, identifiers must be imported from `@minecraft/vanilla-data`, and player-facing features must default to `enabled: false`.
- **Mandatory Local Testing:** AI-generated code must pass the full local test suite (`bun test --parallel`), strict casing/typechecks (`bun lint:check`), and be verified in-game on a live world. Untested or blindly generated AI code will be rejected without review.

---

## Two-Stage Review Protocol

Concluding any feature, refactor, or bugfix requires **2 consecutive zero-issue passes**:

1. **Stage 1 (Automated Validation):**
   ```bash
   bun fmt --changed && bun lint:check && bun test --parallel && bun run build
   ```
2. **Stage 2 (Extensive Diff Review):**
   Perform a comprehensive line-by-line audit of `git diff` against `main` for correctness, entity safety, performance, Bedrock engine invariants, and dark-mode styling.
3. **Reset Invariant:** Any code change during review resets the pass counter to 0. You must achieve **2 consecutive passes with zero issues found and zero edits made in the final pass**.

---

## Code of Conduct

All contributors and community members are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
