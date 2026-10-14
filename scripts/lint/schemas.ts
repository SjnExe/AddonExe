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
    const validators: { glob: Bun.Glob; validate: any }[] = [];

    console.log(`[Validator] Loaded ${schemas.length} schemas from @minecraft/bedrock-schemas.`);

    for (const schemaDef of schemas) {
        if (!schemaDef.url || !schemaDef.fileMatch) {
            continue;
        }

        try {
            const absolutePath = path.resolve(schemasDir, schemaDef.url);

            const schemaJson = await Bun.file(absolutePath).json();
            const validate = ajv.compile(schemaJson);

            for (const matchPattern of schemaDef.fileMatch) {
                validators.push({
                    glob: new Bun.Glob(matchPattern),
                    validate
                });
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
        for (const { glob, validate } of validators) {
            if (glob.match(relativePath)) {
                validateFn = validate;
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

                // Enhanced Bedrock UI validation for UI JSON files
                if (relativePath.includes('/ui/')) {
                    const uiErrors = validateUiJson(relativePath, json);
                    if (uiErrors.length > 0) {
                        console.error(`[Validator] UI structure error in ${relativePath}:`);
                        for (const err of uiErrors) {
                            console.error(`  - ${err}`);
                        }
                        errors++;
                    }
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

function validateUiJson(relativePath: string, json: any): string[] {
    const uiErrors: string[] = [];

    function checkControl(keyPath: string, obj: any) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
            return;
        }

        // Rule 1: 'grid' controls cannot have 'orientation'
        if (obj.type === 'grid' && 'orientation' in obj) {
            uiErrors.push(`${keyPath}: Control of type 'grid' cannot have 'orientation' property.`);
        }

        // Rule 2: Specific dynamic controls expected by Bedrock C++ UI engine
        if (keyPath.endsWith('long_form_dynamic_buttons_panel')) {
            if (obj.type && obj.type !== 'stack_panel' && obj.type !== 'panel') {
                uiErrors.push(`${keyPath}: 'long_form_dynamic_buttons_panel' must be of type 'stack_panel' (found '${obj.type}').`);
            }
            if (obj.factory && !obj.factory.control_ids) {
                uiErrors.push(`${keyPath}: 'long_form_dynamic_buttons_panel.factory' must specify 'control_ids' for Bedrock engine dynamic button mapping.`);
            }
        }

        // Recursively check child objects and controls
        for (const [key, val] of Object.entries(obj)) {
            if (val && typeof val === 'object') {
                checkControl(`${keyPath}.${key}`, val);
            }
        }
    }

    checkControl(relativePath, json);
    return uiErrors;
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
