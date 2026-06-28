import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FEATURES_YML = path.join(__dirname, 'features.yml');
const REGISTRY_TS = path.join(__dirname, '../src/core/featureRegistry.ts');

async function main() {
    const args = process.argv.slice(2);
    const isRelease = args.includes('--release');

    // 1. Read and parse features.yml
    const fileContent = await fs.readFile(FEATURES_YML, 'utf8');
    const data = yaml.parse(fileContent);

    // Convert object to array for easier processing, attaching the key as 'id'
    const features = Object.entries(data.features || {}).map(([id, config]) => {
        return { id, ...config };
    });

    // 2. Filter out 'dev' status features in release mode
    let enabledFeatures = features;
    if (isRelease) {
        enabledFeatures = enabledFeatures.filter((f) => f.status !== 'dev');
    }

    // Map for quick lookup
    const featureMap = new Map(enabledFeatures.map((f) => [f.id, f]));

    // 3. Validate dependencies
    for (const feature of enabledFeatures) {
        for (const dep of feature.dependencies || []) {
            if (!featureMap.has(dep)) {
                console.error(`\x1b[31m[ERROR] Feature '${feature.id}' depends on '${dep}', which is not enabled or does not exist.\x1b[0m`);
                process.exit(1);
            }
        }
    }

    // 4. Topologically sort based on dependencies
    const sortedFeatures = [];
    const visited = new Set();
    const visiting = new Set();

    function visit(featureId) {
        if (visited.has(featureId)) return;
        if (visiting.has(featureId)) {
            console.error(`\x1b[31m[ERROR] Circular dependency detected involving feature '${featureId}'.\x1b[0m`);
            process.exit(1);
        }

        visiting.add(featureId);
        const feature = featureMap.get(featureId);

        for (const dep of feature.dependencies || []) {
            visit(dep);
        }

        visiting.delete(featureId);
        visited.add(featureId);
        sortedFeatures.push(feature);
    }

    for (const feature of enabledFeatures) {
        if (!visited.has(feature.id)) {
            visit(feature.id);
        }
    }

    // 4. Generate src/core/featureRegistry.ts
    // Use dynamic imports that can be awaited to initialize each module.
    // Assuming each feature module has an `initialize(isMigration: boolean)` exported function.
    let registryTsContent = `// Auto-generated file. Do not edit directly.\n\n`;

    registryTsContent += `export interface FeatureModule {\n`;
    registryTsContent += `    initialize?: (isMigration: boolean, subfeatures?: Record<string, boolean>) => void | Promise<void>;\n`;
    registryTsContent += `}\n\n`;

    registryTsContent += `export const featureRegistry = [\n`;
    for (const feature of sortedFeatures) {
        let subfeaturesStr = 'undefined';
        if (feature.subfeatures) {
            subfeaturesStr = JSON.stringify(feature.subfeatures);
        }
        let dependenciesStr = '[]';
        if (feature.dependencies) {
            dependenciesStr = JSON.stringify(feature.dependencies);
        }
        registryTsContent += `    { id: '${feature.id}', load: () => import('@features/${feature.id}/index.js') as Promise<FeatureModule>, dependencies: ${dependenciesStr}, subfeatures: ${subfeaturesStr} },\n`;
    }
    registryTsContent += `];\n`;

    await fs.writeFile(REGISTRY_TS, registryTsContent);
    console.log(`Generated: ${REGISTRY_TS}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
