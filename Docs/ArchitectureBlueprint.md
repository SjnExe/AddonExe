# AddonExe - Comprehensive Architecture Blueprint

## 1. Core Summary & Existing Architecture

AddonExe is a feature-rich Minecraft Bedrock addon utilizing `@minecraft/server` and `@minecraft/server-ui`. It uses modern TypeScript tooling compiled via Bun and ESBuild.
The architecture currently follows a module-based pattern loaded by `src/core/featureRegistry.ts`. It includes core managers for config, data, events, and UI, with individual features (like economy, moderation, anticheat) separated into self-contained modules.

## 2. Strategic Critique of Advanced Pillars

Based on a deep audit, here is an evaluation of the requested architectural pillars:

### High Priority & Implemented

- **Pillar 1: Unified Cross-Environment Compilation**
    - _Status:_ **Implemented**. The build pipeline in `scripts/build.ts` produces a single unified artifact that is compatible with both BDS and Realms, simplifying deployment and removing the need for environment-specific builds or `@minecraft/server-net` and `@minecraft/server-admin` dependencies.
- **Pillar 2: Programmatic JSON Schema Guardrails**
    - _Status:_ **Implemented**. A new validation script `scripts/validate-schemas.ts` utilizing `ajv` and `@minecraft/bedrock-schemas` was written and integrated into the NPM `lint:check` and `lint` scripts. It automatically ensures JSON formats (like entities/items) are valid before hitting `mct validate`.
- **Pillar 3: Type-Safe Dynamic Property Database Wrapper**
    - _Status:_ **Implemented**. `StorageManager.ts` already supported fragmentation across keys. It was refactored into a type-safe generic class `StorageManager<T>` with a newly added `update(partialData: Partial<T>)` method to efficiently manage state updates without fully replacing the property payload.

### Recommended for Future Structural Optimization

- **Pillar 4: Reactive UI State Engine**
    - _Status:_ Deferred. The existing UI pattern (`uiManager.ts` & `panelBuilder.ts`) is functional but relies on manual response handling. A centralized Event-Driven framework with history stacks and debouncing would greatly improve UX, but requires significant refactoring of existing panel logic.
- **Pillar 6: High-Performance Vector & Spatial Math Suite**
    - _Status:_ Deferred. Math-heavy operations should migrate to `@minecraft/math` and `@minecraft/gameplay-utilities` to offload logic to native engine routines, reducing script tick latency.
- **Pillar 8: Low-Overhead Performance Profiler & Event Multiplexer**
    - _Status:_ Deferred. The current `timerManager.ts` simply wraps raw `system.runInterval`. Implementing a central ticking multiplexer would severely reduce frame-time load by staggering events across custom intervals.

### Specialized / Optional Focus

- **Pillar 5: Script-Driven Visual & Atmospheric Controller**
    - _Status:_ Deferred. Using `@minecraft/server-graphics` offers highly cinematic experiences (e.g., boss fights or custom dimensions), but is less critical unless the addon fundamentally pivots to heavily atmospheric gameplay.
- **Pillar 7: Telemetry, Memory & Event Profiling Harness**
    - _Status:_ Deferred. A wrapper leveraging `@minecraft/diagnostics` will be invaluable during dev cycles, but can be deferred until the core multiplexer (Pillar 8) is built.

## 3. Pillar 1 & 2 Blueprint Layout

### Pillar 1: Unified Cross-Environment Build Pipeline

- **Targeting:** `scripts/build.ts` compiles a single build targeting all environments.
- **Esbuild Changes:** The build no longer relies on an `__ENVIRONMENT__` flag.
- **Output:** `bun run build` loops once, outputting standard cross-compatible scripts to `packs/behavior/scripts/`.

### Pillar 2: Programmatic JSON Schema Validator

- **Execution:** Executed via `scripts/validate-schemas.ts` using `ajv`.
- **Logic:** The script parses the official Mojang `catalog.json` schema directory, iterates over all `*.json` files inside `packs/`, applies regex matching based on Mojang's `fileMatch`, and throws errors on mismatch.
- **Integration:** Registered in `package.json` under `"lint": "bun eslint ... && bun run scripts/validate-schemas.ts"`.
