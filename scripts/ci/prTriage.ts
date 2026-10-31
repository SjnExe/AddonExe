import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

interface AuditResult {
  passed: boolean;
  warnings: string[];
  infos: string[];
}

interface PRMetadata {
  title: string;
  type: string;
  scope: string;
  size: string;
  addedLines: number;
  deletedLines: number;
  changedFiles: string[];
  audit: AuditResult;
}

function runCmd(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function getPRDetails(): { prNumber: string; prTitle: string; baseRef: string } {
  const prNumber = process.env.PR_NUMBER || '';
  let prTitle = process.env.PR_TITLE || '';
  const baseRef = process.env.PR_BASE || 'origin/main';

  if (!prTitle && prNumber) {
    prTitle = runCmd(`gh pr view ${prNumber} --json title -q .title`);
  }

  if (!prTitle) {
    prTitle = runCmd('git log -1 --pretty=%s');
  }

  return { prNumber, prTitle, baseRef };
}

function getChangedFiles(baseRef: string): string[] {
  const diffOutput = runCmd(`git diff --name-only ${baseRef}...HEAD`);
  if (!diffOutput) {
    return runCmd('git diff --name-only HEAD~1...HEAD').split('\n').filter(Boolean);
  }
  return diffOutput.split('\n').filter(Boolean);
}

function getDiffStats(baseRef: string): { added: number; deleted: number } {
  const statOutput = runCmd(`git diff --shortstat ${baseRef}...HEAD`) || runCmd('git diff --shortstat HEAD~1...HEAD');
  const addMatch = /(\d+)\s+insertion/.exec(statOutput);
  const delMatch = /(\d+)\s+deletion/.exec(statOutput);
  return {
    added: addMatch && addMatch[1] ? Number.parseInt(addMatch[1], 10) : 0,
    deleted: delMatch && delMatch[1] ? Number.parseInt(delMatch[1], 10) : 0,
  };
}

function parseConventionalCommit(title: string): { type: string; scope: string } {
  const regex = /^(feat|fix|perf|refactor|docs|test|chore|ci|style|build)(?:\(([^)]+)\))?:\s*(.+)$/i;
  const match = regex.exec(title);

  if (match) {
    const rawType = match[1]?.toLowerCase() || 'chore';
    const rawScope = match[2]?.toLowerCase() || '';

    const typeMap: Record<string, string> = {
      feat: 'type:feature',
      fix: 'type:bugfix',
      perf: 'type:performance',
      refactor: 'type:refactor',
      docs: 'type:documentation',
      test: 'type:testing',
      chore: 'type:maintenance',
      ci: 'type:maintenance',
      build: 'type:maintenance',
    };

    return {
      type: typeMap[rawType] || 'type:maintenance',
      scope: rawScope ? `scope:${rawScope}` : '',
    };
  }

  return { type: 'type:maintenance', scope: '' };
}

function determineScopeFromFiles(files: string[]): string {
  if (files.some((f) => f.includes('src/features/shop/'))) {
    return 'scope:shop';
  }
  if (files.some((f) => f.includes('src/features/teleport/'))) {
    return 'scope:teleport';
  }
  if (files.some((f) => f.includes('src/features/moderation/'))) {
    return 'scope:moderation';
  }
  if (files.some((f) => f.includes('src/features/economy/'))) {
    return 'scope:economy';
  }
  if (files.some((f) => f.includes('src/features/ranks/'))) {
    return 'scope:ranks';
  }
  if (files.some((f) => f.includes('src/features/sidebar/'))) {
    return 'scope:sidebar';
  }
  if (files.some((f) => f.includes('src/features/minesweeper/'))) {
    return 'scope:minesweeper';
  }
  if (files.some((f) => f.includes('src/ui/') || f.includes('/ui/'))) {
    return 'scope:ui';
  }
  if (files.some((f) => f.startsWith('src/core/'))) {
    return 'scope:core';
  }
  if (files.some((f) => f.startsWith('packs/behavior/'))) {
    return 'scope:behavior-pack';
  }
  if (files.some((f) => f.startsWith('packs/resource/'))) {
    return 'scope:resource-pack';
  }
  if (files.some((f) => f.startsWith('.github/') || f.startsWith('scripts/'))) {
    return 'scope:ci';
  }
  return '';
}

function determineSize(totalLines: number): string {
  if (totalLines < 30) {
    return 'size:XS';
  }
  if (totalLines < 150) {
    return 'size:S';
  }
  if (totalLines < 400) {
    return 'size:M';
  }
  if (totalLines < 800) {
    return 'size:L';
  }
  return 'size:XL';
}

function runBedrockAudit(files: string[], baseRef: string): AuditResult {
  const warnings: string[] = [];
  const infos: string[] = [];

  const configFiles = files.filter((f) => f.endsWith('Config.ts') || f === 'src/config.ts');
  const migrationFiles = files.filter(
    (f) => f.includes('migrationManager.ts') || f === 'package.json' || f.includes('scripts/update-manifests.ts'),
  );

  if (configFiles.length > 0 && migrationFiles.length === 0) {
    warnings.push(
      `Configuration definitions were altered (${configFiles.map((c) => '`' + c + '`').join(', ')}), but no SemVer migration was detected in \`src/core/migrationManager.ts\`. Ensure world upgrade safety.`,
    );
  }

  const featureFiles = files.filter((f) => f.startsWith('src/features/') && !f.includes('__tests__'));
  const testFiles = files.filter((f) => f.includes('__tests__') || f.endsWith('.test.ts'));
  if (featureFiles.length > 0 && testFiles.length === 0) {
    infos.push('Feature runtime files were modified, but no unit test files in `__tests__/` were added or updated.');
  }

  const rawDiff =
    runCmd(`git diff ${baseRef}...HEAD -U0 -- 'src/**/*.ts'`) || runCmd("git diff HEAD~1...HEAD -U0 -- 'src/**/*.ts'");
  const addedLines = rawDiff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));

  let hasAsyncPlayerCallWithoutGuard = false;
  let hasRawMinecraftStrings = false;

  for (const line of addedLines) {
    if ((line.includes('runTimeout(') || line.includes('runInterval(')) && line.includes('player.')) {
      if (!line.includes('isValid')) {
        hasAsyncPlayerCallWithoutGuard = true;
      }
    }
    if (line.includes("'minecraft:") || line.includes('"minecraft:')) {
      if (!line.includes('minecraft:script_unload') && !line.includes('//')) {
        hasRawMinecraftStrings = true;
      }
    }
  }

  if (hasAsyncPlayerCallWithoutGuard) {
    warnings.push(
      'Potential Bedrock entity safety hazard: Async timer callback directly invokes methods on `player` without verifying `player.isValid`.',
    );
  }

  if (hasRawMinecraftStrings) {
    warnings.push(
      'Raw `"minecraft:..."` string detected in new code. Import standard identifiers from `@minecraft/vanilla-data` instead.',
    );
  }

  return {
    passed: warnings.length === 0,
    warnings,
    infos,
  };
}

function generateMarkdownReport(meta: PRMetadata): string {
  const auditStatus = meta.audit.passed
    ? '✅ Passed (No critical Bedrock traps detected)'
    : '⚠️ Warning (Review recommended)';

  let warningsList = '';
  if (meta.audit.warnings.length > 0) {
    warningsList =
      '\n#### ⚠️ Bedrock Architectural Warnings\n' + meta.audit.warnings.map((w) => `- ${w}`).join('\n') + '\n';
  }

  let infosList = '';
  if (meta.audit.infos.length > 0) {
    infosList = '\n#### ℹ️ Quality Checklist\n' + meta.audit.infos.map((i) => `- ${i}`).join('\n') + '\n';
  }

  return (
    `<!-- pr-triage-bot -->
### 🤖 AddonExe PR Assistant & Bedrock Audit

| Metric | Details |
| :--- | :--- |
| **Conventional Type** | \`${meta.type}\` |
| **Target Subsystem** | \`${meta.scope || 'general'}\` |
| **Size Impact** | \`${meta.size}\` (+${meta.addedLines} / -${meta.deletedLines} lines across ${meta.changedFiles.length} files) |
| **Bedrock Safety Audit** | ${auditStatus} |
${warningsList}${infosList}`.trimEnd() + '\n'
  );
}

async function main() {
  const { prNumber, prTitle, baseRef } = getPRDetails();
  const changedFiles = getChangedFiles(baseRef);
  const diffStats = getDiffStats(baseRef);
  const totalLines = diffStats.added + diffStats.deleted;

  const conventional = parseConventionalCommit(prTitle);
  const detectedScope = conventional.scope || determineScopeFromFiles(changedFiles);
  const size = determineSize(totalLines);
  const audit = runBedrockAudit(changedFiles, baseRef);

  const meta: PRMetadata = {
    title: prTitle,
    type: conventional.type,
    scope: detectedScope,
    size,
    addedLines: diffStats.added,
    deletedLines: diffStats.deleted,
    changedFiles,
    audit,
  };

  const report = generateMarkdownReport(meta);

  console.log('--- PR Triage Report ---');
  console.log(report);

  if (process.env.GITHUB_ACTIONS && prNumber) {
    const labels = [meta.type, meta.size];
    if (meta.scope) {
      labels.push(meta.scope);
    }

    for (const label of labels) {
      runCmd(`gh pr edit ${prNumber} --add-label "${label}" || true`);
    }

    const existingComment = runCmd(
      `gh pr view ${prNumber} --json comments --jq '.comments[] | select(.body | contains("<!-- pr-triage-bot -->")) | .id'`,
    );

    const tmpFile = path.join(os.tmpdir(), `pr_triage_${prNumber}_${Date.now()}.md`);
    await Bun.write(tmpFile, report);

    try {
      if (existingComment) {
        runCmd(
          `gh api repos/${process.env.GITHUB_REPOSITORY}/issues/comments/${existingComment} -X PATCH -F body=@${tmpFile} || true`,
        );
        console.log(`Updated existing PR triage comment: ${existingComment}`);
      } else {
        runCmd(`gh pr comment ${prNumber} --body-file "${tmpFile}" || true`);
        console.log(`Posted new PR triage comment to PR #${prNumber}`);
      }
    } finally {
      try {
        await fs.unlink(tmpFile);
      } catch {
        // Ignore file cleanup error
      }
    }
  }
}

main().catch((err) => {
  console.error('Error running PR triage:', err);
  process.exit(1);
});
