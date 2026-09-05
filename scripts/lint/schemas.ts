import Ajv from 'ajv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function main() {
    console.log('[Validator] Starting programmatic JSON schema validation...');

    const ajv = new Ajv({ strict: false, allErrors: true });

    // 1. Resolve Bedrock Schemas package root & catalog.json dynamically using import.meta.resolve
    const schemasPkgResolved = import.meta.resolve('@minecraft/bedrock-schemas/package.json');
    const schemasPkgPath = fileURLToPath(schemasPkgResolved);
    const schemasDir = path.dirname(schemasPkgPath);
    const catalogPath = path.join(schemasDir, 'catalog.json');

    let catalog: any;
    try {
        catalog = await Bun.file(catalogPath).json();
    } catch (e: any) {
        console.error(`[Validator] Could not read catalog.json: ${e.message}`);
        process.exit(1);
    }

    const schemas = catalog.schemas || [];
    const validators = new Map<string, any>();

    console.log(`[Validator] Loaded ${schemas.length} schemas from @minecraft/bedrock-schemas.`);

    for (const schemaDef of schemas) {
        if (!schemaDef.url || !schemaDef.fileMatch) {
            continue;
        }

        try {
            const relativeSchemaPath = schemaDef.url.replace(/^.*schemas\//, '');
            const absolutePath = path.resolve(schemasDir, relativeSchemaPath);

            const schemaJson = await Bun.file(absolutePath).json();
            const validate = ajv.compile(schemaJson);

            for (const matchPattern of schemaDef.fileMatch) {
                const regexStr = matchPattern.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
                validators.set(`^.*${regexStr}$`, validate);
            }
        } catch {
            // Ignore partial compilation errors
        }
    }

    // 2. Validate files in root packs/ using Bun.Glob
    const projectRoot = process.cwd();
    const packsDir = path.join(projectRoot, 'packs');
    let totalValidated = 0;
    let errors = 0;

    const jsonGlob = new Bun.Glob('**/*.json');
    const jsonFiles = Array.from(jsonGlob.scanSync({ cwd: packsDir, absolute: true }));

    for (const fullPath of jsonFiles) {
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
                const json = await Bun.file(fullPath).json();
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
