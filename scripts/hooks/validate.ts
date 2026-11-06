import { join, resolve } from 'node:path';

import { $ } from 'bun';

const rootDir = resolve(import.meta.dirname, '../..');

interface ManifestDependency {
  module_name?: string;
  version?: string | number[];
  uuid?: string;
}

/**
 * Verifies that all Bedrock server modules in package.json dependencies are declared in manifest.json.
 *
 * @param baseDir - Base workspace directory containing package.json and packs/. Defaults to the project root.
 * @returns Array of validation error messages, or an empty array if all dependencies match.
 */
export async function checkDependencies(baseDir = rootDir): Promise<string[]> {
  const pkgFile = Bun.file(join(baseDir, 'package.json'));
  const manifestFile = Bun.file(join(baseDir, 'packs/behavior/manifest.json'));

  if (!(await pkgFile.exists()) || !(await manifestFile.exists())) {
    console.warn('Could not find package.json or packs/behavior/manifest.json. Skipping dependency check.');
    return [];
  }

  const [packageJson, manifestJson] = await Promise.all([pkgFile.json(), manifestFile.json()]);
  const packageDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const manifestDeps: ManifestDependency[] = Array.isArray(manifestJson.dependencies) ? manifestJson.dependencies : [];
  const minecraftPackageKeys = Object.keys(packageDeps).filter((d) => d.startsWith('@minecraft/'));
  const minecraftManifestModules = manifestDeps
    .filter((d) => d.module_name && d.module_name.startsWith('@minecraft/'))
    .map((d) => d.module_name as string);

  const runtimeModules = new Set<string>([
    '@minecraft/server',
    '@minecraft/server-ui',
    '@minecraft/server-gametest',
    '@minecraft/server-net',
    '@minecraft/server-admin',
    '@minecraft/server-editor',
  ]);

  const manifestModuleSet = new Set<string>(minecraftManifestModules);
  const packageKeySet = new Set<string>(minecraftPackageKeys);
  const errors: string[] = [];

  for (const pkg of minecraftPackageKeys) {
    if (runtimeModules.has(pkg) && !manifestModuleSet.has(pkg)) {
      errors.push(`Package '${pkg}' is in package.json but missing from manifest.json dependencies.`);
    }
  }

  for (const pkg of minecraftManifestModules) {
    if (!packageKeySet.has(pkg)) {
      errors.push(`Module '${pkg}' is in manifest.json but missing from package.json dependencies.`);
    }
  }

  if (errors.length > 0) {
    console.error('Dependency mismatch detected:');
    for (const e of errors) {
      console.error(`- ${e}`);
    }
  } else {
    console.log('Dependency check passed.');
  }

  return errors;
}

/** Main entry point for workspace validation, checking manifests and invoking Minecraft Creator Tools. */
async function main(): Promise<void> {
  console.log('🔍 Running project dependency verification...');
  const errors = await checkDependencies();
  if (errors.length > 0) {
    process.exit(1);
  }

  const scriptEntry = join(rootDir, 'packs/behavior/scripts/main.js');
  if (!(await Bun.file(scriptEntry).exists())) {
    console.error('❌ packs/behavior/scripts/main.js not found. Run "bun run build" first.');
    process.exit(1);
  }

  console.log('🧪 Running Minecraft Creator Tools (mct) validation...');
  const exclusions = ['pathlength', 'PATHLENGTH', 'BASEGAMEVER', 'UNKJSON', 'CHKMANIF'].join(',');
  await $`bunx mct validate default ${exclusions} -i packs`;
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
