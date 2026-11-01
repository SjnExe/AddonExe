# Contributing to AddonExe

Thank you for considering contributing to **AddonExe**! We welcome bug reports, feature suggestions, documentation improvements, and code contributions.

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)
- [Code Contributions](#code-contributions)
  - [Environment Setup](#environment-setup)
  - [Contribution Workflow](#contribution-workflow)
  - [Coding Standards & Quality Checks](#coding-standards--quality-checks)
- [Development Resources](#development-resources)
- [Code of Conduct](#code-of-conduct)

## Ways to Contribute

- **Reporting Bugs:** Open an issue on our [GitHub Issues page](https://github.com/SjnExe/AddonExe/issues).
- **Suggesting Enhancements:** Share ideas for new features or improvements to existing systems.
- **Writing Documentation:** Keep guides in `docs/` accurate and up to date.
- **Writing & Testing Code:** Submit pull requests with bug fixes, optimizations, or new features.

## Reporting Bugs

Before opening a bug report:

1. Ensure you are using the latest release of AddonExe.
2. Check the [Troubleshooting Guide](../docs/troubleshooting.md) and [F.A.Q.](../docs/faq.md).
3. Search existing [GitHub Issues](https://github.com/SjnExe/AddonExe/issues) to avoid duplicates.

Include reproduction steps, expected vs. actual behavior, Content Log output, and your Minecraft + AddonExe versions.

## Suggesting Enhancements

Open a Feature Request on the [GitHub Issues page](https://github.com/SjnExe/AddonExe/issues) describing the problem, proposed solution, and how it fits into AddonExe.

## Code Contributions

### Environment Setup

AddonExe uses **Bun** and **TypeScript**.

```bash
bun install
```

See [AGENTS.md](../AGENTS.md) for full architecture and build details.

### Contribution Workflow

1. **Fork the Repository:** Fork [SjnExe/AddonExe](https://github.com/SjnExe/AddonExe).
2. **Create a Branch:** Branch off `main` using a descriptive name (e.g., `fix/auction-bid-validation`, `feat/warp-cooldown`).
3. **Develop:** Write clean TypeScript in `src/` and/or JSON definitions in `packs/`. Never edit compiled files in `packs/behavior/scripts/`.
4. **Verify:** Run unit tests, linting, and build checks locally.
5. **Document:** Update relevant files in `docs/` if user-facing behavior, commands, or configs change.
6. **Submit a Pull Request:** Open a PR targeting the `main` branch.

### Coding Standards & Quality Checks

Follow [AGENTS.md](../AGENTS.md):

- **No `snake_case`** for project TypeScript identifiers (except where required by native Minecraft APIs or JSON schemas).
- **Format modified files:** `bun fmt --changed`
- **Lint & Typecheck:** `bun lint:check`
- **Run Unit Tests:** `bun test --parallel`
- **Build Addon:** `bun run build`

## Development Resources

- [Agent & Contributor Technical Guide](../AGENTS.md)

## Code of Conduct

All contributors and community members are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
