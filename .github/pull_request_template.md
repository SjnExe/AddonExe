---
name: Pull Request
about: Propose changes or submit improvements to AddonExe
title: '<type>(<scope>): <summary>'
---

## 📝 Summary of Changes

<!-- High-level summary of what this PR accomplishes and why. Reference related issues (e.g. Closes #123). -->

## 🔍 Type of Change

- [ ] `feat`: A new user-facing feature or enhancement
- [ ] `fix`: A bug fix or error correction
- [ ] `refactor`: Code change that neither fixes a bug nor adds a feature
- [ ] `perf`: A code change that improves performance or reduces lag
- [ ] `docs`: Documentation, guides, or template updates
- [ ] `chore`: Maintenance, dependency updates, or CI workflow changes

---

## 🧱 Bedrock Engine & Architectural Standards

- [ ] **Entity & Object Safety:** Checked `.isValid` across tick boundaries; strict guards (`isDefined`) used.
- [ ] **Vanilla Constants:** Enums imported from `@minecraft/vanilla-data` (no raw `'minecraft:...'`).
- [ ] **Feature Defaults:** Player-facing gameplay and QoL features default to `enabled: false`.
- [ ] **Engine Safety:** No runaway scans; batched lookups; consolidated item drops.
- [ ] **UI Standards:** Dark-mode form builders with static textures (no animated flipbooks).
- [ ] **Build Artifacts:** Only source files edited; generated `packs/behavior/scripts/` never edited directly.

---

## 🧪 Verification & Automated Validation

- [ ] **Automated Suite:** `bun fmt --changed && bun lint:check && bun test --parallel && bun run build` passes cleanly with 0 errors.

---

## 📋 Git Hygiene & Review Protocol

- [ ] **Curated Commits:** Self-contained atomic commits following Conventional Commits.
- [ ] **Two-Stage Review Protocol:** Verified with 2 consecutive clean passes (automated checks + diff review).
