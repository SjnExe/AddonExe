import { join } from 'node:path';

export const targetPackages = ['@minecraft/server', '@minecraft/server-ui'];

/**
 * Compares two semantic version strings using Bun.semver.
 *
 * @param v1 First semantic version string.
 * @param v2 Second semantic version string.
 * @returns Negative number if v1 < v2, 0 if equal, positive number if v1 > v2.
 */
export function compareVersions(v1: string, v2: string): number {
  return Bun.semver.order(v1, v2);
}

/**
 * Synchronizes Minecraft Bedrock engine package versions in package.json against npm registry latest beta releases.
 *
 * @param packageJsonPath Optional custom path to package.json (defaults to package.json in current working directory).
 * @returns Object indicating whether changes were made and which package versions were updated.
 */
export async function autoAlignDependencies(packageJsonPath = join(process.cwd(), 'package.json')): Promise<{
  changesMade: boolean;
  updates: Record<string, string>;
}> {
  console.log('🌐 Synchronizing Minecraft Ecosystem Engine configurations to match latest beta versions...');

  const packageJsonFile = Bun.file(packageJsonPath);
  const packageJson = await packageJsonFile.json();
  let changesMade = false;
  const updates: Record<string, string> = {};

  for (const pkg of targetPackages) {
    try {
      const response = await fetch(`https://registry.npmjs.org/${pkg}`, {
        headers: { Accept: 'application/vnd.npm.install-v1+json' },
      });
      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const versions = Object.keys(data.versions || {});

      const betaVersions = versions.filter((v) => /^(\d+)\.(\d+)\.(\d+)-beta\.(\d+)\.(\d+)\.(\d+)-stable$/.test(v));
      if (betaVersions.length === 0) {
        continue;
      }

      betaVersions.sort(compareVersions);
      const matchedVersion = betaVersions[betaVersions.length - 1];

      if (matchedVersion) {
        const currentVersionDeps = packageJson.dependencies?.[pkg];
        const currentVersionDevDeps = packageJson.devDependencies?.[pkg];

        if (currentVersionDeps && currentVersionDeps !== matchedVersion) {
          packageJson.dependencies[pkg] = matchedVersion;
          console.log(`🎯 Version Mismatch Resolved in dependencies: ${pkg} -> ${matchedVersion}`);
          changesMade = true;
          updates[pkg] = matchedVersion;
        }

        if (currentVersionDevDeps && currentVersionDevDeps !== matchedVersion) {
          packageJson.devDependencies[pkg] = matchedVersion;
          console.log(`🎯 Version Mismatch Resolved in devDependencies: ${pkg} -> ${matchedVersion}`);
          changesMade = true;
          updates[pkg] = matchedVersion;
        }

        if (packageJson.overrides?.[pkg] && packageJson.overrides[pkg] !== matchedVersion) {
          packageJson.overrides[pkg] = matchedVersion;
          console.log(`🎯 Version Mismatch Resolved in overrides: ${pkg} -> ${matchedVersion}`);
          changesMade = true;
          updates[pkg] = matchedVersion;
        }
      }
    } catch {
      console.error(`❌ Network timeout evaluating version matrix for package: ${pkg}`);
    }
  }

  if (changesMade) {
    await Bun.write(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('📝 package.json updated successfully.');
  } else {
    console.log('✅ Local dependencies match your target version context.');
  }

  return { changesMade, updates };
}

if (import.meta.main) {
  autoAlignDependencies().catch(console.error);
}
