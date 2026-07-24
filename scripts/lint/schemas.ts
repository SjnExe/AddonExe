import Ajv from 'ajv';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

async function main() {
    console.log('[Validator] Starting programmatic JSON schema validation...');

    const ajv = new Ajv({ strict: false, allErrors: true });

    // 1. Resolve Bedrock Schemas package root & catalog.json dynamically
    const schemasDir = path.dirname(require.resolve('@minecraft/bedrock-schemas/package.json'));
    const catalogPath = path.join(schemasDir, 'catalog.json');

    let catalog: any;
    try {
        const catalogContent = await fs.readFile(catalogPath, 'utf-8');
        catalog = JSON.parse(catalogContent);
    } catch (e: any) {
        console.error(`[Validator] Could not read catalog.json: ${e.message}`);
        process.exit(1);
    }

    const schemas = catalog.schemas || [];
    const validators = new Map<string, any>();

    console.log(`[Validator] Loaded ${schemas.length} schemas from @minecraft/bedrock-schemas.`);

    for (const schemaDef of schemas) {
        if (!schemaDef.url || !schemaDef.fileMatch) continue;

        try {
            const relativeSchemaPath = schemaDef.url.replace(/^.*schemas\//, '');
            const absolutePath = path.resolve(schemasDir, relativeSchemaPath);

            const schemaContent = await fs.readFile(absolutePath, 'utf-8');
            const schemaJson = JSON.parse(schemaContent);
            const validate = ajv.compile(schemaJson);

            for (const matchPattern of schemaDef.fileMatch) {
                const regexStr = matchPattern.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
                validators.set(`^.*${regexStr}$`, validate);
            }
        } catch {
            // Ignore partial compilation errors
        }
    }

    // 2. Validate files in root packs/
    const projectRoot = process.cwd();
    const packsDir = path.join(projectRoot, 'packs');
    let totalValidated = 0;
    let errors = 0;

    async function walkAndValidate(dir: string) {
        let entries;
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walkAndValidate(fullPath);
            } else if (entry.isFile() && fullPath.endsWith('.json')) {
                const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');

                let validateFn = null;
                for (const [regexStr, fn] of validators.entries()) {
                    if (new RegExp(regexStr).test(relativePath)) {
                        validateFn = fn;
                        break;
                    }
                }

                if (validateFn) {
                    try {
                        const content = await fs.readFile(fullPath, 'utf-8');
                        const json = JSON.parse(content);
                        const valid = validateFn(json);

                        if (!valid) {
                            console.error(`[Validator] Schema error in ${relativePath}:`);
                            for (const err of validateFn.errors || []) {
                                console.error(`  - ${err.instancePath} ${err.message}`);
                            }
                            errors++;
                        }
                        totalValidated++;
                    } catch (e: any) {
                        console.error(`[Validator] Failed to read/parse ${relativePath}: ${e.message}`);
                        errors++;
                    }
                }
            }
        }
    }

    await walkAndValidate(packsDir);

    console.log(`[Validator] Validated ${totalValidated} JSON files.`);
    if (errors > 0) {
        console.error(`[Validator] Found ${errors} schema validation errors.`);
        process.exit(1);
    } else {
        console.log(`[Validator] All JSON files passed schema validation.`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
