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

  const workspaceRoot = input.workspacePaths?.[0] || path.resolve(import.meta.dir, '../..');
  const targetPath = input.toolCall?.args?.Path || '';

  // Only auto-format if the tool touched TS, JSON, or MD files
  if (!targetPath || /\.(?:ts|json|md)$/.test(targetPath)) {
    try {
      Bun.spawnSync(['bun', 'fmt', '--changed'], {
        cwd: workspaceRoot,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
    } catch {
      // Ignore formatting errors during hook execution
    }
  }

  // PostToolUse contract requires empty JSON object on stdout
  console.log('{}');
}

main().catch(() => {
  console.log('{}');
});
