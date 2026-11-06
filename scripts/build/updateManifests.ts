import { join, resolve } from 'node:path';

import { getVersionContext, parseCliArgs } from './cliUtils.ts';

/**
 * Resolves the Bedrock min_engine_version tuple from the @minecraft/server version string.
 *
 * @param serverVersion Semantic version string of @minecraft/server.
 * @returns Three-element integer array [major, minor, patch] rounded to nearest minor/patch floor.
 */
export function getEngineVersion(serverVersion?: string): [number, number, number] {
  const match = serverVersion?.match(/\b(1)\.(\d+)\.(\d+)/);
  if (!match) {
    return [1, 26, 60];
  }
  const major = Number.parseInt(match[1]!, 10);
  const minor = Number.parseInt(match[2]!, 10);
  const patch = Number.parseInt(match[3]!, 10);
  return [major, minor, Math.floor(patch / 10) * 10];
}

const rootDir = resolve(import.meta.dirname, '../..');
const pkgPath = resolve(rootDir, 'package.json');
const cliArgs = parseCliArgs(process.argv.slice(2));

/**
 * Resolves the latest version of an npm package from local node_modules or the npm registry.
 *
 * @param pkgName Package identifier (e.g. '@minecraft/server').
 * @returns Resolved latest semantic version string or fallback '1.0.0'.
 */
async function fetchLatestVersion(pkgName: string): Promise<string> {
  try {
    const localPkg = Bun.file(join(rootDir, 'node_modules', pkgName, 'package.json'));
    if (await localPkg.exists()) {
      const localData = await localPkg.json();
      if (localData.version) {
        return localData.version;
      }
    }
  } catch {
    // Fallback to npm registry
  }
  try {
    const response = await fetch(`https://registry.npmjs.org/${pkgName}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data['dist-tags'].latest || '1.0.0';
  } catch (err: any) {
    console.warn(`[Prebuild] Failed to fetch version for ${pkgName}: ${err.message}. Defaulting to 1.0.0.`);
    return '1.0.0';
  }
}

/**
 * Resolves the dependency module version for Minecraft manifest declaration.
 *
 * @param pkgName Package name (e.g. '@minecraft/server').
 * @param npmVersion Version string declared in package.json.
 * @returns Manifest version string (e.g. 'beta' or clean semver string).
 */
export async function resolveModuleVersion(pkgName: string, npmVersion: string): Promise<string> {
  if (!npmVersion) {
    return '1.0.0';
  }
  if (npmVersion === 'beta') {
    return 'beta';
  }
  if (npmVersion === 'latest') {
    return fetchLatestVersion(pkgName);
  }
  const cleanVersion = npmVersion.replace(/^[^\d]*/, '');
  if (cleanVersion.includes('-beta.') && cleanVersion.includes('-stable')) {
    return 'beta';
  }
  return cleanVersion;
}

/**
 * Synchronizes behavior and resource pack manifest.json files with current version metadata and dependencies.
 *
 * @param options Build CLI options indicating customVersion, isCanary, buildNumber, etc.
 */
export async function updateManifests(options = cliArgs): Promise<void> {
  const pkg = await Bun.file(pkgPath).json();
  const { versionStr: finalStr, versionArray: finalParts } = await getVersionContext(rootDir, {
    customVersion: options.customVersion,
    isCanary: options.isCanary,
    buildNumber: options.buildNumber,
    isRelease: options.isRelease,
  });

  console.log(`[Prebuild] Updating manifests to version ${finalStr} -> [${finalParts.join(', ')}]`);

  const uuids = {
    bp: {
      header: '1564bfa3-6796-4b67-826a-03ca1ac2f3c1',
      dataModule: '623bbed8-14c8-45c3-893b-c0492855b668',
      scriptModule: 'ecb49e35-ade4-459d-83ff-85c3770c1e74',
    },
    rp: {
      header: '9dca0c93-f6ec-4701-a74c-a774600640a4',
      module: 'da4ec34d-3a7a-4b10-bd5d-909810558a51',
    },
  };

  const allDeps = { ...pkg.devDependencies, ...pkg.dependencies };
  const modulesToInclude = ['@minecraft/server', '@minecraft/server-ui'];
  if (options.isCanary && allDeps['@minecraft/server-gametest']) {
    modulesToInclude.push('@minecraft/server-gametest');
  }

  const resolvedModules = await Promise.all(
    modulesToInclude
      .filter((mod) => allDeps[mod])
      .map(async (mod) => ({
        module_name: mod,
        version: await resolveModuleVersion(mod, allDeps[mod]),
      })),
  );

  const dependencies = [
    ...resolvedModules,
    {
      uuid: uuids.rp.header,
      version: finalParts,
    },
  ];

  const minEngineVersion = getEngineVersion(allDeps['@minecraft/server']);

  const bpManifest = {
    format_version: 2,
    header: {
      name: '§l§cAddonExe§6 §2BP§r',
      description: `§aThe core behavior pack for AddonExe. Version §uv${finalStr}§r`,
      uuid: uuids.bp.header,
      version: finalParts,
      min_engine_version: minEngineVersion,
    },
    modules: [
      {
        description: 'Scripting module',
        type: 'script',
        language: 'javascript',
        uuid: uuids.bp.scriptModule,
        version: finalParts,
        entry: 'scripts/main.js',
      },
      {
        description: 'Data module',
        type: 'data',
        uuid: uuids.bp.dataModule,
        version: finalParts,
      },
    ],
    dependencies,
    metadata: {
      authors: ['SjnExe'],
      license: 'MIT',
      url: 'https://github.com/SjnExe/AddonExe',
    },
  };

  const rpManifest = {
    format_version: 2,
    header: {
      name: '§l§cAddonExe§6 §9RP§r',
      description: `§bThe core resource pack for AddonExe. Version §uv${finalStr}§r`,
      uuid: uuids.rp.header,
      version: finalParts,
      min_engine_version: minEngineVersion,
    },
    modules: [
      {
        description: 'Resources',
        type: 'resources',
        uuid: uuids.rp.module,
        version: finalParts,
      },
    ],
    dependencies: [
      {
        uuid: uuids.bp.header,
        version: finalParts,
      },
    ],
    metadata: {
      authors: ['SjnExe'],
      license: 'MIT',
      url: 'https://github.com/SjnExe/AddonExe',
    },
  };

  await Bun.write(join(rootDir, 'packs/behavior/manifest.json'), JSON.stringify(bpManifest, null, 2) + '\n');
  await Bun.write(join(rootDir, 'packs/resource/manifest.json'), JSON.stringify(rpManifest, null, 2) + '\n');
}

if (import.meta.main) {
  updateManifests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
