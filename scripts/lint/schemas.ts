import path from 'node:path';

const validAnchors = new Set([
  'top_left',
  'top_middle',
  'top_right',
  'left_middle',
  'center',
  'right_middle',
  'bottom_left',
  'bottom_middle',
  'bottom_right',
]);

const validUiControlProperties = new Set([
  'type',
  'size',
  'max_size',
  'min_size',
  'offset',
  'anchor_from',
  'anchor_to',
  'layer',
  'alpha',
  'color',
  'text_color',
  'visible',
  'enabled',
  'ignored',
  'clips_children',
  'allow_clipping',
  'propagate_alpha',
  'controls',
  'bindings',
  'modifications',
  'button_mappings',
  'variables',
  'anims',
  'animation_reset_name',
  'anim_type',
  'easing',
  'duration',
  'from',
  'to',
  'next',
  'play_event',
  'end_event',
  'destroy_at_end',
  'looping',
  'fps',
  'frame_count',
  'initial_uv',
  'uv',
  'uv_size',
  'uv_anim',
  'texture',
  'nineslice_size',
  'tiled',
  'keep_ratio',
  'bilinear',
  'fill',
  'grayscale',
  'zip_folder',
  'texture_file_system',
  'text',
  'localize',
  'shadow',
  'font_size',
  'font_scale_factor',
  'font_type',
  'text_alignment',
  'line_padding',
  'locked_alpha',
  'enable_profanity_filter',
  'orientation',
  'use_child_anchors',
  'grid_item_template',
  'grid_dimensions',
  'grid_dimension_binding',
  'grid_rescaling_type',
  'maximum_grid_items',
  'fill_direction',
  'precached_grid_item_count',
  'collection_name',
  'factory',
  'control_name',
  'control_ids',
  'focus_enabled',
  'focus_wrap_enabled',
  'focus_magnet_enabled',
  'default_focus_precedence',
  'focus_identifier',
  'focus_change_down',
  'focus_change_up',
  'focus_change_left',
  'focus_change_right',
  'sound_name',
  'sound_volume',
  'sound_pitch',
  'default_control',
  'hover_control',
  'pressed_control',
  'locked_control',
  'consume_event',
  'consume_hover_events',
  'prevent_touch_input',
  'always_listen_to_input',
  'modal',
  'is_showing_menu',
  'should_steal_mouse',
  'render_only_when_topmost',
  'screen_not_flushable',
  'always_accepts_input',
  'render_game_behind',
  'absorbs_input',
  'is_modal',
  'low_frequency_rendering',
  'force_render_below',
  'load_screen_immediately',
  'send_telemetry',
  'close_on_player_hurt',
  'use_custom_pocket_toast',
  'cache_screen',
  'gamepad_cursor_deflection_mode',
  'use_anchored_offset',
  'property_bag',
  'renderer',
  'tts_name',
  'tts_control_header',
  'tts_section_header',
  'tts_value_changed',
  'tts_override_control_value',
  'tts_skip_message',
  'tts_inherit_siblings',
  'use_priority',
  'priority',
]);

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface JsonSchemaNode {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  additionalProperties?: boolean | JsonSchemaNode;
  allOf?: JsonSchemaNode[];
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  $ref?: string;
  definitions?: Record<string, JsonSchemaNode>;
  $defs?: Record<string, JsonSchemaNode>;
}

const schemaFileCache = new Map<string, JsonSchemaNode>();

function loadSchemaFile(absPath: string): JsonSchemaNode | undefined {
  const cached = schemaFileCache.get(absPath);
  if (cached) {
    return cached;
  }
  try {
    const raw = require('node:fs').readFileSync(absPath, 'utf8') as string;
    const parsed = Bun.JSON5.parse(raw) as JsonSchemaNode;
    if (parsed && typeof parsed === 'object') {
      schemaFileCache.set(absPath, parsed);
      return parsed;
    }
  } catch {
    // Ignore missing/unreadable schema file
  }
  return undefined;
}

function resolveSchemaRef(
  ref: string,
  currentFilePath: string,
  rootSchema: JsonSchemaNode,
): { node?: JsonSchemaNode; filePath: string; root: JsonSchemaNode } {
  const [filePart, pointerPart] = ref.split('#');
  let targetFile = currentFilePath;
  let targetRoot = rootSchema;

  if (filePart && filePart.length > 0) {
    targetFile = path.resolve(path.dirname(currentFilePath), filePart);
    const loaded = loadSchemaFile(targetFile);
    if (!loaded) {
      return { filePath: targetFile, root: targetRoot };
    }
    targetRoot = loaded;
  }

  if (!pointerPart || pointerPart === '' || pointerPart === '/') {
    return { node: targetRoot, filePath: targetFile, root: targetRoot };
  }

  const segments = pointerPart
    .replace(/^\//, '')
    .split('/')
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));

  let curr: unknown = targetRoot;
  for (const seg of segments) {
    if (curr && typeof curr === 'object' && seg in (curr as Record<string, unknown>)) {
      curr = (curr as Record<string, unknown>)[seg];
    } else {
      return { filePath: targetFile, root: targetRoot };
    }
  }

  return {
    node: curr && typeof curr === 'object' ? (curr as JsonSchemaNode) : undefined,
    filePath: targetFile,
    root: targetRoot,
  };
}

function collectAllowedPropertiesFromSchema(
  node: JsonSchemaNode | undefined,
  filePath: string,
  rootSchema: JsonSchemaNode,
  visited = new Set<string>(),
): { props: Set<string>; hasExplicitProps: boolean } {
  const props = new Set<string>();
  let hasExplicitProps = false;
  if (!node || typeof node !== 'object') {
    return { props, hasExplicitProps };
  }

  if (node.$ref) {
    const visitKey = `${filePath}::${node.$ref}`;
    if (!visited.has(visitKey)) {
      visited.add(visitKey);
      const resolved = resolveSchemaRef(node.$ref, filePath, rootSchema);
      if (resolved.node) {
        const sub = collectAllowedPropertiesFromSchema(resolved.node, resolved.filePath, resolved.root, visited);
        for (const p of sub.props) {
          props.add(p);
        }
        if (sub.hasExplicitProps) {
          hasExplicitProps = true;
        }
      }
    }
  }

  if (node.properties && typeof node.properties === 'object') {
    hasExplicitProps = true;
    for (const k of Object.keys(node.properties)) {
      props.add(k);
    }
  }

  for (const branchList of [node.allOf, node.anyOf, node.oneOf]) {
    if (Array.isArray(branchList)) {
      for (const b of branchList) {
        const sub = collectAllowedPropertiesFromSchema(b, filePath, rootSchema, visited);
        for (const p of sub.props) {
          props.add(p);
        }
        if (sub.hasExplicitProps) {
          hasExplicitProps = true;
        }
      }
    }
  }

  return { props, hasExplicitProps };
}

interface BedrockSchemasRegistry {
  loaded: boolean;
  entityComponents: Set<string>;
  itemComponents: Set<string>;
  recipeTypes: Set<string>;
}

let cachedBedrockSchemas: BedrockSchemasRegistry | undefined;

function loadBedrockSchemasRegistry(): BedrockSchemasRegistry {
  if (cachedBedrockSchemas) {
    return cachedBedrockSchemas;
  }
  const registry: BedrockSchemasRegistry = {
    loaded: false,
    entityComponents: new Set(),
    itemComponents: new Set(),
    recipeTypes: new Set(),
  };

  try {
    const schemasBase = path.resolve(process.cwd(), 'node_modules/@minecraft/bedrock-schemas');
    const schemaGlob = new Bun.Glob('**/*.json');
    const files = Array.from(schemaGlob.scanSync({ cwd: schemasBase, absolute: true }));
    if (files.length > 0) {
      registry.loaded = true;
      for (const file of files) {
        const node = loadSchemaFile(file);
        if (!node) {
          continue;
        }
        const collected = collectAllowedPropertiesFromSchema(node, file, node);
        for (const prop of collected.props) {
          if (prop.startsWith('minecraft:')) {
            if (file.includes('entities') || file.includes('entity')) {
              registry.entityComponents.add(prop);
            }
            if (file.includes('items') || file.includes('item')) {
              registry.itemComponents.add(prop);
            }
            if (file.includes('recipes') || file.includes('recipe')) {
              registry.recipeTypes.add(prop);
            }
          }
        }
        const raw = require('node:fs').readFileSync(file, 'utf8') as string;
        for (const m of raw.matchAll(/"(minecraft:[a-z0-9_.:-]+)"/g)) {
          const id = m[1];
          if (id) {
            if (file.includes('entity') || file.includes('entities')) {
              registry.entityComponents.add(id);
            }
            if (file.includes('item') || file.includes('items')) {
              registry.itemComponents.add(id);
            }
            if (file.includes('recipe')) {
              registry.recipeTypes.add(id);
            }
          }
        }
      }
    }
  } catch {
    // Fallback if node_modules/@minecraft/bedrock-schemas is unavailable
  }

  cachedBedrockSchemas = registry;
  return registry;
}

export function validateUiJson(relativePath: string, json: Record<string, unknown>): string[] {
  const uiErrors: string[] = [];

  if (relativePath.endsWith('_ui_defs.json')) {
    if (!Array.isArray(json.ui_defs) || !json.ui_defs.every((d) => typeof d === 'string')) {
      uiErrors.push(`${relativePath}: 'ui_defs' must be an array of string file paths.`);
    }
    return uiErrors;
  }

  if (relativePath.endsWith('loading_messages.json')) {
    const values = Object.values(json);
    if (values.length === 0 || !values.every((v) => Array.isArray(v) && v.every((d) => typeof d === 'string'))) {
      uiErrors.push(`${relativePath}: 'loading_messages.json' must contain string arrays.`);
    }
    return uiErrors;
  }

  if (typeof json.namespace !== 'string' || json.namespace.trim() === '') {
    uiErrors.push(`${relativePath}: JSON UI file must declare a valid top-level 'namespace' string.`);
  }

  const currentNamespace = typeof json.namespace === 'string' ? json.namespace : '';
  const topLevelControlNames = new Set<string>();

  for (const key of Object.keys(json)) {
    if (key !== 'namespace') {
      const baseName = key.split('@')[0]!;
      topLevelControlNames.add(baseName);
    }
  }

  const checkLocalTargetRef = (keyPath: string, targetRef: string | undefined) => {
    if (!targetRef || targetRef.startsWith('$')) {
      return;
    }
    if (targetRef.includes('.')) {
      const [ns, ctrlName] = targetRef.split('.');
      if (ns === currentNamespace && ctrlName && !topLevelControlNames.has(ctrlName)) {
        uiErrors.push(`${keyPath}: Local namespace reference '${targetRef}' does not exist in '${currentNamespace}'.`);
      }
    }
  };

  const checkControl = (keyPath: string, rawObj: unknown) => {
    if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
      return;
    }
    const obj = rawObj as Record<string, unknown>;

    if ('collection_index' in obj) {
      uiErrors.push(`${keyPath}: 'collection_index' is not a valid direct JSON UI property.`);
    }
    if ('collection_name' in obj && obj.type !== 'grid' && !obj.factory) {
      uiErrors.push(`${keyPath}: 'collection_name' is only valid on 'grid' or controls with a 'factory'.`);
    }

    if (obj.type === 'grid') {
      if (typeof obj.grid_item_template === 'string') {
        checkLocalTargetRef(`${keyPath}.grid_item_template`, obj.grid_item_template);
      }
      if (!obj.grid_dimensions && !obj.grid_rescaling_type && !obj.grid_dimension_binding) {
        uiErrors.push(
          `${keyPath}: Grid control must specify 'grid_dimensions', 'grid_rescaling_type', or 'grid_dimension_binding'.`,
        );
      }
    }

    for (const sizeProp of ['size', 'min_size', 'max_size'] as const) {
      const sVal = obj[sizeProp];
      if (Array.isArray(sVal)) {
        if (sVal.length !== 2) {
          uiErrors.push(`${keyPath}.${sizeProp}: Size array must have exactly 2 elements.`);
        } else {
          for (let idx = 0; idx < 2; idx++) {
            const dim = sVal[idx];
            if (typeof dim === 'string') {
              if (dim.startsWith('$')) {
                uiErrors.push(
                  `${keyPath}.${sizeProp}[${idx}]: Avoid scalar variable '${dim}' inside size array (causes 'Dangling number' error in Bedrock UI). Pass a 2-element size array variable to '${sizeProp}' instead.`,
                );
              } else if (
                dim !== 'default' &&
                dim !== 'fill' &&
                !dim.includes('%') &&
                !dim.includes('px') &&
                !/^-?\d+(\.\d+)?px$/.test(dim)
              ) {
                uiErrors.push(
                  `${keyPath}.${sizeProp}[${idx}]: Dangling number or invalid size expression '${dim}' (missing % or px).`,
                );
              }
            } else if (typeof dim !== 'number') {
              uiErrors.push(`${keyPath}.${sizeProp}[${idx}]: Size element must be a number or valid size string.`);
            }
          }
        }
      }
    }

    if (typeof obj.anchor_from === 'string' && !obj.anchor_from.startsWith('$') && !validAnchors.has(obj.anchor_from)) {
      uiErrors.push(`${keyPath}: Invalid 'anchor_from' value '${obj.anchor_from}'.`);
    }
    if (typeof obj.anchor_to === 'string' && !obj.anchor_to.startsWith('$') && !validAnchors.has(obj.anchor_to)) {
      uiErrors.push(`${keyPath}: Invalid 'anchor_to' value '${obj.anchor_to}'.`);
    }

    if (obj.bindings !== undefined) {
      if (!Array.isArray(obj.bindings)) {
        uiErrors.push(`${keyPath}: 'bindings' must be an array.`);
      } else {
        for (let i = 0; i < obj.bindings.length; i++) {
          const b = obj.bindings[i] as Record<string, unknown> | undefined;
          if (!b || typeof b !== 'object') {
            uiErrors.push(`${keyPath}.bindings[${i}]: Binding entry must be an object.`);
            continue;
          }
          if (b.binding_type === 'view' && !b.source_property_name && !b.source_control_name) {
            uiErrors.push(
              `${keyPath}.bindings[${i}]: 'view' binding requires 'source_property_name' or 'source_control_name'.`,
            );
          }
          if (b.binding_type === 'collection' && !b.binding_collection_name) {
            uiErrors.push(`${keyPath}.bindings[${i}]: 'collection' binding requires 'binding_collection_name'.`);
          }
        }
      }
    }

    if (obj.controls !== undefined) {
      if (!Array.isArray(obj.controls)) {
        uiErrors.push(`${keyPath}: 'controls' must be an array.`);
      } else {
        const seenNames = new Set<string>();
        for (let i = 0; i < obj.controls.length; i++) {
          const ctrlEntry = obj.controls[i] as Record<string, unknown> | undefined;
          if (!ctrlEntry || typeof ctrlEntry !== 'object' || Array.isArray(ctrlEntry)) {
            uiErrors.push(`${keyPath}.controls[${i}]: Control entry must be a single-key object.`);
            continue;
          }
          const keys = Object.keys(ctrlEntry);
          if (keys.length !== 1) {
            uiErrors.push(`${keyPath}.controls[${i}]: Control entry must have exactly 1 key (found ${keys.length}).`);
            continue;
          }
          const rawKey = keys[0]!;
          const [ctrlId, targetRef] = rawKey.split('@');
          if (ctrlId && seenNames.has(ctrlId)) {
            uiErrors.push(`${keyPath}.controls: Duplicate sibling control ID '${ctrlId}'.`);
          }
          if (ctrlId) {
            seenNames.add(ctrlId);
          }
          checkLocalTargetRef(`${keyPath}.controls[${i}].${rawKey}`, targetRef);
          checkControl(`${keyPath}.controls[${i}].${rawKey}`, ctrlEntry[rawKey]);
        }
      }
    }

    if (obj.modifications !== undefined) {
      if (!Array.isArray(obj.modifications)) {
        uiErrors.push(`${keyPath}: 'modifications' must be an array.`);
      } else {
        for (let i = 0; i < obj.modifications.length; i++) {
          const mod = obj.modifications[i] as Record<string, unknown> | undefined;
          if (!mod || typeof mod !== 'object') {
            uiErrors.push(`${keyPath}.modifications[${i}]: Modification must be an object.`);
            continue;
          }
          if (typeof mod.array_name !== 'string' || typeof mod.operation !== 'string') {
            uiErrors.push(`${keyPath}.modifications[${i}]: Modification requires 'array_name' and 'operation'.`);
          }
          if (Array.isArray(mod.value)) {
            for (let j = 0; j < mod.value.length; j++) {
              const vEntry = mod.value[j] as Record<string, unknown> | undefined;
              if (vEntry && typeof vEntry === 'object') {
                for (const [vKey, vVal] of Object.entries(vEntry)) {
                  checkLocalTargetRef(`${keyPath}.modifications[${i}].value[${j}].${vKey}`, vKey.split('@')[1]);
                  checkControl(`${keyPath}.modifications[${i}].value[${j}].${vKey}`, vVal);
                }
              }
            }
          }
        }
      }
    }

    const lastSegment = keyPath.split('.').pop() ?? '';
    const isControlDef =
      keyPath !== relativePath &&
      !lastSegment.startsWith('$') &&
      !keyPath.endsWith('.controls') &&
      !keyPath.endsWith('.factory') &&
      !keyPath.endsWith('.control_ids') &&
      !keyPath.endsWith('.property_bag') &&
      !keyPath.endsWith('.uv_anim');

    for (const [key, val] of Object.entries(obj)) {
      if (key === 'controls' || key === 'modifications' || key === 'bindings') {
        continue;
      }
      if (key.includes('@')) {
        checkLocalTargetRef(`${keyPath}.${key}`, key.split('@')[1]);
      } else if (
        isControlDef &&
        !key.startsWith('$') &&
        !key.startsWith('#') &&
        !key.includes('/') &&
        !validUiControlProperties.has(key)
      ) {
        uiErrors.push(`${keyPath}: Unknown JSON UI control property '${key}'.`);
      }
      if (val && typeof val === 'object') {
        checkControl(`${keyPath}.${key}`, val);
      }
    }
  };

  for (const [topKey, topVal] of Object.entries(json)) {
    if (topKey === 'namespace') {
      continue;
    }
    checkLocalTargetRef(`${relativePath}.${topKey}`, topKey.split('@')[1]);
    checkControl(`${relativePath}.${topKey}`, topVal);
  }

  return uiErrors;
}

export function validateLangFile(relativePath: string, rawText: string): { errors: string[]; keys: Set<string> } {
  const errors: string[] = [];
  const keys = new Set<string>();
  const lines = rawText.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) {
      errors.push(`${relativePath}:${i + 1}: Invalid .lang entry (missing '=' separator).`);
      continue;
    }
    const key = line.slice(0, eqIdx).trim();
    if (!/^[a-zA-Z0-9_.:-]+$/.test(key)) {
      errors.push(`${relativePath}:${i + 1}: Invalid translation key '${key}'.`);
    }
    if (keys.has(key)) {
      errors.push(`${relativePath}:${i + 1}: Duplicate translation key '${key}'.`);
    }
    keys.add(key);
  }

  return { errors, keys };
}

export function validateContentJson(relativePath: string, json: Record<string, unknown>): string[] {
  const contentErrors: string[] = [];
  const bedrockSchemas = loadBedrockSchemasRegistry();

  if (relativePath.endsWith('texts/languages.json')) {
    if (
      !Array.isArray(json) ||
      json.length === 0 ||
      !json.every((l) => typeof l === 'string' && /^[a-z]{2}_[A-Z]{2}$/.test(l))
    ) {
      contentErrors.push(`${relativePath}: 'languages.json' must be a non-empty array of locale codes (e.g. "en_US").`);
    }
    return contentErrors;
  }

  if (relativePath.endsWith('manifest.json')) {
    const header = json.header as Record<string, unknown> | undefined;
    const modules = json.modules as Record<string, unknown>[] | undefined;
    if (
      typeof json.format_version !== 'number' ||
      !header ||
      typeof header.name !== 'string' ||
      typeof header.uuid !== 'string' ||
      !uuidRegex.test(header.uuid) ||
      !Array.isArray(modules) ||
      modules.length === 0
    ) {
      contentErrors.push(`${relativePath}: Invalid manifest structure or UUID.`);
    }
    return contentErrors;
  }

  if (relativePath.startsWith('packs/behavior/entities/')) {
    const entity = json['minecraft:entity'] as Record<string, unknown> | undefined;
    const desc = entity?.description as Record<string, unknown> | undefined;
    if (typeof json.format_version !== 'string' || !entity || typeof desc?.identifier !== 'string') {
      contentErrors.push(
        `${relativePath}: Behavior entity requires 'format_version' and 'minecraft:entity.description.identifier'.`,
      );
      return contentErrors;
    }
    const checkTimerComponent = (container: Record<string, unknown> | undefined, pathLabel: string) => {
      const timer = container?.['minecraft:timer'] as Record<string, unknown> | undefined;
      if (!timer || timer.time === undefined) {
        return;
      }
      if (typeof timer.time === 'object' && timer.time !== null && !Array.isArray(timer.time)) {
        const timeObj = timer.time as Record<string, unknown>;
        if (typeof timeObj.range_min !== 'number' || typeof timeObj.range_max !== 'number') {
          contentErrors.push(
            `${relativePath} (${pathLabel}): 'minecraft:timer.time' object must specify numeric 'range_min' and 'range_max'.`,
          );
        }
      }
    };
    if (
      bedrockSchemas.loaded &&
      bedrockSchemas.entityComponents.size > 0 &&
      entity.components &&
      typeof entity.components === 'object'
    ) {
      for (const compKey of Object.keys(entity.components as Record<string, unknown>)) {
        if (compKey.startsWith('minecraft:') && !bedrockSchemas.entityComponents.has(compKey)) {
          contentErrors.push(`${relativePath}: Unknown @minecraft/bedrock-schemas entity component '${compKey}'.`);
        }
      }
    }
    checkTimerComponent(entity.components as Record<string, unknown> | undefined, 'components');
    const groups = entity.component_groups as Record<string, Record<string, unknown>> | undefined;
    if (groups && typeof groups === 'object') {
      for (const [gName, gVal] of Object.entries(groups)) {
        checkTimerComponent(gVal, `component_groups.${gName}`);
      }
    }
    return contentErrors;
  }

  if (relativePath.startsWith('packs/behavior/items/')) {
    const item = json['minecraft:item'] as Record<string, unknown> | undefined;
    const desc = item?.description as Record<string, unknown> | undefined;
    if (typeof json.format_version !== 'string' || !item || typeof desc?.identifier !== 'string') {
      contentErrors.push(
        `${relativePath}: Behavior item requires 'format_version' and 'minecraft:item.description.identifier'.`,
      );
      return contentErrors;
    }
    if (
      bedrockSchemas.loaded &&
      bedrockSchemas.itemComponents.size > 0 &&
      item.components &&
      typeof item.components === 'object'
    ) {
      for (const compKey of Object.keys(item.components as Record<string, unknown>)) {
        if (compKey.startsWith('minecraft:') && !bedrockSchemas.itemComponents.has(compKey)) {
          contentErrors.push(`${relativePath}: Unknown @minecraft/bedrock-schemas item component '${compKey}'.`);
        }
      }
    }
    return contentErrors;
  }

  if (relativePath.startsWith('packs/behavior/recipes/')) {
    const recipeObj = (json['minecraft:recipe_shaped'] ??
      json['minecraft:recipe_shapeless'] ??
      json['minecraft:recipe_furnace'] ??
      json['minecraft:recipe_brewing_mix'] ??
      json['minecraft:recipe_brewing_container'] ??
      json['minecraft:recipe_smithing_transform']) as Record<string, unknown> | undefined;
    const desc = recipeObj?.description as Record<string, unknown> | undefined;
    if (typeof json.format_version !== 'string' || !recipeObj || typeof desc?.identifier !== 'string') {
      contentErrors.push(
        `${relativePath}: Recipe requires 'format_version' and a valid 'minecraft:recipe_*' block with 'description.identifier'.`,
      );
    }
    return contentErrors;
  }

  if (relativePath.startsWith('packs/behavior/loot_tables/')) {
    if (!Array.isArray(json.pools)) {
      contentErrors.push(`${relativePath}: Loot table requires a 'pools' array.`);
    }
    return contentErrors;
  }

  if (relativePath.startsWith('packs/behavior/item_catalog/')) {
    const catalog = json['minecraft:crafting_items_catalog'] as Record<string, unknown> | undefined;
    if (typeof json.format_version !== 'string' || !catalog || !Array.isArray(catalog.categories)) {
      contentErrors.push(
        `${relativePath}: Item catalog requires 'format_version' and 'minecraft:crafting_items_catalog.categories'.`,
      );
    }
    return contentErrors;
  }

  if (relativePath.startsWith('packs/resource/entity/')) {
    const clientEntity = json['minecraft:client_entity'] as Record<string, unknown> | undefined;
    const desc = clientEntity?.description as Record<string, unknown> | undefined;
    if (typeof json.format_version !== 'string' || !clientEntity || typeof desc?.identifier !== 'string') {
      contentErrors.push(
        `${relativePath}: Client entity requires 'format_version' and 'minecraft:client_entity.description.identifier'.`,
      );
    }
    return contentErrors;
  }

  if (relativePath.startsWith('packs/resource/models/')) {
    if (typeof json.format_version !== 'string' || !Array.isArray(json['minecraft:geometry'])) {
      contentErrors.push(`${relativePath}: Geometry file requires 'format_version' and 'minecraft:geometry' array.`);
    }
    return contentErrors;
  }

  if (relativePath.startsWith('packs/resource/render_controllers/')) {
    if (
      typeof json.format_version !== 'string' ||
      !json.render_controllers ||
      typeof json.render_controllers !== 'object'
    ) {
      contentErrors.push(
        `${relativePath}: Render controller requires 'format_version' and 'render_controllers' object.`,
      );
    }
    return contentErrors;
  }

  return contentErrors;
}

export async function runSchemaValidation(): Promise<boolean> {
  console.log('[Validator] Starting strict Bedrock JSON & JSON UI validation...');
  const rootDir = process.cwd();

  const jsonGlob = new Bun.Glob('packs/**/*.json');
  const packJsonFiles = Array.from(jsonGlob.scanSync({ cwd: rootDir, absolute: true }));

  let totalValidated = 0;
  let errors = 0;

  const jsonResults = await Promise.all(
    packJsonFiles.map(async (filePath) => {
      const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
      let json: Record<string, unknown>;
      try {
        json = await Bun.file(filePath).json();
      } catch (e) {
        return { relativePath, parseError: e, uiErrors: [] as string[], contentErrors: [] as string[] };
      }
      if (relativePath.startsWith('packs/resource/ui/')) {
        return {
          relativePath,
          parseError: null,
          uiErrors: validateUiJson(relativePath, json),
          contentErrors: [] as string[],
        };
      }
      return {
        relativePath,
        parseError: null,
        uiErrors: [] as string[],
        contentErrors: validateContentJson(relativePath, json),
      };
    }),
  );

  for (const res of jsonResults) {
    if (res.parseError) {
      console.error(`[Validator] Invalid JSON syntax in ${res.relativePath}:`, res.parseError);
      errors++;
      continue;
    }

    totalValidated++;

    if (res.uiErrors.length > 0) {
      console.error(`[Validator] JSON UI error in ${res.relativePath}:`);
      for (const err of res.uiErrors) {
        console.error(`  - ${err}`);
      }
      errors += res.uiErrors.length;
    }

    if (res.contentErrors.length > 0) {
      console.error(`[Validator] Bedrock Content error in ${res.relativePath}:`);
      for (const err of res.contentErrors) {
        console.error(`  - ${err}`);
      }
      errors += res.contentErrors.length;
    }
  }

  const langGlob = new Bun.Glob('packs/**/*.lang');
  const langFiles = Array.from(langGlob.scanSync({ cwd: rootDir, absolute: true }));
  const rpLangKeys = new Set<string>();

  for (const langPath of langFiles) {
    const relLang = path.relative(rootDir, langPath).replace(/\\/g, '/');
    const rawLang = await Bun.file(langPath).text();
    const { errors: langErrs, keys } = validateLangFile(relLang, rawLang);
    if (relLang === 'packs/resource/texts/en_US.lang') {
      for (const k of keys) {
        rpLangKeys.add(k);
      }
    }
    if (langErrs.length > 0) {
      for (const err of langErrs) {
        console.error(`  - ${err}`);
      }
      errors += langErrs.length;
    }
  }

  const requiredLangFiles = [
    'packs/behavior/texts/languages.json',
    'packs/behavior/texts/en_US.lang',
    'packs/resource/texts/languages.json',
    'packs/resource/texts/en_US.lang',
  ];
  for (const reqFile of requiredLangFiles) {
    if (!(await Bun.file(path.join(rootDir, reqFile)).exists())) {
      console.error(`[Validator] Missing required localization file: ${reqFile}`);
      errors++;
    }
  }

  const tsGlob = new Bun.Glob('src/**/*.ts');
  for (const tsFile of tsGlob.scanSync({ cwd: rootDir, absolute: true })) {
    if (tsFile.includes('__tests__') || tsFile.includes('__mocks__')) {
      continue;
    }
    const tsContent = await Bun.file(tsFile).text();
    const matches = tsContent.matchAll(/\b(?:tr\(\s*|translate:\s*)['"]([^'"]+)['"]/g);
    for (const m of matches) {
      const key = m[1];
      if (key && !rpLangKeys.has(key)) {
        const relTs = path.relative(rootDir, tsFile).replace(/\\/g, '/');
        console.error(
          `[Validator] Missing translation key '${key}' in packs/resource/texts/en_US.lang (used in ${relTs}).`,
        );
        errors++;
      }
    }
  }

  console.log(`[Validator] Validated ${totalValidated} JSON files and ${langFiles.length} .lang files.`);

  if (errors > 0) {
    console.error(`[Validator] Found ${errors} validation error(s).`);
    return false;
  }

  console.log('[Validator] All JSON and JSON UI files passed strict schema & logic validation.');
  return true;
}

export async function validateSchemas(): Promise<void> {
  const success = await runSchemaValidation();
  if (!success) {
    throw new Error('JSON schema validation failed.');
  }
}

if (import.meta.main) {
  const success = await runSchemaValidation();
  if (!success) {
    process.exit(1);
  }
}
