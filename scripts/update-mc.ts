import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const targetPackages = ['@minecraft/debug-utilities', '@minecraft/server', '@minecraft/server-gametest', '@minecraft/server-ui'];

async function getLatestBetaVersion(pkg: string): Promise<string | undefined> {
    try {
        const response = await fetch(`https://registry.npmjs.org/${pkg}`, {
            headers: { Accept: 'application/vnd.npm.install-v1+json' }
        });
        if (!response.ok) return undefined;
        const data = await response.json();
        const versions = Object.keys(data.versions || {});
        // We want the highest version that ends in "-stable" and has "-beta" in it
        // since the exact MC_VERSION might be slightly different. We sort using semver-like comparison
        // to get the absolute latest matching this pattern.
        const betaVersions = versions.filter((v) => v.includes('-beta.') && v.endsWith('-stable'));
        if (betaVersions.length === 0) return undefined;

        // Custom sort to find the highest version
        betaVersions.sort((a, b) => {
            // e.g. "1.1.0-beta.1.20.0-stable"
            // We can rely on NPM's publish order or do a simple string comparison for most cases,
            // but a proper parse is safer if things get messy. Since these are nicely formatted:
            // For now, let's just grab the last one which is usually the latest published.
            // A more robust approach would use semver, but beta versions are tricky.
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        return betaVersions[betaVersions.length - 1]; // Return the absolute latest
    } catch {
        return undefined;
    }
}

async function autoAlignDependencies() {
    console.log(`🌐 Synchronizing Minecraft Ecosystem Engine configurations to match the absolute latest beta versions...`);

    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    let changesMade = false;

    for (const pkg of targetPackages) {
        try {
            const matchedVersion = await getLatestBetaVersion(pkg);

            if (matchedVersion) {
                const currentVersion = packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg];

                if (currentVersion !== matchedVersion) {
                    if (packageJson.dependencies?.[pkg]) {
                        packageJson.dependencies[pkg] = matchedVersion;
                    } else {
                        packageJson.devDependencies[pkg] = matchedVersion;
                    }

                    // Also update overrides if it exists there
                    if (packageJson.overrides && packageJson.overrides[pkg]) {
                        packageJson.overrides[pkg] = matchedVersion;
                    }

                    console.log(`🎯 Version Resolved: ${pkg} -> ${matchedVersion}`);
                    changesMade = true;
                }
            }
        } catch {
            console.error(`❌ Error evaluating version matrix for package: ${pkg}`);
        }
    }

    if (changesMade) {
        writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4), 'utf8');
        console.log('📝 package.json updated successfully with modern target structures.');
    } else {
        console.log('✅ Local dependencies match your target version context.');
    }
}

autoAlignDependencies().catch(console.error);
