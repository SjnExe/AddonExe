import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const MC_VERSION = '1.26.32';
const TARGET_SUFFIX = `-beta.${MC_VERSION}-stable`;

const targetPackages = ['@minecraft/debug-utilities', '@minecraft/server', '@minecraft/server-gametest', '@minecraft/server-ui', '@minecraft/server-net', '@minecraft/server-admin'];

async function autoAlignDependencies() {
    console.log(`🌐 Synchronizing Minecraft Ecosystem Engine configurations to match version: v${MC_VERSION}...`);

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
            const matchedVersion = versions.find((v) => v.includes(TARGET_SUFFIX));

            if (matchedVersion) {
                const currentVersion = packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg];

                if (currentVersion !== matchedVersion) {
                    if (packageJson.dependencies?.[pkg]) {
                        packageJson.dependencies[pkg] = matchedVersion;
                    } else {
                        packageJson.devDependencies[pkg] = matchedVersion;
                    }
                    console.log(`🎯 Version Mismatch Resolved: ${pkg} -> ${matchedVersion}`);
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
