const MIN_TOKENS = 50;
const MIN_LINES = 5;

interface WindowHit {
  file: string;
  startLine: number;
  endLine: number;
}

const tokenRegex =
  /[A-Za-z_$][A-Za-z0-9_$]*|\d+(?:\.\d+)?|==|!=|===|!==|<=|>=|=>|&&|\|\||[{}()[\].,:;?+\-*/%&|^!~<>]=?/g;

function tokenizeWithLines(source: string): { hashes: BigUint64Array; lines: Uint32Array } {
  const clean = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, (m) => m.replace(/[^\n]/g, ' '));
  const tokenHashes: bigint[] = [];
  const tokenLines: number[] = [];

  const rawLines = clean.split('\n');
  for (let i = 0; i < rawLines.length; i++) {
    const lineText = rawLines[i]!;
    const trimmed = lineText.trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('export type ') || trimmed.length === 0) {
      continue;
    }
    const matches = lineText.match(tokenRegex);
    if (!matches) {
      continue;
    }
    for (let j = 0; j < matches.length; j++) {
      tokenHashes.push(BigInt(Bun.hash.wyhash(matches[j]!)));
      tokenLines.push(i + 1);
    }
  }

  return {
    hashes: new BigUint64Array(tokenHashes),
    lines: new Uint32Array(tokenLines),
  };
}

export async function checkDuplication(): Promise<void> {
  const t0 = performance.now();
  const glob = new Bun.Glob('src/**/*.ts');
  const files = Array.from(glob.scanSync('.')).filter(
    (f) => !f.includes('__tests__') && !f.includes('__mocks__') && !f.endsWith('wordPool.ts'),
  );

  const fileData = await Promise.all(
    files.map(async (file) => {
      const text = await Bun.file(file).text();
      return { file, ...tokenizeWithLines(text) };
    }),
  );

  const seenWindows = new Map<bigint, WindowHit>();
  const duplicates: { first: WindowHit; second: WindowHit }[] = [];
  let totalTokens = 0;

  for (const { file, hashes, lines } of fileData) {
    totalTokens += hashes.length;
    if (hashes.length < MIN_TOKENS) {
      continue;
    }

    let lastReportedLine = -1;
    const limit = hashes.length - MIN_TOKENS;
    const buf = new BigUint64Array(MIN_TOKENS);

    for (let i = 0; i <= limit; i++) {
      const startLine = lines[i]!;
      const endLine = lines[i + MIN_TOKENS - 1]!;
      if (endLine - startLine + 1 < MIN_LINES) {
        continue;
      }

      for (let k = 0; k < MIN_TOKENS; k++) {
        buf[k] = hashes[i + k]!;
      }
      const windowHash = BigInt(Bun.hash.wyhash(new Uint8Array(buf.buffer)));
      const existing = seenWindows.get(windowHash);

      if (existing) {
        if (
          (existing.file !== file || Math.abs(existing.startLine - startLine) > MIN_LINES) &&
          startLine > lastReportedLine
        ) {
          duplicates.push({
            first: existing,
            second: { file, startLine, endLine },
          });
          lastReportedLine = endLine;
        }
      } else {
        seenWindows.set(windowHash, { file, startLine, endLine });
      }
    }
  }

  const elapsed = (performance.now() - t0).toFixed(2);
  console.log(
    `[DupeCheck] Scanned ${files.length} files (${totalTokens.toLocaleString()} tokens) in ${elapsed} ms. Found ${duplicates.length} duplicate block(s).`,
  );
}

if (import.meta.main) {
  await checkDuplication();
}
