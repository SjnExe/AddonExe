import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MinecraftBlockTypes, MinecraftEntityTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';
import Ajv from 'ajv';

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

const VANILLA_ITEMS = new Set<string>(Object.values(MinecraftItemTypes));
const VANILLA_BLOCKS = new Set<string>(Object.values(MinecraftBlockTypes));
const VANILLA_ENTITIES = new Set<string>(Object.values(MinecraftEntityTypes));

interface PackRegistry {
    items: Set<string>;
    entities: Set<string>;
    clientEntities: Set<string>;
    geometries: Set<string>;
    renderControllers: Set<string>;
}

function isKnownItemOrBlockId(id: string, packRegistry: PackRegistry): boolean {
    const cleanId = id.split(':')[0] === id ? `minecraft:${id}` : id;
    return VANILLA_ITEMS.has(cleanId) || VANILLA_BLOCKS.has(cleanId) || packRegistry.items.has(cleanId);
}

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

    const parsedFiles = new Map<string, any>();
    const packRegistry: PackRegistry = {
        items: new Set<string>(),
        entities: new Set<string>(),
        clientEntities: new Set<string>(),
        geometries: new Set<string>(),
        renderControllers: new Set<string>()
    };

    let totalValidated = 0;
    let errors = 0;

    for (const fullPath of jsonFiles) {
        const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');

        try {
            const file = Bun.file(fullPath);
            const bomBytes = await file.slice(0, 3).bytes();
            if (bomBytes.length >= 3 && bomBytes[0] === 0xef && bomBytes[1] === 0xbb && bomBytes[2] === 0xbf) {
                console.error(`[Validator] UTF-8 BOM detected in ${relativePath} (will crash Bedrock parser).`);
                errors++;
            }
            const json = await file.json();
            parsedFiles.set(relativePath, json);

            if (relativePath.startsWith('packs/behavior/items/')) {
                const id = json?.['minecraft:item']?.description?.identifier;
                if (typeof id === 'string') {
                    packRegistry.items.add(id);
                }
            } else if (relativePath.startsWith('packs/behavior/entities/')) {
                const id = json?.['minecraft:entity']?.description?.identifier;
                if (typeof id === 'string') {
                    packRegistry.entities.add(id);
                }
            } else if (relativePath.startsWith('packs/resource/entity/')) {
                const id = json?.['minecraft:client_entity']?.description?.identifier;
                if (typeof id === 'string') {
                    packRegistry.clientEntities.add(id);
                }
            } else if (relativePath.startsWith('packs/resource/models/')) {
                const geos = json?.['minecraft:geometry'];
                if (Array.isArray(geos)) {
                    for (const g of geos) {
                        if (typeof g?.description?.identifier === 'string') {
                            packRegistry.geometries.add(g.description.identifier);
                        }
                    }
                }
            } else if (relativePath.startsWith('packs/resource/render_controllers/')) {
                const rcs = json?.render_controllers;
                if (rcs && typeof rcs === 'object') {
                    for (const rcId of Object.keys(rcs)) {
                        packRegistry.renderControllers.add(rcId);
                    }
                }
            }
        } catch (e: any) {
            console.error(`[Validator] Strict JSON syntax error in ${relativePath}: ${e.message}`);
            errors++;
        }
    }

    for (const [relativePath, json] of parsedFiles.entries()) {
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
                        console.error(`  - ${err.instancePath} ${err.message}`);
                    }
                    errors++;
                }
            } catch {
                // Ignore unsupported draft features in unused sub-schemas
            }
        }

        const logicErrors = await validatePackLogic(projectRoot, relativePath, json, validTextures, packRegistry);
        if (logicErrors.length > 0) {
            console.error(`[Validator] Logic error in ${relativePath}:`);
            for (const err of logicErrors) {
                console.error(`  - ${err}`);
            }
            errors++;
        }

        totalValidated++;
    }

    const crossErrors = await validateCrossFileConsistency(projectRoot, parsedFiles);
    if (crossErrors.length > 0) {
        console.error('[Validator] Cross-file consistency error(s):');
        for (const err of crossErrors) {
            console.error(`  - ${err}`);
        }
        errors += crossErrors.length;
    }

    console.log(`[Validator] Validated ${totalValidated} JSON files.`);
    if (errors > 0) {
        console.error(`[Validator] Found ${errors} validation error(s).`);
        process.exit(1);
    } else {
        console.log('[Validator] All JSON and JSON UI files passed strict schema & logic validation.');
    }
}

async function validatePackLogic(projectRoot: string, relativePath: string, json: any, validTextures: Set<string>, packRegistry: PackRegistry): Promise<string[]> {
    const logicErrors: string[] = [];

    if (relativePath.includes('/ui/')) {
        const uiErrors = await validateUiJson(projectRoot, relativePath, json, validTextures);
        logicErrors.push(...uiErrors);
        return logicErrors;
    }

    if (relativePath.startsWith('packs/behavior/entities/') || relativePath.startsWith('packs/behavior/items/') || relativePath.startsWith('packs/behavior/recipes/')) {
        if (typeof json.format_version !== 'string') {
            logicErrors.push('Missing format_version string.');
        }
    }

    if (relativePath.startsWith('packs/behavior/entities/')) {
        const entityObj = json?.['minecraft:entity'];
        if (!entityObj) {
            logicErrors.push('Missing root "minecraft:entity" object.');
            return logicErrors;
        }
        const id = entityObj?.description?.identifier;
        if (typeof id === 'string' && id.startsWith('minecraft:') && !VANILLA_ENTITIES.has(id)) {
            logicErrors.push(`Unknown vanilla entity identifier '${id}' (not in MinecraftEntityTypes).`);
        }

        const groups = new Set(Object.keys(entityObj.component_groups || {}));
        const events = new Set(Object.keys(entityObj.events || {}));

        for (const [eventName, eventDef] of Object.entries<any>(entityObj.events || {})) {
            for (const actionKey of ['add', 'remove'] as const) {
                const groupList = eventDef?.[actionKey]?.component_groups;
                if (Array.isArray(groupList)) {
                    for (const grp of groupList) {
                        if (!groups.has(grp)) {
                            logicErrors.push(`Event '${eventName}' (${actionKey}) references undefined component_group '${grp}'.`);
                        }
                    }
                }
            }
        }

        function checkEventTriggers(pathStr: string, node: any) {
            if (!node || typeof node !== 'object') {
                return;
            }
            if (typeof node.event === 'string' && node.target !== 'other' && !events.has(node.event)) {
                logicErrors.push(`${pathStr} triggers undefined event '${node.event}'.`);
            }
            for (const [k, v] of Object.entries(node)) {
                if (v && typeof v === 'object') {
                    checkEventTriggers(`${pathStr}.${k}`, v);
                }
            }
        }

        checkEventTriggers('components', entityObj.components);
        checkEventTriggers('component_groups', entityObj.component_groups);
    }

    if (relativePath.startsWith('packs/behavior/recipes/')) {
        const recipe = json?.['minecraft:recipe_shapeless'] || json?.['minecraft:recipe_shaped'];
        if (!recipe) {
            logicErrors.push('Recipe must contain "minecraft:recipe_shapeless" or "minecraft:recipe_shaped".');
            return logicErrors;
        }

        const checkItemRef = (ctx: string, itemId: unknown) => {
            if (typeof itemId === 'string' && !isKnownItemOrBlockId(itemId, packRegistry)) {
                logicErrors.push(`${ctx} references unknown item '${itemId}' (not in @minecraft/vanilla-data or pack items).`);
            }
        };

        if (Array.isArray(recipe.ingredients)) {
            for (const ing of recipe.ingredients) {
                checkItemRef('ingredients', typeof ing === 'string' ? ing : ing?.item);
            }
        }
        if (recipe.key && typeof recipe.key === 'object') {
            for (const [k, val] of Object.entries<any>(recipe.key)) {
                checkItemRef(`key[${k}]`, val?.item);
            }
        }
        if (Array.isArray(recipe.unlock)) {
            for (const u of recipe.unlock) {
                checkItemRef('unlock', u?.item);
            }
        }
        if (Array.isArray(recipe.result)) {
            for (const r of recipe.result) {
                checkItemRef('result', r?.item);
            }
        } else if (recipe.result) {
            checkItemRef('result', recipe.result.item);
        }
    }

    if (relativePath.startsWith('packs/behavior/item_catalog/')) {
        const categories = json?.['minecraft:crafting_items_catalog']?.categories;
        if (Array.isArray(categories)) {
            for (const cat of categories) {
                for (const grp of cat?.groups || []) {
                    for (const itemId of grp?.items || []) {
                        if (typeof itemId === 'string' && !isKnownItemOrBlockId(itemId, packRegistry)) {
                            logicErrors.push(`Crafting catalog references unknown item '${itemId}'.`);
                        }
                    }
                }
            }
        }
    }

    if (relativePath.startsWith('packs/resource/entity/')) {
        const desc = json?.['minecraft:client_entity']?.description;
        if (desc) {
            for (const geoId of Object.values<any>(desc.geometry || {})) {
                if (typeof geoId === 'string' && geoId.startsWith('geometry.') && !packRegistry.geometries.has(geoId)) {
                    logicErrors.push(`Client entity references missing geometry '${geoId}'.`);
                }
            }
            for (const rcEntry of desc.render_controllers || []) {
                const rcId = typeof rcEntry === 'string' ? rcEntry : Object.keys(rcEntry || {})[0];
                if (typeof rcId === 'string' && rcId.startsWith('controller.render.') && !packRegistry.renderControllers.has(rcId)) {
                    logicErrors.push(`Client entity references missing render_controller '${rcId}'.`);
                }
            }
        }
    }

    return logicErrors;
}

function validateViewExpressionLogic(expr: string, availableBindings: Set<string>): string[] {
    const errs: string[] = [];
    const trimmed = expr.trim();

    if (trimmed.startsWith('#') || trimmed.startsWith('$')) {
        if (trimmed.startsWith('#') && !availableBindings.has(trimmed)) {
            errs.push(`View expression references unbound property '${trimmed}' (missing from control 'bindings' array).`);
        }
        return errs;
    }

    let depth = 0;
    let inSingleQuote = false;
    let closedBeforeEnd = false;

    for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i]!;
        if (ch === "'") {
            inSingleQuote = !inSingleQuote;
            continue;
        }
        if (inSingleQuote) {
            continue;
        }
        if (ch === '(') {
            depth++;
        } else if (ch === ')') {
            depth--;
            if (depth < 0) {
                errs.push(`Unbalanced closing parenthesis ')' in view expression: ${trimmed}`);
                return errs;
            }
            if (depth === 0 && i < trimmed.length - 1) {
                closedBeforeEnd = true;
            }
        }
    }

    if (inSingleQuote) {
        errs.push(`Unclosed single quote in view expression: ${trimmed}`);
    }
    if (!trimmed.startsWith('(') || !trimmed.endsWith(')') || depth !== 0 || closedBeforeEnd) {
        errs.push(`View binding source_property_name must be wrapped in a single outer pair of parentheses: ${trimmed}`);
    }

    const withoutStrings = trimmed.replace(/'[^']*'/g, "''");
    if (withoutStrings.includes('==') || withoutStrings.includes('!=') || withoutStrings.includes('&&') || withoutStrings.includes('||')) {
        errs.push(`Invalid C-style operator in Bedrock UI expression (use '=', 'not', 'and', 'or'): ${trimmed}`);
    }

    const propMatches = withoutStrings.matchAll(/#[a-zA-Z0-9_]+/g);
    for (const m of propMatches) {
        const propName = m[0]!;
        if (!availableBindings.has(propName)) {
            errs.push(`View expression uses '${propName}', but '${propName}' is not declared in this control's 'bindings' array.`);
        }
    }

    return errs;
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

    const namespace = json.namespace;
    if (typeof namespace !== 'string' || namespace.trim().length === 0) {
        uiErrors.push('UI file must declare a non-empty "namespace" string.');
        return uiErrors;
    }

    const topLevelControls = new Set<string>();
    for (const key of Object.keys(json)) {
        if (key !== 'namespace') {
            topLevelControls.add(key.split('@')[0]!);
        }
    }

    function checkLocalTargetRef(ctx: string, ref: unknown) {
        if (typeof ref !== 'string') {
            return;
        }
        const cleanRef = ref.startsWith('@') ? ref.slice(1) : ref;
        if (cleanRef.startsWith(`${namespace}.`)) {
            const targetName = cleanRef.slice(namespace.length + 1);
            if (!topLevelControls.has(targetName)) {
                uiErrors.push(`${ctx}: References non-existent local control '${ref}' in namespace '${namespace}'.`);
            }
        }
    }

    function checkControl(keyPath: string, obj: any) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
            return;
        }

        if (typeof obj.type === 'string' && !VALID_UI_TYPES.has(obj.type)) {
            uiErrors.push(`${keyPath}: Unknown UI control type '${obj.type}'.`);
        }

        if (obj.type === 'grid') {
            if ('orientation' in obj) {
                uiErrors.push(`${keyPath}: Control of type 'grid' cannot have 'orientation' property.`);
            }
            if (typeof obj.grid_item_template === 'string') {
                checkLocalTargetRef(`${keyPath}.grid_item_template`, obj.grid_item_template);
            }
            if (typeof obj.maximum_grid_items === 'number' && obj.maximum_grid_items <= 0) {
                uiErrors.push(`${keyPath}: 'maximum_grid_items' must be greater than 0.`);
            }
        }

        if (obj.factory && typeof obj.factory === 'object') {
            if (obj.factory.control_name) {
                checkLocalTargetRef(`${keyPath}.factory.control_name`, obj.factory.control_name);
            }
            if (obj.factory.control_ids && typeof obj.factory.control_ids === 'object') {
                for (const [cid, target] of Object.entries(obj.factory.control_ids)) {
                    checkLocalTargetRef(`${keyPath}.factory.control_ids.${cid}`, target);
                }
            }
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
                    uiErrors.push(`${keyPath}.controls: Control entry must have exactly 1 key (found ${keys.length}).`);
                    continue;
                }
                const rawKey = keys[0]!;
                const [controlId, superRef] = rawKey.split('@');
                if (superRef) {
                    checkLocalTargetRef(`${keyPath}.controls.${rawKey}`, superRef);
                }
                if (seenNames.has(controlId!)) {
                    uiErrors.push(`${keyPath}.controls: Duplicate sibling control name '${controlId}' (causes Bedrock UI crash).`);
                }
                seenNames.add(controlId!);
            }
        }

        if (Array.isArray(obj.bindings)) {
            const declaredBindings = new Set<string>();
            for (const b of obj.bindings) {
                if (!b || typeof b !== 'object') {
                    continue;
                }
                if (typeof b.binding_name === 'string') {
                    declaredBindings.add(b.binding_name);
                }
                if (typeof b.binding_name_override === 'string') {
                    declaredBindings.add(b.binding_name_override);
                }
            }

            for (const b of obj.bindings) {
                if (!b || typeof b !== 'object') {
                    continue;
                }
                if ((b.binding_type === 'collection' || b.binding_type === 'collection_details') && !b.binding_collection_name) {
                    uiErrors.push(`${keyPath}: Binding of type '${b.binding_type}' is missing 'binding_collection_name'.`);
                }
                if (b.binding_type === 'view') {
                    if (!b.target_property_name) {
                        uiErrors.push(`${keyPath}: View binding is missing 'target_property_name'.`);
                    }
                    if (typeof b.source_property_name === 'string') {
                        const exprErrors = validateViewExpressionLogic(b.source_property_name, declaredBindings);
                        for (const e of exprErrors) {
                            uiErrors.push(`${keyPath}: ${e}`);
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
            if (key.includes('@')) {
                checkLocalTargetRef(`${keyPath}.${key}`, key.split('@')[1]);
            }
            if (val && typeof val === 'object') {
                checkControl(`${keyPath}.${key}`, val);
            }
        }
    }

    checkControl(relativePath, json);
    return uiErrors;
}

async function validateCrossFileConsistency(projectRoot: string, parsedFiles: Map<string, any>): Promise<string[]> {
    const errs: string[] = [];

    const bpM = parsedFiles.get('packs/behavior/manifest.json');
    const rpM = parsedFiles.get('packs/resource/manifest.json');
    if (bpM && rpM) {
        const bpUuid = bpM?.header?.uuid;
        const rpUuid = rpM?.header?.uuid;
        if (!bpUuid || !rpUuid || bpUuid === rpUuid) {
            errs.push('Invalid or duplicate UUIDs between BP and RP manifest.json.');
        }
    }

    const serverForm = parsedFiles.get('packs/resource/ui/server_form.json');
    const builderFile = Bun.file(path.join(projectRoot, 'src/core/ui/builders/actionFormBuilder.ts'));
    if (serverForm && (await builderFile.exists())) {
        const serverFormStr = JSON.stringify(serverForm);
        const builderText = await builderFile.text();
        const staticTagMatches = builderText.matchAll(/form\.title\(`([^$\x60]+)\$\{this\.rawTitle\}`\)/g);
        for (const match of staticTagMatches) {
            const rawPrefix = match[1]!;
            const normalizedPrefix = rawPrefix.replace('\\uE100§r', '\uE100');
            if (!serverFormStr.includes(normalizedPrefix)) {
                errs.push(`ActionFormBuilder title prefix '${rawPrefix}' has no matching visibility binding in server_form.json.`);
            }
        }
    }

    return errs;
}

if (import.meta.main) {
    validateSchemas().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
