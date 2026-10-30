import path from 'node:path';

export function parseChangelogSection(markdown: string, targetVersion: string): string | null {
  const cleanTarget = targetVersion.replace(/^v/i, '').trim();
  const escapedTarget = cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match: ## [0.8.0], ## [v0.8.0], ## [0.8.0] - ..., etc.
  const headerRegex = new RegExp(`^##\\s*\\[v?${escapedTarget}\\](?:\\s*-\\s*.*)?$`, 'm');
  const match = headerRegex.exec(markdown);

  let startIndex = -1;
  if (match) {
    startIndex = match.index + match[0].length;
  } else if (cleanTarget === 'unreleased') {
    const unreleasedRegex = /^##\s*\[unreleased\]/im;
    const unreleasedMatch = unreleasedRegex.exec(markdown);
    if (unreleasedMatch) {
      startIndex = unreleasedMatch.index + unreleasedMatch[0].length;
    }
  }

  if (startIndex === -1) {
    return null;
  }

  const remainder = markdown.slice(startIndex);
  // Find next section marked by ## [
  const nextSectionMatch = /^##\s*\[/m.exec(remainder);
  const rawSection = nextSectionMatch ? remainder.slice(0, nextSectionMatch.index) : remainder;

  const trimmed = rawSection.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function extractChangelog(version: string, changelogPath?: string): Promise<string | null> {
  const filePath = changelogPath ?? path.resolve(process.cwd(), 'docs/changelog.md');
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  return parseChangelogSection(content, version);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const versionArg = args[0] || (await Bun.file('package.json').json()).version;
  const outIndex = args.indexOf('--output');
  const outFile = outIndex !== -1 && args[outIndex + 1] ? args[outIndex + 1] : null;

  const result = await extractChangelog(versionArg);
  if (result) {
    if (outFile) {
      await Bun.write(outFile, result);
      console.log(`[Changelog] Extracted release notes for v${versionArg} -> ${outFile}`);
    } else {
      console.log(result);
    }
  } else {
    console.warn(`[Changelog] No entry found for v${versionArg} in docs/changelog.md`);
  }
}
