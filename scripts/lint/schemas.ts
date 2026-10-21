import Ajv from 'ajv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ignoredTextures from './ignored-textures.json';

const VALID_UI_TYPES = new Set([
    'panel',
    'stack_panel',
    'grid',
    'label',
    'image',
    'button',
    'toggle',
    'slider',
    'slider_box',
    'dropdown',
    'custom',
    'factory',
    'scroll_view',
    'ScrollView',
    'input_panel',
    'edit_box',
    'screen',
    'tooltip_trigger',
    'selection_wheel',
    'tab'
]);

const VALID_ANCHORS = new Set(['top_left', 'top_middle', 'top_right', 'left_middle', 'center', 'right_middle', 'bottom_left', 'bottom_middle', 'bottom_right']);

export async function validateSchemas() {
    console.log('[Validator] Starting strict Bedrock JSON & JSON UI validation...');

    const projectRoot = process.cwd();
    const packsDir = path.join(projectRoot, 'packs');
    const jsonGlob = new Bun.Glob('**/*.json');
    const jsonFiles = Array.from(jsonGlob.scanSync({ cwd: packsDir, absolute: true }));

    const validTextures = new Set<string>(ignoredTextures);
    try {
        const cacheFile = Bun.file(path.join(projectRoot, '.cache/vanilla_textures.json'));
        if (await cacheFile.exists()) {
            const cached = (await cacheFile.json()) as string[];
            for (const t of cached) {
                validTextures.add(t);
            }
        }
    } catch {
        // Ignore if cache not yet populated
    }

    const schemasPkgResolved = import.meta.resolve('@minecraft/bedrock-schemas/package.json');
    const schemasPkgPath = fileURLToPath(schemasPkgResolved);
    const schemasDir = path.dirname(schemasPkgPath);
    const catalogPath = path.join(schemasDir, 'catalog.json');

    const catalog = await Bun.file(catalogPath).json();
    const schemas = catalog.schemas || [];
    const ajv = new Ajv({ strict: false, allErrors: true });

    const schemaEntries: { glob: Bun.Glob; url: string; compiled?: ReturnType<typeof ajv.compile> }[] = [];
    for (const schemaDef of schemas) {
        if (!schemaDef.url || !schemaDef.fileMatch) {
            continue;
        }
        for (const matchPattern of schemaDef.fileMatch) {
            schemaEntries.push({
                glob: new Bun.Glob(matchPattern),
                url: schemaDef.url
            });
        }
    }

    let totalValidated = 0;
    let errors = 0;

    for (const fullPath of jsonFiles) {
        const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');

        let rawBytes: Uint8Array;
        let rawText: string;
        let json: any;

        try {
            const file = Bun.file(fullPath);
            rawBytes = await file.bytes();
            if (rawBytes.length >= 3 && rawBytes[0] === 0xef && rawBytes[1] === 0xbb && rawBytes[2] === 0xbf) {
                console.error(`[Validator] UTF-8 BOM detected in ${relativePath} (will crash Bedrock parser).`);
                errors++;
            }
            rawText = new TextDecoder('utf-8', { fatal: true }).decode(rawBytes);
            json = JSON.parse(rawText);
        } catch (e: any) {
            console.error(`[Validator] Strict JSON syntax error in ${relativePath}:${e.message}`);
            errors++;
            continue;
        }

        const matchedEntry = schemaEntries.find((entry) => entry.glob.match(relativePath));
        if (matchedEntry) {
            try {
                if (!matchedEntry.compiled) {
                    const absolutePath = path.resolve(schemasDir, matchedEntry.url);
                    const schemaJson = await Bun.file(absolutePath).json();
                    matchedEntry.compiled = ajv.compile(schemaJson);
                }
                const valid = matchedEntry.compiled(json);
                if (!valid) {
                    console.error(`[Validator] Schema error in ${relativePath}:`);
                    for (const err of matchedEntry.compiled.errors || []) {
                        console.error(`  - ${err.instancePath}${err.message}`);
                    }
                    errors++;
                }
            } catch {
                // Ignore unsupported draft features in unused sub-schemas
            }
        }

        if (relativePath.includes('/ui/')) {
            const uiErrors = await validateUiJson(projectRoot, relativePath, json, validTextures);
            if (uiErrors.length > 0) {
                console.error(`[Validator] UI structure error in ${relativePath}:`);
                for (const err of uiErrors) {
                    console.error(`  - ${err}`);
                }
                errors++;
            }
        }

        if (relativePath.startsWith('packs/behavior/entities/') || relativePath.startsWith('packs/behavior/items/') || relativePath.startsWith('packs/behavior/recipes/')) {
            if (typeof json.format_version !== 'string') {
                console.error(`[Validator] Missing format_version string in ${relativePath}`);
                errors++;
            }
        }

        totalValidated++;
    }

    const bpManifestFile = Bun.file(path.join(packsDir, 'behavior/manifest.json'));
    const rpManifestFile = Bun.file(path.join(packsDir, 'resource/manifest.json'));
    if ((await bpManifestFile.exists()) && (await rpManifestFile.exists())) {
        try {
            const [bpM, rpM] = await Promise.all([bpManifestFile.json(), rpManifestFile.json()]);
            const bpUuid = bpM?.header?.uuid;
            const rpUuid = rpM?.header?.uuid;
            if (!bpUuid || !rpUuid || bpUuid === rpUuid) {
                console.error('[Validator] Invalid or duplicate UUIDs between BP and RP manifest.json.');
                errors++;
            }
        } catch (e: any) {
            console.error(`[Validator] Manifest cross-check failed: ${e.message}`);
            errors++;
        }
    }

    console.log(`[Validator] Validated ${totalValidated} JSON files.`);
    if (errors > 0) {
        console.error(`[Validator] Found ${errors} validation error(s).`);
        process.exit(1);
    } else {
        console.log('[Validator] All JSON and JSON UI files passed strict validation.');
    }
}

async function validateUiJson(projectRoot: string, relativePath: string, json: any, validTextures: Set<string>): Promise<string[]> {
    const uiErrors: string[] = [];

    if (relativePath.endsWith('/_ui_defs.json')) {
        if (!Array.isArray(json.ui_defs)) {
            uiErrors.push('_ui_defs.json must contain a "ui_defs" string array.');
        } else {
            for (const defPath of json.ui_defs) {
                const fullDefPath = path.join(projectRoot, 'packs/resource', defPath);
                if (!(await Bun.file(fullDefPath).exists())) {
                    uiErrors.push(`_ui_defs.json references missing UI file: ${defPath}`);
                }
            }
        }
        return uiErrors;
    }

    if (relativePath.endsWith('/loading_messages.json')) {
        if (!Array.isArray(json.values)) {
            uiErrors.push('loading_messages.json must contain a "values" array.');
        }
        return uiErrors;
    }

    if (typeof json.namespace !== 'string' || json.namespace.trim().length === 0) {
        uiErrors.push('UI file must declare a non-empty "namespace" string.');
    }

    function checkControl(keyPath: string, obj: any) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
            return;
        }

        if (typeof obj.type === 'string' && !VALID_UI_TYPES.has(obj.type)) {
            uiErrors.push(`${keyPath}: Unknown UI control type '${obj.type}'.`);
        }

        if (obj.type === 'grid' && 'orientation' in obj) {
            uiErrors.push(`${keyPath}: Control of type 'grid' cannot have 'orientation' property.`);
        }

        if ('anchor_from' in obj || 'anchor_to' in obj) {
            if (!('anchor_from' in obj) || !('anchor_to' in obj)) {
                uiErrors.push(`${keyPath}: Both 'anchor_from' and 'anchor_to' must be specified together.`);
            } else {
                if (typeof obj.anchor_from === 'string' && !obj.anchor_from.startsWith('$') && !VALID_ANCHORS.has(obj.anchor_from)) {
                    uiErrors.push(`${keyPath}: Invalid anchor_from '${obj.anchor_from}'.`);
                }
                if (typeof obj.anchor_to === 'string' && !obj.anchor_to.startsWith('$') && !VALID_ANCHORS.has(obj.anchor_to)) {
                    uiErrors.push(`${keyPath}: Invalid anchor_to '${obj.anchor_to}'.`);
                }
            }
        }

        if ('size' in obj && Array.isArray(obj.size)) {
            if (obj.size.length !== 2) {
                uiErrors.push(`${keyPath}: 'size' array must have exactly 2 elements [width, height].`);
            }
        }

        if (typeof obj.texture === 'string' && obj.texture.startsWith('textures/') && validTextures.size > 50 && !validTextures.has(obj.texture.replace(/\.png$/, ''))) {
            uiErrors.push(`${keyPath}: Invalid UI texture reference '${obj.texture}'.`);
        }

        if (Array.isArray(obj.controls)) {
            const seenNames = new Set<string>();
            for (const childEntry of obj.controls) {
                if (!childEntry || typeof childEntry !== 'object' || Array.isArray(childEntry)) {
                    uiErrors.push(`${keyPath}.controls: Every element in 'controls' must be a single-key object.`);
                    continue;
                }
                const keys = Object.keys(childEntry);
                if (keys.length !== 1) {
                    uiErrors.push(`${keyPath}.controls: Control entry must have exactly 1 key (found${keys.length}).`);
                    continue;
                }
                const rawKey = keys[0]!;
                const controlId = rawKey.split('@')[0]!;
                if (seenNames.has(controlId)) {
                    uiErrors.push(`${keyPath}.controls: Duplicate sibling control name '${controlId}' (causes Bedrock UI crash).`);
                }
                seenNames.add(controlId);
            }
        }

        if (Array.isArray(obj.bindings)) {
            for (const b of obj.bindings) {
                if (!b || typeof b !== 'object') {
                    continue;
                }
                if ((b.binding_type === 'collection' || b.binding_type === 'collection_details') && !b.binding_collection_name) {
                    uiErrors.push(`${keyPath}: Binding of type '${b.binding_type}' is missing 'binding_collection_name'.`);
                }
                if (b.binding_type === 'view' && typeof b.source_property_name === 'string') {
                    const expr = b.source_property_name.trim();
                    if (!expr.startsWith('#') && !expr.startsWith('$')) {
                        let depth = 0;
                        let closedBeforeEnd = false;
                        for (let i = 0; i < expr.length; i++) {
                            if (expr[i] === '(') {
                                depth++;
                            } else if (expr[i] === ')') {
                                depth--;
                                if (depth === 0 && i < expr.length - 1) {
                                    closedBeforeEnd = true;
                                }
                            }
                        }
                        if (!expr.startsWith('(') || !expr.endsWith(')') || depth !== 0 || closedBeforeEnd) {
                            uiErrors.push(`${keyPath}: View binding source_property_name must be wrapped in outer parentheses:${expr}`);
                        }
                    }
                }
            }
        }

        if (keyPath.endsWith('long_form_dynamic_buttons_panel')) {
            if (obj.type && obj.type !== 'stack_panel' && obj.type !== 'panel') {
                uiErrors.push(`${keyPath}: 'long_form_dynamic_buttons_panel' must be of type 'stack_panel' (found '${obj.type}').`);
            }
            if (obj.factory && !obj.factory.control_ids) {
                uiErrors.push(`${keyPath}: 'long_form_dynamic_buttons_panel.factory' must specify 'control_ids'.`);
            }
        }

        for (const [key, val] of Object.entries(obj)) {
            if (val && typeof val === 'object') {
                checkControl(`${keyPath}.${key}`, val);
            }
        }
    }

    checkControl(relativePath, json);
    return uiErrors;
}

if (import.meta.main) {
    validateSchemas().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
