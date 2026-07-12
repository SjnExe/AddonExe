# Contributing to AddonExe

First off, thank you for considering contributing to the AddonExe! We welcome any help to make this addon even better and create a fairer Minecraft Bedrock Edition experience for everyone.

This document provides guidelines for contributing to the project. Please read it carefully to ensure a smooth and effective contribution process.

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)
- [Code Contributions](#code-contributions)
    - [Setting Up Your Environment](#setting-up-your-environment)
    - [Contribution Workflow](#contribution-workflow)
    - [Coding Standards](#coding-standards)
    - [Testing](#testing)
    - [Documentation](#documentation)
    - [Pull Request Process](#pull-request-process)
- [Development Resources](#development-resources)
- [Code of Conduct](#code-of-conduct)

## Ways to Contribute

There are many ways you can contribute to the project, even if you don't write code:

- **Reporting Bugs:** If you find a bug, please let us know by opening an issue.
- **Suggesting Enhancements:** Have an idea for a new feature or an improvement to an existing one? We'd love to hear it!
- **Writing Documentation:** Help improve our guides, examples, or inline code comments.
- **Testing:** Help test new releases or development branches to find issues.
- **Spreading the Word:** Tell others about the project!

## Reporting Bugs

If you encounter a bug, please help us by submitting an issue to our [GitHub Issues page](https://github.com/SjnExe/AddonExe/issues).

Before submitting a bug report, please ensure the following:

- You are using the latest version of the addon.
- You have checked the [Troubleshooting Guide](Docs/Troubleshooting.md) for common solutions.
- The bug has not already been reported (search existing issues).

When submitting a bug report, please include as much detail as possible:

- A clear and descriptive title.
- Steps to reproduce the bug.
- What you expected to happen.
- What actually happened (include any error messages or console logs).
- Your Minecraft version and addon version.
- Information about your environment (e.g., other addons installed, server software if applicable).

## Suggesting Enhancements

We welcome suggestions for new features or improvements to existing functionality! To suggest an enhancement:

1.  Check the [GitHub Issues page](https://github.com/SjnExe/AddonExe/issues) to see if your idea has already been suggested. If it has, feel free to add your thoughts to the existing issue.
2.  If your idea is new, please open a new issue. Provide a clear description of the proposed enhancement and explain why you think it would be beneficial to the project.

## Code Contributions

We are excited to receive code contributions! If you'd like to contribute code, please follow these guidelines.

### Project Philosophy & Review Process

- **Philosophy:** Our goal is to keep this addon clean, universal, and easy to maintain. A planned future feature is full internationalization (i18n) support.
- **Review Process:** All contributions will be reviewed by the project owner (SjnExe) or Jules AI assistant to ensure they align with the project's goals and coding standards.
- **Crediting:** Please note that contributions are generally not credited directly in the codebase. Significant contributions will be acknowledged in the project's changelog or a dedicated contributors file.

### Setting Up Your Environment

Details on setting up a development environment can be found in our [Addon Development Resources](Docs/Development/README.md). (This may include information on required software, project structure, and build processes if applicable).

### Contribution Workflow

1.  **Fork the Repository:** Create your own fork of the [SjnExe/AddonExe](https://github.com/SjnExe/AddonExe) repository.
2.  **Create a Branch:** Make your changes in a dedicated branch on your fork. Branch names should be descriptive (e.g., `fix/fly-detection-exploit`, `feature/new-reporting-ui`).
3.  **Develop:** Make your code changes, adhering to the project's coding standards.
4.  **Test:** Thoroughly test your changes to ensure they work as expected and do not introduce new issues or regressions.
5.  **Document:** Update any relevant documentation in the `Docs/` folder or JSDoc/TSDoc comments if your changes affect user-facing features or complex code logic.
6.  **Commit:** Write clear, concise, and descriptive commit messages.
7.  **Push:** Push your changes to your fork.
8.  **Submit a Pull Request (PR):** Open a pull request from your branch to the `Dev` branch of the `SjnExe/AddonExe` repository. (Note: The `exe` branch is for stable releases only).
    - Provide a clear title and description for your PR, explaining the changes you've made and why.
    - Reference any related issues (e.g., "Fixes #123").

### Coding Standards

Please follow our [**Coding Style Guide**](Docs/Development/CodingStyle.md) and [**Standardization Guidelines**](Docs/Development/StandardizationGuidelines.md). This includes conventions for naming, formatting, JSDoc/TSDoc comments, and error handling. Adherence to these standards helps maintain code quality and consistency.

Key points:

- **TypeScript:** The project is migrating to TypeScript. All new code should be written in TypeScript (`.ts`) in the `src/` directory. Legacy JavaScript code should be preserved or migrated with care.
- **Naming Conventions:** Pay close attention to naming conventions (typically `camelCase` for variables and functions), formatting, and documentation standards.
- **Formatting & Linting:** Run `bun run format` and `bun run lint` before submitting your changes.

### Testing

Ensure your changes are stable and do not introduce new issues. Test your changes in-game under various conditions. If you are fixing a bug, include steps on how to reproduce the bug and verify the fix. If you are adding a new feature, test its functionality thoroughly.

(Placeholder: If specific testing frameworks or procedures are established, they will be detailed here or in `Docs/Development/README.md`.)

### Documentation

If you add or modify features, please update the relevant documentation:

- **User-facing features:** Update or add pages in the `Docs/` folder (e.g., `FeaturesOverview.md`, `Commands.md`, `ConfigurationGuide.md`).
- **Code changes:** Ensure JSDoc comments for new or modified functions are clear, accurate, and follow project standards.

### Pull Request Process

1.  Your pull request will be reviewed by project maintainers.
2.  Be prepared to discuss your changes and make any necessary adjustments based on feedback.
3.  Once your PR is approved and passes any automated checks (if applicable), it will be merged.

We appreciate your patience during the review process!

## Development Resources

Looking for a place to start or need more information on the development setup?

- Check out our [**issues tab**](https://github.com/SjnExe/AddonExe/issues) – we often tag issues that are great for new contributors (e.g., `good first issue` or `help wanted` when available).
- For more on development processes, project structure, and other resources, see [**Addon Development Resources**](Dev/README.md).

## Code of Conduct

While this project does not yet have a formal Code of Conduct document, we expect all contributors and participants to interact respectfully and constructively. Please be considerate of others and help create a positive and welcoming environment for everyone.

---

Thank you for your interest in contributing to the AddonExe! Your efforts help make the Minecraft community a better place.
