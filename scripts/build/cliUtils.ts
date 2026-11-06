import { resolve } from 'node:path';

/** Parsed command-line arguments configuring the build and packaging pipeline. */
export interface ParsedArgs {
  /** Whether watch mode is enabled to automatically rebuild on source changes. */
  isWatch: boolean;
  /** Whether the build is configured for release packaging. */
  isRelease: boolean;
  /** Whether the build produces a canary / pre-release archive with test framework enabled. */
  isCanary: boolean;
  /** Whether to package build output into a .mcaddon zip archive. */
  isZip: boolean;
  /** Whether JavaScript output should be minified. */
  isMinify: boolean;
  /** Optional flag indicating whether source maps should be generated. */
  sourcemap?: boolean;
  /** Monotonically increasing build or CI run number used in canary versions. */
  buildNumber: number;
  /** Custom semantic version string overriding package.json version. */
  customVersion?: string;
}

/** Options passed to resolve the version context for manifest generation and archive naming. */
export interface VersionContextOptions {
  /** Explicit custom semantic version string overriding package.json. */
  customVersion?: string;
  /** Whether canary version formatting should be applied. */
  isCanary?: boolean;
  /** Build number applied to the canary version tuple. */
  buildNumber?: number;
  /** Whether release mode is active. */
  isRelease?: boolean;
}

/** Resolved version metadata representation including string and tuple formats. */
export interface VersionContext {
  /** Formatted version string for displays and archive filenames. */
  versionStr: string;
  /** Three-element numerical tuple [major, minor, patch] required by Minecraft manifests. */
  versionArray: number[];
  /** Sanitized base semantic version string without pre-release suffixes. */
  baseVersionStr: string;
}

/**
 * Parses CLI arguments into structured configuration flags for build workflows.
 *
 * @param argv Command line argument array (defaults to process.argv.slice(2)).
 * @returns ParsedArgs structure with normalized flags.
 */
export function parseCliArgs(argv: string[] = process.argv.slice(2)): ParsedArgs {
  let isWatch = false;
  let isRelease = false;
  let isCanary = false;
  let isZip = false;
  let isMinify = false;
  let noMinify = false;
  let sourcemap = false;
  let buildNumber = 0;
  let customVersion: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-w' || arg === '--watch') {
      isWatch = true;
    } else if (arg === '-r' || arg === '--release') {
      isRelease = true;
    } else if (arg === '-c' || arg === '--canary' || arg === '-n' || arg === '--nightly') {
      isCanary = true;
    } else if (arg === '-z' || arg === '--zip') {
      isZip = true;
    } else if (arg === '-m' || arg === '--minify') {
      isMinify = true;
    } else if (arg === '--no-minify') {
      noMinify = true;
    } else if (arg === '--sourcemap') {
      sourcemap = true;
    } else if (arg === '-b' || arg === '--build-number') {
      if (i + 1 < argv.length && !argv[i + 1]!.startsWith('-')) {
        buildNumber = Number.parseInt(argv[++i]!, 10) || 0;
      }
    } else if (arg?.startsWith('-b=') || arg?.startsWith('--build-number=')) {
      const val = arg.split('=')[1] ?? '0';
      buildNumber = Number.parseInt(val, 10) || 0;
    } else if (arg === '-v' || arg === '--version') {
      if (i + 1 < argv.length && !argv[i + 1]!.startsWith('-')) {
        customVersion = argv[++i];
      }
    } else if (arg?.startsWith('-v=') || arg?.startsWith('--version=')) {
      customVersion = arg.split('=')[1];
    }
  }

  isZip = isZip || isRelease || isCanary;
  isMinify = !noMinify && (isMinify || isRelease || isCanary || isZip);

  return {
    isWatch,
    isRelease,
    isCanary,
    isZip,
    isMinify,
    sourcemap,
    buildNumber,
    customVersion,
  };
}

/**
 * Resolves version information from package.json or CLI options for manifest and artifact naming.
 *
 * @param rootDir Root directory of the repository containing package.json.
 * @param options Version context options including customVersion, isCanary, and buildNumber.
 * @returns Resolved version metadata object with versionStr, versionArray, and baseVersionStr.
 */
export async function getVersionContext(rootDir: string, options: VersionContextOptions = {}): Promise<VersionContext> {
  const pkgPath = resolve(rootDir, 'package.json');
  let baseVersionStr = options.customVersion;

  if (!baseVersionStr) {
    try {
      const pkg = await Bun.file(pkgPath).json();
      baseVersionStr = pkg.version;
    } catch {
      // Ignore error
    }
  }

  if (!baseVersionStr) {
    baseVersionStr = '0.0.1';
  }

  if (baseVersionStr.startsWith('v') || baseVersionStr.startsWith('V')) {
    baseVersionStr = baseVersionStr.slice(1);
  }

  const parts = baseVersionStr.split('.').map((p) => Number.parseInt(p, 10));
  const major = Number.isNaN(parts[0]) ? 0 : parts[0]!;
  const minor = Number.isNaN(parts[1]) ? 0 : parts[1]!;
  const patch = Number.isNaN(parts[2]) ? 0 : parts[2]!;

  let finalParts = [major, minor, patch];
  let finalStr = `${major}.${minor}.${patch}`;

  if (options.isCanary) {
    const buildNum = options.buildNumber || 0;
    finalParts = [major, minor, buildNum > 0 ? buildNum : patch];
    finalStr = buildNum > 0 ? `${major}.${minor}.${buildNum}` : `${major}.${minor}.${patch}-canary`;
  }

  return {
    versionStr: finalStr,
    versionArray: finalParts,
    baseVersionStr: `${major}.${minor}.${patch}`,
  };
}
