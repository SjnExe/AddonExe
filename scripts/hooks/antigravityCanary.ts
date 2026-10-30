import fs from 'node:fs';
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

  // Only proceed if tool succeeded without error
  if (input.error) {
    console.log('{}');
    process.exit(0);
  }

  const command = (input.toolCall?.args?.CommandLine || '').trim();
  const isCanaryBuild = /\bbun\b.*(?:build:canary|build\.ts\s+--canary)/.test(command);

  if (isCanaryBuild) {
    const workspaceRoot = input.workspacePaths?.[0] || path.resolve(import.meta.dir, '../..');
    const downloadsDir = '/data/data/com.termux/files/home/storage/downloads';

    try {
      if (fs.existsSync(downloadsDir)) {
        // Find newest AddonExe.*.mcaddon in workspace
        const files = fs.readdirSync(workspaceRoot);
        const mcaddonFile = files.find((f) => f.startsWith('AddonExe.') && f.endsWith('.mcaddon'));
        if (mcaddonFile) {
          const sourcePath = path.join(workspaceRoot, mcaddonFile);
          const targetPath = path.join(downloadsDir, mcaddonFile);
          fs.copyFileSync(sourcePath, targetPath);
          // Also maintain standard AddonExe.0.8.0.mcaddon alias if version differs
          const fixedTarget = path.join(downloadsDir, 'AddonExe.0.8.0.mcaddon');
          if (targetPath !== fixedTarget) {
            fs.copyFileSync(sourcePath, fixedTarget);
          }
        }
      }
    } catch {
      // Ignore copy errors during hook execution
    }
  }

  console.log('{}');
}

main().catch(() => {
  console.log('{}');
});
