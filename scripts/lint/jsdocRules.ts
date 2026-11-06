const normalizePath = (p: string) => p.replace(/\\/g, '/').replace(/^\.\//, '');

let testOverrideBase: string | null | undefined;
const cachedBaseByRepo = new Map<string, string | null>();

const gitLocalEnvVars = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX',
  'GIT_SHALLOW_FILE',
  'GIT_COMMON_DIR',
] as const;

/**
 * Constructs spawn options for Git invocations, scrubbing repository-local Git environment variables when a custom cwd
 * is used.
 *
 * @param cwd Optional working directory.
 * @param overrides Optional environment variable overrides to preserve or supply explicitly.
 * @returns Spawn options object.
 */
export function getGitSpawnOptions(
  cwd?: string,
  overrides?: Record<string, string | undefined>,
): { cwd?: string; env?: Record<string, string | undefined> } {
  if (!cwd && !overrides) {
    return {};
  }
  const cleanEnv = { ...process.env };
  if (cwd) {
    for (const key of gitLocalEnvVars) {
      delete cleanEnv[key];
    }
  }
  if (overrides) {
    Object.assign(cleanEnv, overrides);
  }
  return { ...(cwd ? { cwd } : {}), env: cleanEnv };
}

/**
 * Overrides or resets the cached merge-base SHA for testing purposes.
 *
 * @param base Merge-base SHA string, null to simulate shallow checkout, or undefined to clear.
 */
export function setCachedBaseForTesting(base: string | null | undefined): void {
  testOverrideBase = base;
  if (base === undefined) {
    cachedBaseByRepo.clear();
  }
}

/**
 * Resolves and caches the merge base SHA against the target base branch, scoped by repository directory.
 *
 * @param cwd Optional working directory for git execution.
 * @returns Resolved Git merge-base SHA string, or null if resolution fails (e.g. shallow checkout).
 */
export function resolveMergeBase(cwd?: string): string | null {
  if (testOverrideBase !== undefined) {
    return testOverrideBase;
  }
  const repoKey = cwd ? path.resolve(cwd) : process.cwd();
  if (cachedBaseByRepo.has(repoKey)) {
    return cachedBaseByRepo.get(repoKey)!;
  }

  const baseRef = process.env.GITHUB_BASE_REF;
  const candidates: string[] = [];
  if (baseRef) {
    candidates.push(`origin/${baseRef}`, baseRef);
  }
  candidates.push('origin/main', 'main');

  for (const cand of candidates) {
    const mbRes = Bun.spawnSync(['git', 'merge-base', cand, 'HEAD'], getGitSpawnOptions(cwd));
    if (mbRes.exitCode === 0) {
      const sha = mbRes.stdout.toString().trim();
      if (sha) {
        cachedBaseByRepo.set(repoKey, sha);
        return sha;
      }
    }
  }

  cachedBaseByRepo.set(repoKey, null);
  return null;
}

/**
 * Resolves the list of modified, added, and untracked TypeScript files against the merge base of origin/main.
 *
 * @returns Array of repository-relative file paths.
 */
export async function getChangedFiles(): Promise<string[]> {
  const discovered = new Set<string>();
  const base = resolveMergeBase();

  const diffArgs = base ? ['git', 'diff', '--name-only', base] : ['git', 'show', '--name-only', '--format=', 'HEAD'];
  const diffRes = Bun.spawnSync(diffArgs);
  if (diffRes.exitCode === 0) {
    for (const f of diffRes.stdout.toString().split('\n')) {
      const trimmed = f.trim();
      if (trimmed) {
        discovered.add(trimmed);
      }
    }
  }

  const statusRes = Bun.spawnSync(['git', 'status', '--porcelain', '-uall']);
  if (statusRes.exitCode === 0) {
    for (const line of statusRes.stdout.toString().split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const filePath = trimmed.replace(/^[A-Z?!\s]+\s+/, '').trim();
      if (filePath) {
        discovered.add(filePath);
      }
    }
  }

  return Array.from(discovered);
}

/**
 * Parses unified diff hunk headers to extract modified line numbers.
 *
 * @param diffText Output of git diff -U0.
 * @returns Set of 1-based line numbers.
 */
export function parseDiffHunks(diffText: string): Set<number> {
  const changedLines = new Set<number>();
  const hunkRegex = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/g;
  let match;
  while ((match = hunkRegex.exec(diffText)) !== null) {
    const start = Number.parseInt(match[1]!, 10);
    const count = match[2] !== undefined ? Number.parseInt(match[2], 10) : 1;
    if (count === 0) {
      // Pure deletion: mark both start and start + 1 so surviving declaration below removed doc is audited
      changedLines.add(Math.max(1, start));
      changedLines.add(Math.max(1, start + 1));
    } else {
      for (let l = start; l < start + count; l++) {
        changedLines.add(l);
      }
    }
  }
  return changedLines;
}

/**
 * Retrieves the set of modified line numbers for a given file based on git diff hunks. Returns 'ALL' if the file is
 * newly added or untracked.
 *
 * @param filePath Normalized repository relative path.
 * @param staged Whether to evaluate against staged changes in the Git index.
 * @param cwd Optional working directory for git execution.
 * @returns Set of 1-based line numbers modified, or 'ALL'.
 */
export function getChangedLineNumbers(filePath: string, staged = false, cwd?: string): Set<number> | 'ALL' {
  try {
    const spawnOpts = getGitSpawnOptions(cwd);
    if (staged) {
      const diffRes = Bun.spawnSync(['git', 'diff', '--cached', '-U0', '--', filePath], spawnOpts);
      if (diffRes.exitCode !== 0) {
        return 'ALL';
      }
      const diffText = diffRes.stdout.toString();
      if (!diffText.trim()) {
        return new Set<number>();
      }
      return parseDiffHunks(diffText);
    }

    const statusRes = Bun.spawnSync(['git', 'status', '--porcelain', '-uall', filePath], spawnOpts);
    const statusOut = statusRes.stdout.toString().trim();
    if (statusOut.startsWith('??') || statusOut.startsWith('A ')) {
      return 'ALL';
    }

    const base = resolveMergeBase(cwd);
    let diffText = '';
    if (base) {
      const diffRes = Bun.spawnSync(['git', 'diff', '-U0', base, '--', filePath], spawnOpts);
      if (diffRes.exitCode !== 0) {
        return 'ALL';
      }
      diffText = diffRes.stdout.toString();
    } else {
      // In shallow checkouts where merge-base resolution fails, inspect HEAD's commit diff
      // combined with any uncommitted changes in the working tree.
      const showRes = Bun.spawnSync(['git', 'show', '-U0', '--format=', 'HEAD', '--', filePath], spawnOpts);
      const diffRes = Bun.spawnSync(['git', 'diff', '-U0', 'HEAD', '--', filePath], spawnOpts);
      if (showRes.exitCode !== 0 && diffRes.exitCode !== 0) {
        return 'ALL';
      }
      diffText = `${showRes.exitCode === 0 ? showRes.stdout.toString() : ''}\n${diffRes.exitCode === 0 ? diffRes.stdout.toString() : ''}`;
    }

    if (!diffText.trim()) {
      return base ? new Set<number>() : 'ALL';
    }

    return parseDiffHunks(diffText);
  } catch {
    return 'ALL';
  }
}

/**
 * Validates whether a declaration is preceded by a non-empty, descriptive JSDoc comment.
 *
 * @param lines Array of lines in the file.
 * @param declarationIndex Line index where declaration begins.
 * @param signature Optional callable signature up to body brace or arrow to validate required tags.
 * @returns True if preceded by a valid descriptive JSDoc block with required tags.
 */
function hasValidJsDoc(lines: string[], declarationIndex: number, signature?: string): boolean {
  let commentEnd = -1;
  for (let j = declarationIndex - 1; j >= Math.max(0, declarationIndex - 5); j--) {
    const trimmed = lines[j]!.trim();
    if (trimmed.endsWith('*/')) {
      commentEnd = j;
      break;
    }
    // Allow decorators and blank lines between doc and declaration
    if (trimmed !== '' && !trimmed.startsWith('//') && !trimmed.startsWith('@')) {
      return false;
    }
  }
  if (commentEnd === -1) {
    return false;
  }

  let commentStart = -1;
  for (let j = commentEnd; j >= Math.max(0, commentEnd - 40); j--) {
    const trimmed = lines[j]!.trim();
    if (trimmed.startsWith('/**')) {
      commentStart = j;
      break;
    }
    if (trimmed.startsWith('/*')) {
      return false; // Plain block comment, not JSDoc /**
    }
  }
  if (commentStart === -1) {
    return false;
  }

  // Extract non-empty comment text between /** and */
  const contentLines: string[] = [];
  for (let j = commentStart; j <= commentEnd; j++) {
    let line = lines[j]!.trim();
    if (j === commentStart) {
      line = line.replace(/^\/\*\*\s*/, '');
    }
    if (j === commentEnd) {
      line = line.replace(/\*\/$/, '');
    }
    line = line.replace(/^\*\s*/, '').trim();
    if (line.length > 0) {
      contentLines.push(line);
    }
  }

  // Must have at least one meaningful descriptive line that is not solely a tag
  const hasDescription = contentLines.some((l) => !l.startsWith('@') && l.trim().length > 0);
  if (!hasDescription) {
    return false;
  }

  // Inspect callable signature for required @param and @returns tags when signature is provided
  if (signature) {
    const paramMatch = signature.match(/\(([\s\S]*?)\)/);
    if (paramMatch && paramMatch[1] && paramMatch[1].trim().length > 0) {
      const hasParamTag = contentLines.some((l) => l.startsWith('@param'));
      if (!hasParamTag) {
        return false;
      }
    }

    const returnMatch = signature.match(/\):\s*([a-zA-Z0-9_$<>[\]|, ]+)/);
    if (returnMatch && returnMatch[1]) {
      const retType = returnMatch[1].trim();
      if (retType !== 'void' && retType !== 'Promise<void>') {
        const hasReturnsTag = contentLines.some((l) => l.startsWith('@returns') || l.startsWith('@return'));
        if (!hasReturnsTag) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Stateful lexer that determines the ending line of a declaration block and extracts its block text, ignoring
 * delimiters inside strings, template literals, and comments.
 *
 * @param lines Array of lines in the source file.
 * @param startIndex Index of the line where declaration begins.
 * @returns Object with endLine, accumulated blockText, bodyBraceOffset, and arrowOffset.
 */
function findDeclarationEnd(
  lines: string[],
  startIndex: number,
): { endLine: number; blockText: string; bodyBraceOffset: number; arrowOffset: number } {
  const declLine = startIndex + 1;
  let endLine = declLine;
  let braceCount = 0;
  let foundOpenBrace = false;
  let parenDepth = 0;
  let blockText = '';
  let bodyBraceOffset = -1;
  let arrowOffset = -1;
  let angleDepth = 0;

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let inBlockComment = false;

  for (let j = startIndex; j < lines.length; j++) {
    const l = lines[j]!;
    blockText += l + '\n';

    // Single and double quotes cannot span line breaks in JavaScript/TypeScript
    inSingleQuote = false;
    inDoubleQuote = false;

    for (let c = 0; c < l.length; c++) {
      const char = l[c]!;
      const nextChar = c + 1 < l.length ? l[c + 1] : '';

      if (inBlockComment) {
        if (char === '*' && nextChar === '/') {
          inBlockComment = false;
          c++;
        }
        continue;
      }

      if (inSingleQuote) {
        if (char === '\\') {
          c++; // skip escaped char
        } else if (char === "'") {
          inSingleQuote = false;
        }
        continue;
      }

      if (inDoubleQuote) {
        if (char === '\\') {
          c++; // skip escaped char
        } else if (char === '"') {
          inDoubleQuote = false;
        }
        continue;
      }

      if (inTemplate) {
        if (char === '\\') {
          c++; // skip escaped char
        } else if (char === '`') {
          inTemplate = false;
        }
        continue;
      }

      // Check line comment
      if (char === '/' && nextChar === '/') {
        break; // skip rest of line
      }

      // Check block comment start
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        c++;
        continue;
      }

      // Check quote starts
      if (char === "'") {
        inSingleQuote = true;
        continue;
      }
      if (char === '"') {
        inDoubleQuote = true;
        continue;
      }
      if (char === '`') {
        inTemplate = true;
        continue;
      }

      const currentOffset = blockText.length - (l.length + 1) + c;

      // Generic type and return type angle brackets (<...>). Braces inside them are not the function/class body.
      if (char === '<') {
        angleDepth++;
      } else if (char === '>' && angleDepth > 0) {
        angleDepth--;
      }

      if (parenDepth === 0 && angleDepth === 0 && char === '=' && nextChar === '>' && arrowOffset === -1) {
        arrowOffset = currentOffset;
      }

      // Delimiters
      if (char === '(') {
        parenDepth++;
      } else if (char === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
      } else if (parenDepth <= 0 && char === '{') {
        if (bodyBraceOffset === -1 && angleDepth === 0) {
          bodyBraceOffset = currentOffset;
        }
        braceCount++;
        foundOpenBrace = true;
      } else if (parenDepth <= 0 && char === '}') {
        braceCount--;
      }
    }

    if (foundOpenBrace && braceCount <= 0) {
      endLine = j + 1;
      break;
    }
    if (!foundOpenBrace && l.includes(';')) {
      endLine = j + 1;
      break;
    }
  }

  return { endLine, blockText, bodyBraceOffset, arrowOffset };
}

/**
 * Determines whether a variable initializer represents an arrow function declaration, handling generics (<T>), balanced
 * parameter lists, and optional return type annotations.
 *
 * @param initializer Right-hand side text of the variable assignment.
 * @returns True if the initializer is an arrow function.
 */
export function isArrowFunctionInitializer(initializer: string): boolean {
  const trimmed = initializer.trimStart();
  let i = 0;
  if (trimmed.startsWith('async')) {
    i += 5;
    while (i < trimmed.length && /\s/.test(trimmed[i]!)) {
      i++;
    }
  }
  // Generic type parameters <...>
  if (trimmed[i] === '<') {
    let angleDepth = 0;
    while (i < trimmed.length) {
      if (trimmed[i] === '<') {
        angleDepth++;
      } else if (trimmed[i] === '>') {
        angleDepth--;
        if (angleDepth === 0) {
          i++;
          break;
        }
      }
      i++;
    }
    while (i < trimmed.length && /\s/.test(trimmed[i]!)) {
      i++;
    }
  }
  // Single identifier param without parentheses: x => ...
  const identMatch = trimmed.slice(i).match(/^[a-zA-Z0-9_$]+\s*=>/);
  if (identMatch) {
    return true;
  }
  // Parenthesized parameter list: (...) ... =>
  if (trimmed[i] === '(') {
    let parenDepth = 0;
    while (i < trimmed.length) {
      if (trimmed[i] === '(') {
        parenDepth++;
      } else if (trimmed[i] === ')') {
        parenDepth--;
        if (parenDepth === 0) {
          i++;
          break;
        }
      }
      i++;
    }
    // After closing ')', skip whitespace, optional return type ': ...', to a top-level '=>'
    const rest = trimmed.slice(i).trimStart();
    if (rest.startsWith('=>')) {
      return true;
    }
    if (!rest.startsWith(':')) {
      return false;
    }
    let depth = 0;
    for (let k = 1; k < rest.length; k++) {
      const ch = rest[k]!;
      if (ch === '=' && rest[k + 1] === '>' && depth === 0) {
        return true;
      }
      if (ch === '{' || ch === '(' || ch === '<' || ch === '[') {
        depth++;
      } else if (ch === '}' || ch === ')' || ch === ']') {
        depth--;
      } else if (ch === '>' && rest[k - 1] !== '=') {
        depth--;
      }
    }
    return false;
  }
  return false;
}

const declarationPattern =
  /^\s*export\s+(?:default\s+)?(?:(?:async\s+)?function(?:\s+([a-zA-Z0-9_$]+))?|(?:abstract\s+)?class\s+([a-zA-Z0-9_$]+)|interface\s+([a-zA-Z0-9_$]+)|type\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+))/;

/** Options configuring JSDoc documentation validation behavior. */
export interface JsDocValidationOptions {
  staged?: boolean;
}

/**
 * Validates that exported functions, classes, interfaces, and types include descriptive JSDoc comments.
 *
 * @param targetFiles Optional array of target file paths. If omitted, checks staged or modified files.
 * @param options Optional validation behavior options (e.g., inspecting staged index).
 * @returns Number of missing documentation violations encountered.
 */
export async function validateJsDocRules(targetFiles?: string[], options?: JsDocValidationOptions): Promise<number> {
  let filesToCheck = targetFiles;
  if (!filesToCheck) {
    filesToCheck = await getChangedFiles();
  }

  const codePaths = filesToCheck
    .map(normalizePath)
    .filter(
      (p) =>
        (p.endsWith('.ts') || p.endsWith('.tsx')) &&
        (p.startsWith('src/') || p.startsWith('scripts/')) &&
        !p.includes('__tests__') &&
        !p.includes('__mocks__') &&
        !p.endsWith('.d.ts'),
    );

  if (codePaths.length === 0) {
    return 0;
  }

  let totalViolations = 0;

  for (const filePath of codePaths) {
    let content: string;
    if (options?.staged) {
      const showRes = Bun.spawnSync(['git', 'show', `:${filePath}`]);
      if (showRes.exitCode === 0) {
        content = showRes.stdout.toString();
      } else {
        const file = Bun.file(filePath);
        if (!(await file.exists())) {
          continue;
        }
        content = await file.text();
      }
    } else {
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        continue;
      }
      content = await file.text();
    }

    const lines = content.split('\n');
    const changedLines = getChangedLineNumbers(filePath, options?.staged);

    if (changedLines instanceof Set && changedLines.size === 0) {
      continue;
    }

    let fileViolations = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const match = line.match(declarationPattern);
      if (match) {
        const declLine = i + 1;
        const { endLine, blockText, bodyBraceOffset, arrowOffset } = findDeclarationEnd(lines, i);

        const isFunctionDecl = !!match[1];
        let isArrowVar = false;
        let isFunctionExpression = false;
        if (match[5]) {
          let equalsIdx = -1;
          for (let k = 0; k < blockText.length; k++) {
            if (blockText[k] === '=' && blockText[k + 1] !== '>') {
              equalsIdx = k;
              break;
            }
          }
          if (equalsIdx !== -1) {
            const initializer = blockText.slice(equalsIdx + 1).trim();
            isFunctionExpression = /^(?:async\s+)?function\b/.test(initializer);
            if (isFunctionExpression || isArrowFunctionInitializer(initializer)) {
              isArrowVar = true;
            }
          }
          if (!isArrowVar) {
            continue;
          }
        }

        // Include any attached JSDoc block in the modified line check range
        let docStartLine = declLine;
        for (let j = i - 1; j >= Math.max(0, i - 40); j--) {
          const trimmed = lines[j]!.trim();
          if (trimmed.startsWith('/**')) {
            docStartLine = j + 1;
            break;
          }
          if (!trimmed.startsWith('*') && !trimmed.startsWith('//') && !trimmed.startsWith('@') && trimmed !== '') {
            break;
          }
        }

        let isModified = changedLines === 'ALL';
        if (!isModified && changedLines instanceof Set) {
          for (let l = docStartLine; l <= endLine; l++) {
            if (changedLines.has(l)) {
              isModified = true;
              break;
            }
          }
        }

        if (isModified) {
          let signature: string | undefined;
          if (isFunctionDecl) {
            signature = bodyBraceOffset !== -1 ? blockText.slice(0, bodyBraceOffset) : blockText;
          } else if (isArrowVar) {
            const cutoff = isFunctionExpression ? bodyBraceOffset : arrowOffset;
            signature = cutoff !== -1 ? blockText.slice(0, cutoff) : blockText;
          }

          const hasDoc = hasValidJsDoc(lines, i, signature);
          if (!hasDoc) {
            const declName = match[1] || match[2] || match[3] || match[4] || match[5] || 'declaration';
            console.error(
              `\x1b[31m[JSDocLint] Missing or invalid JSDoc documentation for exported ${declName} at ${filePath}:${declLine}\x1b[0m`,
            );
            fileViolations++;
          }
        }
      }
    }

    totalViolations += fileViolations;
  }

  return totalViolations;
}
