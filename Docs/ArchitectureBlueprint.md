# AddonExe - Comprehensive Architecture Blueprint

## 1. Core Summary & Existing Architecture

AddonExe is a feature-rich Minecraft Bedrock addon utilizing `@minecraft/server` and `@minecraft/server-ui`. It uses modern TypeScript tooling compiled via Bun and ESBuild.
The architecture currently follows a module-based pattern loaded by `src/core/featureRegistry.ts`. It includes core managers for config, data, events, and UI, with individual features (like economy, moderation, anticheat) separated into self-contained modules.

## 2. Strategic Critique of Advanced Pillars

Based on a deep audit, here is an evaluation of the requested architectural pillars:

### High Priority & Implemented

- **Pillar 1: Cross-Environment Compilation (BDS vs. Realms Split)**
    - _Status:_ **Reverted / Removed**. The build pipeline was simplified. We removed the split for BDS and Realms to ensure full compatibility for both environments without splitting packages. Removed dependencies `@minecraft/server-net` and `@minecraft/server-admin`.
- **Pillar 2: Programmatic JSON Schema Guardrails**
    - _Status:_ **Implemented**. A new validation script `scripts/validate-schemas.ts` utilizing `ajv` and `@minecraft/bedrock-schemas` was written and integrated into the NPM `lint:check` and `lint` scripts. It automatically ensures JSON formats (like entities/items) are valid before hitting `mct validate`.
- **Pillar 3: Type-Safe Dynamic Property Database Wrapper**
    - _Status:_ **Implemented**. `StorageManager.ts` already supported fragmentation across keys. It was refactored into a type-safe generic class `StorageManager<T>` with a newly added `update(partialData: Partial<T>)` method to efficiently manage state updates without fully replacing the property payload.
- **Pillar 4: Reactive UI State Engine**
    - _Status:_ **Implemented**. Modified `uiManager.ts` to implement a `UIStack` manager tracking the UI history per player. This allows for fully reliable "Back" navigation.
- **Pillar 5: Script-Driven Visual & Atmospheric Controller**
    - _Status:_ **Implemented**. Added `atmosphereManager.ts` to coordinate cinematic screen displays, actionbars, sounds, and particles smoothly.
- **Pillar 6: High-Performance Vector & Spatial Math Suite**
    - _Status:_ **Implemented**. Added a wrapper class `MathUtils` inside `src/core/utils/mathUtils.ts` to properly integrate `@minecraft/math` utilities for performance-critical vector operations.
- **Pillar 7 & 8: Low-Overhead Performance Profiler & Event Multiplexer**
    - _Status:_ **Implemented**. Refactored `timerManager.ts` to use a central `TickMultiplexer`. Instead of spawning raw `system.runInterval` calls which stack lag, the multiplexer staggers executions based on modulo math. Includes a time profiler that tracks execution durations for each multiplexed task and warns if it exceeds 5ms.

## 3. Implementation Layout

### Pillar 2: Programmatic JSON Schema Validator

- **Execution:** Executed via `scripts/validate-schemas.ts` using `ajv`.
- **Logic:** The script parses the official Mojang `catalog.json` schema directory, iterates over all `*.json` files inside `packs/`, applies regex matching based on Mojang's `fileMatch`, and throws errors on mismatch.
- **Integration:** Registered in `package.json` under `"lint": "bun eslint ... && bun run scripts/validate-schemas.ts"`.
