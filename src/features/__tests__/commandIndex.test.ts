import { describe, expect, it, spyOn } from 'bun:test';
import { resolve } from 'node:path';

import { commandManager, type CustomCommand } from '@core/commands/commandManager.js';
import { isNonEmptyString } from '@lib/guards.js';

import { coreCommandModules, loadCommands } from '../commandIndex.ts';

describe('commandIndex Registry Coverage', () => {
  it('includes every eligible command file in coreCommandModules via feature domain registries', async () => {
    const rootDir = process.cwd();
    const featuresDir = resolve(rootDir, 'src/features');

    const cmdGlob = new Bun.Glob('**/commands/*.ts');
    const scannedFiles = Array.from(cmdGlob.scanSync({ cwd: featuresDir, absolute: false }));

    const eligibleFiles: string[] = [];
    for (const relPath of scannedFiles) {
      const normalized = relPath.replace(/\\/g, '/');
      if (normalized.endsWith('/index.ts') || normalized.includes('__tests__')) {
        continue;
      }
      if (normalized.startsWith('test/') || normalized === 'essentials/commands/debug.ts') {
        continue;
      }
      eligibleFiles.push(normalized);
    }

    eligibleFiles.sort();

    // Verify module count matches exactly and contains no duplicate registrations
    expect(coreCommandModules.length).toBe(eligibleFiles.length);
    const registeredModules = new Set(coreCommandModules);
    expect(registeredModules.size).toBe(eligibleFiles.length);

    // Verify that every registered command has a valid name
    for (const mod of coreCommandModules) {
      expect(mod).toBeDefined();
      if (Array.isArray(mod)) {
        expect(mod.length).toBeGreaterThan(0);
        for (const cmd of mod) {
          expect(isNonEmptyString(cmd.name)).toBe(true);
        }
      } else {
        expect(isNonEmptyString(mod.name)).toBe(true);
      }
    }

    // Verify that each eligible command file's default export appears in coreCommandModules
    for (const file of eligibleFiles) {
      const fullPath = resolve(featuresDir, file);
      const imported = (await import(fullPath)) as { default: (typeof coreCommandModules)[number] };
      expect(registeredModules.has(imported.default)).toBe(true);
    }
  });

  it('loadCommands registers all flattened core commands into commandManager and excludes canary commands', async () => {
    const registeredCommands: CustomCommand[] = [];
    const registerSpy = spyOn(commandManager, 'register').mockImplementation((cmd: CustomCommand) => {
      registeredCommands.push(cmd);
    });

    await loadCommands();

    // Flatten all expected core commands
    const expectedCommands: CustomCommand[] = [];
    for (const mod of coreCommandModules) {
      if (Array.isArray(mod)) {
        expectedCommands.push(...mod);
      } else {
        expectedCommands.push(mod);
      }
    }

    // Assert that every expected core command was registered
    expect(registeredCommands.length).toBe(expectedCommands.length);
    for (const cmd of expectedCommands) {
      expect(registeredCommands).toContain(cmd);
    }

    // In non-canary runs, verify canary-only commands are excluded
    const registeredNames = new Set(registeredCommands.map((c) => c.name.toLowerCase()));
    expect(registeredNames.has('debug')).toBe(false);
    expect(registeredNames.has('test')).toBe(false);

    registerSpy.mockRestore();
  });

  it('loads canary commands when dynamically imported', async () => {
    const [{ default: cmdDebug }, { default: cmdTest }] = await Promise.all([
      import('../essentials/commands/debug.js'),
      import('../test/commands/test.js'),
    ]);
    expect(cmdDebug).toBeDefined();
    expect(cmdTest).toBeDefined();
    expect(cmdDebug.name).toBe('debug');
    expect(cmdTest.name).toBe('test');
  });
});
