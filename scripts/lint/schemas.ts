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

export function validateContentJson(relativePath: string, json: Record<string, unknown>): string[] {
  const contentErrors: string[] = [];

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

  for (const filePath of packJsonFiles) {
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    let json: Record<string, unknown>;

    try {
      json = await Bun.file(filePath).json();
    } catch (e) {
      console.error(`[Validator] Invalid JSON syntax in ${relativePath}:`, e);
      errors++;
      continue;
    }

    totalValidated++;

    if (relativePath.startsWith('packs/resource/ui/')) {
      const uiErrors = validateUiJson(relativePath, json);
      if (uiErrors.length > 0) {
        console.error(`[Validator] JSON UI error in ${relativePath}:`);
        for (const err of uiErrors) {
          console.error(`  - ${err}`);
        }
        errors += uiErrors.length;
      }
    } else {
      const contentErrors = validateContentJson(relativePath, json);
      if (contentErrors.length > 0) {
        console.error(`[Validator] Bedrock Content error in ${relativePath}:`);
        for (const err of contentErrors) {
          console.error(`  - ${err}`);
        }
        errors += contentErrors.length;
      }
    }
  }

  console.log(`[Validator] Validated ${totalValidated} JSON files.`);

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
