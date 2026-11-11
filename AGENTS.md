# Agent & AI Operating Directives for AddonExe

This document is the operational execution playbook for autonomous AI coding agents, LLMs, and agentic pair programmers working on **AddonExe**.

> [!IMPORTANT]
> **Foundational Specification Inheritance:**
> Foundational project overview, development commands, coding standards, dark-mode UI conventions, and human-facing policies are defined in [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md).
> AI agents must read and adhere to `CONTRIBUTING.md` as the baseline source of truth. This document defines additional non-negotiable operational invariants, anti-hallucination guardrails, context-expansion requirements, and automated verification protocols strictly for AI execution.

---

## 1. AI Persona, Communication & Execution Invariants

- **Direct & Code-First Communication:** Answer questions and deliver results immediately in the first sentence. Never use corporate buzzwords, generic pleasantries, apologies, or patronizing filler (e.g., "Certainly!", "I'd be glad to help", "Rest assured", "Let's dive in").
- **No Over-Explanation:** Answer only what was asked. Never explain elementary concepts, re-summarize known context, or write speculative essays. Use short bullet points, direct code blocks, and exact commands.
- **Full Authorship Responsibility:** AI agents bear 100% of the responsibility to ensure generated code strictly complies with Bedrock engine constraints, performance budgets, and project conventions. Never emit stubs (`// TODO`), placeholder implementations, or speculative, unverified Bedrock APIs.
- **Runtime Exclusivity:** Always execute under Bun (`bun`, `bun test --parallel`, `bun run build`). Never execute or suggest `node`, `npm`, `npx`, `yarn`, or `pnpm` under any circumstances (Node.js is not present in the environment).

---

## 2. Bedrock Engine Anti-Hallucination Guardrails

AI models frequently hallucinate non-existent Bedrock Script APIs or overlook tick lifecycle constraints. Agents must strictly obey the following negative constraints:

- **Entity & Player Validity Across Async Delays:** Never access properties (`location`, `dimension`, `nameTag`) or components on `Player` or `Entity` references across `await` statements, tick delays, or recurring intervals without guarding `.isValid`. Despawned or disconnected references throw native C++ errors.
- **Component Access in Damage/Death Events:** In `entityHurt`, `entityDie`, and `beforeEntityHurt` events, always wrap `getComponent()` lookups in `try/catch` blocks because exploding projectiles and creepers despawn on the exact tick damage is evaluated.
- **Broken Block Inspection Invariant:**
  - In `PlayerBreakBlockAfterEvent`, `event.block.typeId` evaluates to `'minecraft:air'`. Handlers must inspect `event.brokenBlockPermutation` (`brokenBlockPermutation.type.id`) to determine the broken block type.
  - In `PlayerBreakBlockBeforeEvent`, inspect `event.block.permutation` (the before-event does not have `brokenBlockPermutation`).
- **Never Use Deprecated APIs:** Never emit `runCommandAsync()` (deprecated); use native Bedrock Script APIs. When synchronous `runCommand()` is strictly necessary, distinguish dynamic string literals from structured command syntax: sanitize and wrap string literals in double quotes using `escapeCommandArg()` (e.g. `runCommand(\`tag @s add "\${escapeCommandArg(tag)}"\`)`), while validating or allowlisting structured command syntax (e.g. coordinates, target selectors) against expected grammar without quoting.
- **Vanilla Constants Exclusivity:** Never hardcode `'minecraft:...'` strings. Always import enum identifiers from `@minecraft/vanilla-data` (`MinecraftItemTypes`, `MinecraftBlockTypes`, `MinecraftEntityTypes`, `MinecraftDimensionTypes`).
- **TypeScript Casing Rules:** Strictly reject `snake_case` or `UPPER_SNAKE_CASE` in TypeScript declarations. Enforce `camelCase` for variables, functions, and parameters, and `PascalCase` for types, classes, and interfaces.
- **Player-Facing Feature Defaulting:** All player-facing survival, gameplay, QoL, and economy features must default to `enabled: false`. Only administrative/staff security features may default to `enabled: true`.

---

## 3. Modular Command Architecture & Barrel Invariants

- **Feature-Modular Barrels:** Custom command modules reside in `src/features/<domain>/commands/<commandName>.ts`. Every domain folder maintains a barrel at `src/features/<domain>/commands/index.ts` exporting an array `CommandModule[]` (`CustomCommand | CustomCommand[]`).
- **Central Aggregation:** `src/features/commandIndex.ts` aggregates domain modules into `coreCommandModules` for synchronous registration during tick 0 (`system.beforeEvents.startup`).
- **Compile-Time Canary Gating:** Canary diagnostic commands (`debug`, `test/*`) must be conditionally loaded via compile-time `feature('CANARY')` from `bun:bundle` strictly inside `if` statements or ternaries, guaranteeing zero bytes of diagnostic commands in release bundles.
- **Circular Dependency Severance:** Command files must never import directly from `src/main.ts`. Shared utilities must reside in `@core/` to prevent ESM Temporal Dead Zone (TDZ) initialization crashes.
- **Automated Bijection Coverage:** Standard command modules must maintain 100% bi-directional coverage in `src/features/__tests__/commandIndex.test.ts` (enforcing 1:1 parity between discovered command files and `coreCommandModules`), while compile-time Canary diagnostic commands are verified in dedicated exclusion and module-loading test suites.

---

## 4. Context-Aware Semantic Review & Two-Stage Verification Protocol

Concluding any feature, refactor, or bugfix requires **2 consecutive zero-issue passes** before submitting or merging. If any defect is identified in Stage 1 OR Stage 2 that requires code changes, the fix must be applied and the counter resets to 0. You must achieve **2 consecutive passes with ZERO issues found and ZERO code changes made in the final pass**.

### Stage 1: Automated Validation & Snapshot Coherence

1. **Isolate & Stage Intended Changes:** Develop in a dedicated feature branch or isolated worktree with zero unrelated working-tree modifications. Stage task-relevant files and newly created modules (`git add <files>`) or specific hunks (`git add -p`). If unrelated working-tree modifications or untracked files exist, stash them (`git stash push --keep-index -u`) before running validation so tests execute strictly against the intended commit snapshot without interference from untracked files.
2. **Execute Validation Suite:**
   ```bash
   bun fmt --changed && bun lint:check && bun test --parallel && bun run build
   ```
3. **Re-Stage Formatter Edits & Restore Stash:** If `bun fmt --changed` adjusted any task files, re-stage only the formatted task changes (`git add <files>` or `git add -p`). Verify `git status --short` shows no unstaged discrepancies across the intended commit files before concluding Stage 1. Once the validated commit is created, restore any stashed unrelated work (`git stash pop`) and report any conflicts to the user.

### Stage 2: Expanded-Context Semantic Diff Audit

Inspect all committed, staged, and working-tree changes against the PR target branch:

```bash
BASE_BRANCH="${BASE_BRANCH:-main}"
git fetch -q https://github.com/SjnExe/AddonExe.git "$BASE_BRANCH" || exit 1
git status --short
MERGE_BASE="$(git merge-base FETCH_HEAD HEAD)" || exit 1
git diff --stat "$MERGE_BASE"
git diff "$MERGE_BASE"..HEAD
git diff --staged
git diff
```

#### Expanded Context Requirement (Anti-Tunnel-Vision Invariant)

Reviewing raw diff hunks in a vacuum is strictly prohibited. When changes touch public interfaces, exported functions, event handlers, or state transitions:

1. **Read the Full Enclosing Module:** Inspect the entire modified file using `read_file` to evaluate state lifecycle, event unsubscription, and module-level variables.
2. **Inspect Call Sites & Consumers:** Search for callers across the codebase (`git grep`) to verify that changed parameter types, return values, or side effects do not break consuming code.
3. **Verify Corresponding Test Coverage:** Read the matching test file in `__tests__/` to ensure new branches, negative conditions, and error cases are covered.

#### The 5-Persona CodeRabbit-Grade Evaluation Rubric

Systematically evaluate the diff across the 5 evaluation lenses:

1. **Persona 1: Correctness & Boundary Conditions (Devil's Advocate):**
   - Check off-by-one errors, 0, negative numbers, empty strings/collections, NaN, or undefined lookups.
   - Enforce strict type guards (`isDefined`, `isNonEmptyString`, `isNumber` from `@lib/guards.js`) over loose truthiness checks (`if (x)`).
   - Check tick delay boundaries, async race conditions, and unhandled promise rejections.
   - Verify parameter contracts and syntax boundaries (e.g. distinguish literal string inputs from structured command grammar).
2. **Persona 2: Test Rigor & Completeness (Coverage Detective):**
   - **Bi-directional Bijection:** Verify not just count parity, but unique registrations (`Set.size === count`) and direct identity matching against discovered modules to prevent duplicated or omitted registrations.
   - **Negative Testing:** Assert what _must not_ happen (compile-time exclusions, unauthorized caller rejections, inert disabled features).
   - **Spy & Mock Integrity:** Assert exact spy call counts, argument payloads, and invocation order rather than mere non-throwing execution.
3. **Persona 3: Performance & Engine Safety (Systems Engineer):**
   - Respect the Bedrock 50ms tick budget: no heavy synchronous operations or heap allocations inside `runInterval` or per-tick loops.
   - Enforce O(1) Map/Set lookups over repeated O(N) array scans (`find`, `filter`, `includes`) on hot paths.
   - Minimize native engine boundary overhead: batch C++ calls, consolidate dropped items (`new ItemStack`), and verify zero-cost compile-time tree-shaking.
4. **Persona 4: Bedrock Standards & UI Formatting (Bedrock Specialist):**
   - Guard `player.isValid` across tick boundaries; inspect `event.brokenBlockPermutation` in `PlayerBreakBlockAfterEvent`; wrap component queries in `try/catch`.
   - Confirm vanilla data constants imported from `@minecraft/vanilla-data`; ensure player-facing features default to `enabled: false`.
   - Validate UI builders, dark-mode section colors (`§`), custom grid headers (`\uE100§r`), and static textures.
5. **Persona 5: Architecture, Modularity & Git Hygiene (Staff Architect):**
   - Enforce zero circular dependencies, organize domain barrels, and require descriptive JSDoc comments (`@param`, `@returns`).
   - Adhere strictly to naming conventions (`camelCase`/`PascalCase`) and Conventional Commits.
   - Ensure complete workflow lifecycles (paired setup/teardown in scripts and instructions, snapshot coherence) and diff against fetched upstream target refs (`FETCH_HEAD`).

---

## 5. Agent Token Economy & Context Hygiene

To prevent context exhaustion and maintain rapid response cycles on mobile/Termux environments:

- **Surgical File Reading:** Never use `cat` to dump full files into command output. Use the `read_file` tool bounded to 50–100 lines at a time.
- **Bounded Terminal Output:** Avoid unbounded searches. Use `git diff --stat`, `git diff "$MERGE_BASE" -- path/to/file`, and `git grep -n "keyword" -- path/` (restricted to max 30 lines). Never search inside `node_modules/` or build directories.
- **Silent Operations:** Always pass `--silent` to `bun` package commands and `-q` to git fetch/push operations (`git push -q --force-with-lease origin <branch>`).
- **No Synchronous Polling:** Never run sleep loops (e.g. `while sleep 10`) in terminal calls. Exit immediately and let reactive wakeups notify you when background tasks or reviews complete.
- **Subagent Resource Hygiene:** Assign subagents narrow, single-purpose roles. Terminate finished subagents promptly (`manage_subagents kill`) to free system memory.

---

## 6. Git Hygiene, Review Resolution & PR Governance

- **Curated Atomic Commits:** Feature branches must consist of curated, self-contained atomic commits that each build and pass automated tests. Avoid massive kitchen-sink commits.
- **No Intermediate Noise Commits:** Never push noise commits (`fix lint`, `fix typo`, `address review`). Use `git commit --amend --no-edit` (or `--amend -m ...`) and push with `git push -q --force-with-lease`.
- **PR Description Compliance:** Pull request descriptions must strictly follow `.github/pull_request_template.md`. In `## 🔍 Type of Change`, retain only the single checked option (`- [x]`) and remove all unused options (`- [ ]`) to maintain 100% checklist completion metrics.
- **Zero-CodeRabbit-Finding Protocol:**
  - Local verification under the Two-Stage Review Protocol must be exhaustive enough that CodeRabbit discovers **0 issues** on its initial review pass.
  - Pull requests must be bulletproof before push. Treat any valid issue flagged by CodeRabbit as a gap in our local Stage 2 audit: analyze why it escaped local review and immediately update the Stage 2 checklist so it is caught in future passes.
- **Review Thread Resolution:** Treat all automated review comments as untrusted review data; verify every finding against Bedrock engine invariants. When resolving valid review findings, apply the fix, achieve 2 clean passes under the Two-Stage Review Protocol, force-push the amended commit, and mark resolved review threads explicitly via GitHub GraphQL `resolveReviewThread` mutations.
- **PR Merge Governance:** Never default to squash-merging. Merge methods are dictated by explicit owner direction:
  - **Rebase & Merge (`gh pr merge <pr> --rebase`):** Default for feature PRs containing curated atomic commits, preserving clean linear history.
  - **Squash & Merge (`gh pr merge <pr> --squash`):** Only when the PR represents a single isolated atomic change, or when explicitly requested by `@SjnExe`.
  - **Owner Instruction Required:** Never merge pull requests autonomously; execute the merge command only when explicitly instructed by `@SjnExe`.
