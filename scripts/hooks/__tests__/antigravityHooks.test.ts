import { describe, expect, it } from 'bun:test';
import path from 'node:path';

describe('antigravitySafety hook', () => {
  const safetyScript = path.resolve(import.meta.dir, '../antigravitySafety.ts');

  async function runSafetyHook(commandLine: string) {
    const input = JSON.stringify({
      toolCall: {
        name: 'run_command',
        args: {
          CommandLine: commandLine,
        },
      },
    });

    const proc = Bun.spawn(['bun', safetyScript], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });

    proc.stdin.write(input);
    proc.stdin.end();

    const outputText = await new Response(proc.stdout).text();
    return JSON.parse(outputText.trim());
  }

  it('denies raw git push --force', async () => {
    const result = await runSafetyHook('git push origin feat -f');
    expect(result.decision).toBe('deny');
    expect(result.reason).toContain('Safety Gate');
  });

  it('allows git push --force-with-lease', async () => {
    const result = await runSafetyHook('git push origin feat --force-with-lease');
    expect(result.decision).toBe('allow');
  });

  it('denies direct git push to main', async () => {
    const result = await runSafetyHook('git push origin main');
    expect(result.decision).toBe('deny');
    expect(result.reason).toContain('main');
  });

  it('allows remote branch deletion via git push --delete', async () => {
    const result = await runSafetyHook('git push origin --delete feat/temp');
    expect(result.decision).toBe('allow');
  });

  it('denies editing packs/behavior/scripts/', async () => {
    const result = await runSafetyHook('echo "foo" > packs/behavior/scripts/main.js');
    expect(result.decision).toBe('deny');
    expect(result.reason).toContain('packs/behavior/scripts/');
  });

  it('rewrites bun test to bun test --parallel', async () => {
    const result = await runSafetyHook('bun test');
    expect(result.decision).toBe('allow');
    expect(result.overwrite?.CommandLine).toBe('bun test --parallel');
  });

  it('rewrites bun run test to bun test --parallel', async () => {
    const result = await runSafetyHook('bun run test');
    expect(result.decision).toBe('allow');
    expect(result.overwrite?.CommandLine).toBe('bun test --parallel');
  });

  it('does not rewrite bun test:dupe', async () => {
    const result = await runSafetyHook('bun test:dupe');
    expect(result.decision).toBe('allow');
    expect(result.overwrite).toBeUndefined();
  });
});
