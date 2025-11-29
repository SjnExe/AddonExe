# Standardization Guidelines for AddonExe

This document outlines the consolidated standardization guidelines for the AddonExe, incorporating directives from `Dev/CodingStyle.md` and further detailing other aspects of code quality and consistency. This will guide the codebase standardization effort.

## 1. References and Precedence

- `Dev/CodingStyle.md` is a key reference, especially for:
  - Naming conventions for JavaScript identifiers.
  - Command system conventions (prefix, naming, aliases).
  - Detailed principles for debugging and logging using `playerUtils.debugLog`.
- This document expands on `Dev/CodingStyle.md` by providing more explicit guidelines for general coding style, code structure, JSDoc documentation, Minecraft Server API usage, and error handling.

## 2. Coding Style and Conventions

- **Naming:**
  - The general rule for all project-specific JavaScript identifiers is that **any code style is allowed, but not snake_case**.
  - The use of `snake_case` (e.g., `my_variable`) or `UPPER_SNAKE_CASE` (e.g., `MY_CONSTANT`) is disallowed, except where required by the Minecraft API.
  - **Class Names:** `PascalCase` (e.g., `class PlayerManager {}`). (Currently not prevalent).
- **Quotes:**
  - Prefer **single quotes (`'`)** for string literals.
  - Use **double quotes (`"`)** if the string contains single quotes (e.g., `"Player's data"`) or for JSON objects.
  - Template literals (`` ` ``) for interpolation or multi-line strings.
- **Semicolons:** Use semicolons at the end of all statements.
- **Spacing:**
  - Single space after commas (e.g., `fn(a, b)`, `[1, 2]`).
  - Single space around binary operators (e.g., `x = y + 5;`).
  - No space after opening/before closing parentheses (e.g., `fn(arg)`).
  - No space between function name and its argument list parentheses (e.g., `myFunction(arg)`).
  - Space between control flow keywords and their parentheses (e.g., `if (condition)`).
  - Space before opening curly braces (e.g., `if (condition) {`).
- **Indentation:** Use 4 spaces. No tabs.
- **Line Breaks & Length:** Max 256 characters. This has been increased to better accommodate long descriptive strings (e.g., in log messages or detailed comments) and complex conditions without excessive fragmentation. However, complex logical statements should still be broken thoughtfully, often before operators, to maintain readability.
- **Braces (Curly Braces `{}`):**
  - Egyptian (K&R variant) style: opening brace on the same line. `else`, `catch`, `finally` on the same line as the preceding closing brace.
  - Always use braces for blocks (`if`, `for`, `while`, etc.), even single-line ones.
- **`null` vs. `undefined`:** Use `null` to explicitly indicate an intentional absence of value, especially for objects. `undefined` is typically the default state of uninitialized variables or missing properties.
- **Strict Equality:** Always use strict equality (`===`) and inequality (`!==`) operators instead of loose equality (`==`, `!=`) to avoid unexpected type coercion issues.

## 3. Code Structure and Organization

- **Modules (ES6):** Exclusively use ES6 modules (`import`/`export`).
  - Prefer named exports for clarity and tree-shaking benefits. Default exports can be used sparingly for a single, primary export from a module.
  - Use `export * from './module.js';` for barrel files (e.g., `utils/index.js`, `checks/index.js`).
- **Imports:**
  - **Grouping & Ordering:**
    1. Minecraft Server API imports (e.g., `import * as mc from '@minecraft/server';`).
    2. Local module imports from the addon (e.g., `import * as playerUtils from '../utils/playerUtils.js';`).
  - Alphabetize within groups where practical.
  - Use relative paths (`../`, `./`).
- **Function and Variable Declarations:**
  - `const` for values not reassigned; `let` for reassigned values. Avoid `var`.
  - Prefer `async function functionName() {}` or `function functionName() {}` for exported/major module functions. Arrow functions (`const fn = () => {}`) are fine for callbacks and internal helpers.
- **Constants and Magic Strings/Numbers:**
  - Module-specific constants at the top, after imports. Shared config in `config.js`.
  - Avoid 'magic strings' and 'magic numbers'. Define constants for recurring string literals (tags, event names, property keys) and numeric literals that have specific meanings.
  - For most user-facing messages (command responses, dynamic UI content), prefer using `getString(key, params)` from `textDatabase.js`. However, for highly specific, static, single-use UI labels or button texts within UI modules (like `uiManager.js`), these should be hardcoded directly in the module. Panel button texts (for `!panel`) are defined in `AddonExeBP/scripts/core/panelLayoutConfig.js`.
- **Global Scope:** Minimize global scope pollution (ES6 modules help here).
- **Single Responsibility Principle (SRP):** Aim for functions and modules to adhere to the SRP. A function should do one thing well. Modules should group closely related functionalities. This improves modularity, testability, and maintainability.
- **Pure Functions:** Strive to write pure functions where possible, especially for utility and data transformation logic. Pure functions are easier to test and reason about.

## 4. Documentation Standards

- **JSDoc (`/** ... */`):**
  - **Target:** Mandatory for all exported functions, classes, and significant constants. Recommended for complex internal functions.
  - **Content (Functions):**
    - **Concise Summary**: The main description should be brief and to the point.
    - **Compactness**: Single-line JSDoc comments are highly preferred for simple type annotations or very short descriptions.
    - `@param {type} name - description`: Descriptions for parameters should be concise.
    - `@returns {type} description`: Keep return descriptions brief and focused.
    - Strive to use specific types from `@minecraft/server`, custom typedefs from `types.js`, or primitive types.
  - **Content (Constants):** Brief description and `@type {type}`.
  - **`@typedef`:** Centralize in `types.js` for widely used types.
- **Inline Comments (`//`):**
  - **Purpose**: Clarify complex, non-obvious logic.
  - **Conciseness**: Keep inline comments brief and to the point.
  - Use `// TODO:` and `// FIXME:` for tracking.
- **File Header Comments:**
  - Maintain brief JSDoc-style file purpose descriptions at the top (`@file`).
  - **Variable Type Annotation with `@type`**: Omit the annotation if a variable's type is unambiguously obvious from its initial assignment.

## 5. API Usage Standards (Minecraft Server API)

- **Module Imports:** Consistent aliasing (`import * as mc from '@minecraft/server';`).
- **Entity/Player Handling:**
  - Check `player.isValid()` before use if staleness is possible.
  - Utilize optional chaining (`?.`) consistently.
  - Use `EntityComponentTypes`, `ItemComponentTypes` from `mc` for component names.
- **Dynamic Properties:** Define keys clearly. Handle `undefined` returns. Wrap `JSON.parse()` in `try...catch`.
- **Event Handling:** Set `eventData.cancel = true;` explicitly in `beforeEvents` if the event is to be cancelled.
- **Error Handling:** Wrap API calls that can fail in `try...catch`.
- **Efficiency:** Avoid expensive API calls in tight loops.
- **Asynchronous Operations:** Ensure all promises are properly handled with `await` and wrapped in `try...catch`.

## 6. Logging and Error Handling Standards

This section details standards for both general diagnostic logging and persistent error/event logging.

### 6.1. General Logging Practices & `playerUtils.debugLog()`

- **Conditionality**: All `debugLog` calls **MUST** be conditional on `dependencies.config.enableDebugLogging`.
- **Context Prefixing**: Every `debugLog` output in the console should clearly indicate its origin or primary context.

### 6.2. Persistent Logging with `logManager.addLog()`

- **Error Events**:
  - Error logging **MUST** follow the detailed standards below to ensure consistency and actionability.
  - **`actionType` Naming Convention**:
    - All error-related `actionType`s **MUST** follow the pattern: `error.<module>.<operationOrContext>[.<specificError>]`
    - Examples: `error.pdm.dpRead.parseFail`, `error.cmd.exec.permission`, `error.main.playerTick.generic`.
  - **`LogEntry.details` Object Structure**:
    - When `actionType` indicates an error, `details` **MUST** be an object.
    - **Mandatory fields in `details`**:
      - `errorCode`: (String) A unique code for the error.
      - `message`: (String) The primary error message.
    - **Highly Recommended field in `details`**:
      - `rawErrorStack`: (String, Optional) The full stack trace from `error.stack`.
    - **Optional field in `details`**:
      - `meta`: (Object, Optional) For context-specific key-value pairs.
  - **`LogEntry.context`**:
    - This field **MUST** provide the specific function or module path where the error originated.

### 6.3. Direct `console.error()` Usage

- **Purpose**: Reserve for truly critical, unrecoverable errors.
- **Content**: Should include `error.stack` and be prefixed with a clear module identifier.
- **`try...catch` Blocks:** Mandatory for risky operations.
- **Defensive Programming:** Validate inputs to functions.
- **User Feedback:** Provide user-friendly, non-technical error messages.
- **Error Propagation:** Avoid silent catches unless the error is truly insignificant.

## 7. Text Management & `textDatabase.js`

- **Purpose**: To store reusable or configurable strings that are displayed to users.
- **Key Naming and Structure**: Keys **MUST** use a dot-notation hierarchy.
- **When to Use**: Reused strings, user-facing text, configurable text, common error messages.
- **When Not to Use**: Single-use UI labels, panel configuration texts, internal constants, developer comments.

## 8. Future Considerations

- **Automated Formatting:** While manual adherence to formatting is expected, the project may consider adopting an automated code formatter like Prettier in the future to ensure uniform style and reduce review overhead.

These guidelines will be applied iteratively across the codebase.
