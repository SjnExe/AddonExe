import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const targetPackages = ['@minecraft/debug-utilities', '@minecraft/server', '@minecraft/server-gametest', '@minecraft/server-ui'];

function compareVersions(v1: string, v2: string) {
    const regex = /^(\d+)\.(\d+)\.(\d+)-beta\.(\d+)\.(\d+)\.(\d+)-stable$/;
    const m1 = v1.match(regex);
    const m2 = v2.match(regex);
    if (!m1 || !m2) return 0;

    for (let i = 1; i <= 6; i++) {
        const n1 = parseInt(m1[i], 10);
        const n2 = parseInt(m2[i], 10);
        if (n1 !== n2) return n1 - n2;
    }
    return 0;
}

async function autoAlignDependencies() {
    console.log(`🌐 Synchronizing Minecraft Ecosystem Engine configurations to match latest beta versions...`);

    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    let changesMade = false;

    for (const pkg of targetPackages) {
        try {
            const response = await fetch(`https://registry.npmjs.org/${pkg}`, {
                headers: { Accept: 'application/vnd.npm.install-v1+json' }
            });
            if (!response.ok) continue;

            const data = await response.json();
            const versions = Object.keys(data.versions || {});

            const betaVersions = versions.filter((v) => /^(\d+)\.(\d+)\.(\d+)-beta\.(\d+)\.(\d+)\.(\d+)-stable$/.test(v));
            if (betaVersions.length === 0) continue;

            betaVersions.sort(compareVersions);
            const matchedVersion = betaVersions[betaVersions.length - 1];

            if (matchedVersion) {
                const currentVersionDeps = packageJson.dependencies?.[pkg];
                const currentVersionDevDeps = packageJson.devDependencies?.[pkg];

                if (currentVersionDeps && currentVersionDeps !== matchedVersion) {
                    packageJson.dependencies[pkg] = matchedVersion;
                    console.log(`🎯 Version Mismatch Resolved in dependencies: ${pkg} -> ${matchedVersion}`);
                    changesMade = true;
                }

                if (currentVersionDevDeps && currentVersionDevDeps !== matchedVersion) {
                    packageJson.devDependencies[pkg] = matchedVersion;
                    console.log(`🎯 Version Mismatch Resolved in devDependencies: ${pkg} -> ${matchedVersion}`);
                    changesMade = true;
                }

                // Update overrides if present
                if (packageJson.overrides?.[pkg] && packageJson.overrides[pkg] !== matchedVersion) {
                    packageJson.overrides[pkg] = matchedVersion;
                    console.log(`🎯 Version Mismatch Resolved in overrides: ${pkg} -> ${matchedVersion}`);
                    changesMade = true;
                }
            }
        } catch {
            console.error(`❌ Network timeout evaluating version matrix for package: ${pkg}`);
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
