import Ajv from 'ajv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    console.log('[Validator] Starting programmatic JSON schema validation...');

    const ajv = new Ajv({ strict: false, allErrors: true });

    // 1. Load Schemas
    const schemasDir = path.resolve(__dirname, '../node_modules/@minecraft/bedrock-schemas/schemas');
    const catalogPath = path.resolve(__dirname, '../node_modules/@minecraft/bedrock-schemas/catalog.json');

    let catalog: any;
    try {
        const catalogContent = await fs.readFile(catalogPath, 'utf-8');
        catalog = JSON.parse(catalogContent);
    } catch (e: any) {
        console.error(`[Validator] Could not read catalog.json: ${e.message}`);
        process.exit(1);
    }

    const schemas = catalog.schemas || [];
    const validators = new Map<string, any>(); // Regex path match to compiled validator

    console.log(`[Validator] Loaded ${schemas.length} schemas from @minecraft/bedrock-schemas.`);

    for (const schemaDef of schemas) {
        if (!schemaDef.url || !schemaDef.fileMatch) continue;

        try {
            // URL looks like "file:///home/user/.../schemas/xyz.json", we only need the "schemas/xyz.json" part
            // Or it could be a relative path, but typically bedrock-schemas gives URL or a relative path
            const relativeSchemaPath = schemaDef.url.replace(/^.*schemas\//, '');
            const absolutePath = path.resolve(schemasDir, relativeSchemaPath);

            const schemaContent = await fs.readFile(absolutePath, 'utf-8');
            const schemaJson = JSON.parse(schemaContent);
            const validate = ajv.compile(schemaJson);

            // fileMatch is usually an array of glob strings like: ["*.json", "data/**/*.json"]
            // For simplicity, we create regex from them
            for (const matchPattern of schemaDef.fileMatch) {
                // Convert basic glob to regex (very simple, assumes **/ and *.json)
                const regexStr = matchPattern.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
                validators.set(`^.*${regexStr}$`, validate);
            }
        } catch {
            // Some schemas might fail to compile or read, skip them
        }
    }

    // 2. Validate Files
    const packsDir = path.resolve(__dirname, '../packs');
    let totalValidated = 0;
    let errors = 0;

    async function walkAndValidate(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walkAndValidate(fullPath);
            } else if (entry.isFile() && fullPath.endsWith('.json')) {
                const relativePath = path.relative(path.resolve(__dirname, '..'), fullPath).replace(/\\/g, '/');

                // Find matching validator
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
