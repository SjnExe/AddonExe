import path from 'node:path';

async function main() {
  let input: any = {};
  try {
    const text = await Bun.stdin.text();
    if (text.trim()) {
      input = JSON.parse(text);
    }
  } catch {
    // Ignore parse errors on empty stdin
  }

  const command = (input.toolCall?.args?.CommandLine || '').trim();
  const workspaceRoot = input.workspacePaths?.[0] || path.resolve(import.meta.dir, '../..');

  // Guard 1: Block raw git push --force without --force-with-lease
  if (/\bgit\s+push\b.*(-f\b|--force\b)(?!-with-lease)/.test(command)) {
    console.log(
      JSON.stringify({
        decision: 'deny',
        reason:
          'Safety Gate: Raw --force push blocked. Use --force-with-lease instead to prevent overwriting remote work.',
      }),
    );
    process.exit(0);
  }

  // Guard 2: Block direct push to main branch
  if (/\bgit\s+push\b/.test(command)) {
    if (/\bgit\s+push\b.*(?:\bmain\b|\bHEAD:main\b)/.test(command)) {
      console.log(
        JSON.stringify({
          decision: 'deny',
          reason: 'Safety Gate: Direct push to main is prohibited. Always work on a feature branch and submit a PR.',
        }),
      );
      process.exit(0);
    }

    try {
      const branchProc = Bun.spawnSync(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: workspaceRoot,
      });
      const currentBranch = branchProc.stdout.toString().trim();
      if (currentBranch === 'main' && !command.includes(':')) {
        console.log(
          JSON.stringify({
            decision: 'deny',
            reason:
              'Safety Gate: Direct push on main branch is prohibited. Always work on a feature branch and submit a PR.',
          }),
        );
        process.exit(0);
      }
    } catch {
      // Ignore git resolution errors
    }
  }

  // Guard 3: Block direct edits to packs/behavior/scripts/ (per AGENTS.md invariant)
  if (/\b(?:rm|cp|mv|cat|echo|sed|tee)\b.*packs\/behavior\/scripts\//.test(command) && !command.includes('clean')) {
    console.log(
      JSON.stringify({
        decision: 'deny',
        reason:
          'Safety Gate: Direct modification of packs/behavior/scripts/ is forbidden by AGENTS.md. Edit src/ and run bun build.',
      }),
    );
    process.exit(0);
  }

  // Automation 1: Auto-rewrite `bun test` or `bun run test` to always include `--parallel`
  if (/^bun\s+(?:run\s+)?test(?:\s+.*)?$/.test(command) && !command.includes('--parallel')) {
    const rewritten = command.replace(/^bun\s+(?:run\s+)?test/, 'bun test --parallel');
    console.log(
      JSON.stringify({
        decision: 'allow',
        overwrite: {
          CommandLine: rewritten,
        },
      }),
    );
    process.exit(0);
  }

  // Default: allow execution
  console.log(JSON.stringify({ decision: 'allow' }));
}

main().catch(() => {
  console.log(JSON.stringify({ decision: 'allow' }));
});
