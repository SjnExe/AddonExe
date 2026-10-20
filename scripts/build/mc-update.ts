import path from 'node:path';

const targetPackages = ['@minecraft/server', '@minecraft/server-ui'];

function compareVersions(v1: string, v2: string) {
    return Bun.semver.order(v1, v2);
}

async function autoAlignDependencies() {
    console.log(`🌐 Synchronizing Minecraft Ecosystem Engine configurations to match latest beta versions...`);

    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJsonFile = Bun.file(packageJsonPath);
    const packageJson = await packageJsonFile.json();
    let changesMade = false;

    for (const pkg of targetPackages) {
        try {
            const response = await fetch(`https://registry.npmjs.org/${pkg}`, {
                headers: { Accept: 'application/vnd.npm.install-v1+json' }
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
        await Bun.write(packageJsonPath, JSON.stringify(packageJson, null, 4));
        console.log('📝 package.json updated successfully with modern target structures.');
    } else {
        console.log('✅ Local dependencies match your target version context.');
    }
}

autoAlignDependencies().catch(console.error);
