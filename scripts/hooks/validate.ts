import path from 'node:path';

import { $ } from 'bun';

const rootDir = path.resolve(import.meta.dirname, '../..');
const packageJsonPath = path.join(rootDir, 'package.json');
const manifestJsonPath = path.join(rootDir, 'packs/behavior/manifest.json');

export async function checkDependencies() {
  const pkgFile = Bun.file(packageJsonPath);
  const manifestFile = Bun.file(manifestJsonPath);

  if (!(await pkgFile.exists()) || !(await manifestFile.exists())) {
    console.warn('Could not find package.json or packs/behavior/manifest.json. Skipping dependency check.');
    return;
  }

  const [packageJson, manifestJson] = await Promise.all([pkgFile.json(), manifestFile.json()]);
  const packageDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const manifestDeps = manifestJson.dependencies || [];
  const minecraftPackageKeys = Object.keys(packageDeps).filter((d) => d.startsWith('@minecraft/'));
  const minecraftManifestModules = manifestDeps
    .filter((d: any) => d.module_name && d.module_name.startsWith('@minecraft/'))
    .map((d: any) => d.module_name as string);

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
    process.exit(1);
  }
  console.log('Dependency check passed.');
}

async function main() {
  console.log('🔍 Running project dependency verification...');
  await checkDependencies();

  const scriptEntry = path.join(rootDir, 'packs/behavior/scripts/main.js');
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
