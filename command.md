# Jules AI Environment Setup Script

This script is designed to be used in the Jules AI **Initial Setup** configuration (Codebases > Configuration). It automates the process of updating the system, switching to the development branch, and preparing the project environment.

## Setup Script

Copy and paste the following block into the **Initial Setup** field:

```bash
# Update system packages (Ubuntu uses apt, not pkg)
sudo apt update && sudo apt upgrade -y

# Fetch and switch to the Dev branch
git fetch origin Dev:Dev
git checkout Dev

# Install and update project dependencies
npm install
npm update

# Run standard code quality and build tasks
npm run format
npm run lint:fix
npm run build
```

## Explanation

1.  **System Updates (`sudo apt update && sudo apt upgrade -y`)**:
    *   Since the environment runs on Ubuntu, we use `apt` instead of `pkg` (which is common in Termux or BSD systems).
    *   This ensures the underlying OS packages are up to date.

2.  **Branch Switching (`git fetch ...` & `git checkout Dev`)**:
    *   Jules clones the default branch (`exe`) by default.
    *   These commands fetch the latest state of the `Dev` branch and switch the workspace to it, ensuring you are working on the active development version.

3.  **Project Setup (`npm install` & `npm update`)**:
    *   `npm install`: Installs all dependencies listed in `package.json`.
    *   `npm update`: Updates the dependencies to the latest minor/patch versions allowed by your version constraints.

4.  **Verification (`npm run ...`)**:
    *   Runs the standard formatting, linting, and build scripts to ensure the environment is clean and the code compiles successfully before you start working.
