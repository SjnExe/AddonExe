import path from 'node:path';

export interface ParsedArgs {
    isWatch: boolean;
    isRelease: boolean;
    isNightly: boolean;
    isZip: boolean;
    isMinify: boolean;
    buildNumber: number;
    customVersion?: string;
}

export function parseCliArgs(argv: string[] = process.argv.slice(2)): ParsedArgs {
    let isWatch = false;
    let isRelease = false;
    let isNightly = false;
    let isZip = false;
    let isMinify = false;
    let buildNumber = 0;
    let customVersion: string | undefined;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '-w' || arg === '--watch') {
            isWatch = true;
        } else if (arg === '-r' || arg === '--release') {
            isRelease = true;
        } else if (arg === '-n' || arg === '--nightly') {
            isNightly = true;
        } else if (arg === '-z' || arg === '--zip') {
            isZip = true;
        } else if (arg === '-m' || arg === '--minify') {
            isMinify = true;
        } else if (arg === '-b' || arg === '--build-number') {
            if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
                buildNumber = Number.parseInt(argv[++i], 10) || 0;
            }
        } else if (arg.startsWith('-b=') || arg.startsWith('--build-number=')) {
            const val = arg.split('=')[1];
            buildNumber = Number.parseInt(val, 10) || 0;
        } else if (arg === '-v' || arg === '--version') {
            if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
                customVersion = argv[++i];
            }
        } else if (arg.startsWith('-v=') || arg.startsWith('--version=')) {
            customVersion = arg.split('=')[1];
        }
    }

    isZip = isZip || isRelease || isNightly;
    isMinify = isMinify || isRelease;

    return {
        isWatch,
        isRelease,
        isNightly,
        isZip,
        isMinify,
        buildNumber,
        customVersion
    };
}

export async function getVersionContext(
    rootDir: string,
    options: {
        customVersion?: string;
        isNightly?: boolean;
        buildNumber?: number;
        isRelease?: boolean;
    }
) {
    const pkgPath = path.resolve(rootDir, 'package.json');
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
    const major = Number.isNaN(parts[0]) ? 0 : parts[0];
    const minor = Number.isNaN(parts[1]) ? 0 : parts[1];
    const patch = Number.isNaN(parts[2]) ? 0 : parts[2];

    let finalParts = [major, minor, patch];
    let finalStr = `${major}.${minor}.${patch}`;

    if (options.isNightly) {
        const buildNum = options.buildNumber || 0;
        finalParts = [major, minor, buildNum];
        finalStr = `${major}.${minor}.${buildNum}`;
    }

    return {
        versionStr: finalStr,
        versionArray: finalParts,
        baseVersionStr: `${major}.${minor}.${patch}`
    };
}
