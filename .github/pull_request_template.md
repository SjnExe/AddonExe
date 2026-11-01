---
name: Pull Request
about: Propose changes or submit improvements to AddonExe
title: '<type>(<scope>): <summary>'
---

## 📝 Summary of Changes

<!--
Provide a clear, high-level summary of what this PR accomplishes and why the change was made.
Link any related GitHub issues, e.g., "Closes #123" or "Addresses #456".
-->

## 🔍 Type of Change

- [ ] `feat`: A new user-facing feature or enhancement
- [ ] `fix`: A bug fix or error correction
- [ ] `refactor`: Code change that neither fixes a bug nor adds a feature
- [ ] `perf`: A code change that improves performance or reduces lag
- [ ] `docs`: Documentation, guides, or template updates
- [ ] `chore`: Maintenance, dependency updates, or CI workflow changes

---

## 🧱 Bedrock Engine & Architectural Standards

- [ ] **Entity & Object Safety:** All entity/player references check `.isValid` across tick boundaries, explosions, and hurt/die events. Nullable values use strict guards (`isDefined`, `isNonEmptyString`, `isNumber`).
- [ ] **Vanilla Data Constants:** All item, block, entity, and dimension identifiers are strictly imported from `@minecraft/vanilla-data` (no raw `'minecraft:...'` string literals).
- [ ] **Player-Facing Feature Defaulting:** Any player-facing survival, economy, gameplay, or QoL feature defaults to **`enabled: false`** in its config.
- [ ] **Engine Performance & Lag Prevention:** Avoids runaway scans or mass synchronous native C++ calls; batches block lookups; consolidates item drops (`ItemStack(type, count)`).
- [ ] **Dark-Mode UI Compliance:** Uses standard form builders (`ActionFormBuilder`, `CustomFormBuilder`) with dark-mode section colors (`§`) and static UI textures (no animated flipbooks).
- [ ] **Build Artifacts Invariant:** Only files in `src/`, `packs/`, or `docs/` were edited. Generated files in `packs/behavior/scripts/` were NOT edited directly.

---

## 🧪 Verification & Automated Validation

Each step must pass locally before requesting review:

- [ ] **Formatting:** Modified files formatted via `bun fmt --changed` (or `bun fmt --check`).
- [ ] **Linter & Typecheck:** `bun lint:check` passes with **0 errors and 0 warnings**.
- [ ] **Unit Tests:** `bun test --parallel` passes all tests cleanly.
- [ ] **Pack Build:** `bun run build` completes without errors.

---

## 📋 Git Hygiene & Review Protocol

- [ ] **Curated Atomic Commits:** Commits are logical, self-contained, and individually pass tests. No intermediate noise commits (`fix lint`, `typo`, etc.).
- [ ] **Conventional Commit Messages:** Commit titles follow Conventional Commits and commit bodies explain _why_ changes were made.
- [ ] **AI-Assisted Contribution Responsibility:** If AI tools were used to draft or assist this change, I have personally vetted, tested, and verified all generated code against Bedrock engine invariants and in-game behavior.
- [ ] **Two-Stage Review Protocol:** Diff has been audited line-by-line for edge cases and verified against the two-stage review protocol (2 consecutive clean passes).

---

_By submitting this pull request, you agree to license your contribution under the project's [MIT License](https://github.com/SjnExe/AddonExe/blob/main/LICENSE)._
