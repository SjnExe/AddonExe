import * as mc from '@minecraft/server';

const displayNameCache = new Map<string, string>();
const iconCache = new Map<string, string>();

const irregularItemTextures: Record<string, string> = {
  ancient_debris: 'textures/blocks/ancient_debris_side',
  totem_of_undying: 'textures/items/totem',
  lapis_lazuli: 'textures/items/dye_powder_blue',
  sugar_cane: 'textures/items/reeds',
  cooked_beef: 'textures/items/beef_cooked',
  cooked_porkchop: 'textures/items/porkchop_cooked',
  cooked_salmon: 'textures/items/fish_salmon_cooked',
  cooked_cod: 'textures/items/fish_cooked',
  golden_carrot: 'textures/items/carrot_golden',
  golden_apple: 'textures/items/apple_golden',
  enchanted_golden_apple: 'textures/items/apple_golden',
  enchanted_book: 'textures/items/book_enchanted',
  wither_skeleton_skull: 'textures/items/spawn_eggs/spawn_egg_wither_skeleton',
  melon_slice: 'textures/items/melon',
  pumpkin: 'textures/blocks/pumpkin_face_off',
  hardened_clay: 'textures/blocks/hardened_clay',
  white_concrete: 'textures/blocks/concrete_white',
  stone_bricks: 'textures/blocks/stonebrick',
  oak_log: 'textures/blocks/log_oak_top',
  spruce_log: 'textures/blocks/log_spruce_top',
  birch_log: 'textures/blocks/log_birch_top',
  jungle_log: 'textures/blocks/log_jungle_top',
  acacia_log: 'textures/blocks/log_acacia_top',
  dark_oak_log: 'textures/blocks/log_big_oak_top',
  mangrove_log: 'textures/blocks/mangrove_log_top',
  cherry_log: 'textures/blocks/cherry_log_top',
  crimson_stem: 'textures/blocks/huge_fungus/crimson_log_top',
  warped_stem: 'textures/blocks/huge_fungus/warped_stem_top',
};

const familyIconFallbacks: [string, string][] = [
  ['netherite_sword', 'textures/items/netherite_sword'],
  ['netherite_pickaxe', 'textures/items/netherite_pickaxe'],
  ['netherite_helmet', 'textures/items/netherite_helmet'],
  ['netherite_chestplate', 'textures/items/netherite_chestplate'],
  ['netherite_leggings', 'textures/items/netherite_leggings'],
  ['netherite_boots', 'textures/items/netherite_boots'],
  ['netherite_scrap', 'textures/items/netherite_scrap'],
  ['netherite', 'textures/items/netherite_ingot'],
  ['ancient_debris', 'textures/blocks/ancient_debris_side'],
  ['diamond_sword', 'textures/items/diamond_sword'],
  ['diamond_pickaxe', 'textures/items/diamond_pickaxe'],
  ['diamond_axe', 'textures/items/diamond_axe'],
  ['diamond_shovel', 'textures/items/diamond_shovel'],
  ['diamond_hoe', 'textures/items/diamond_hoe'],
  ['diamond_helmet', 'textures/items/diamond_helmet'],
  ['diamond_chestplate', 'textures/items/diamond_chestplate'],
  ['diamond_leggings', 'textures/items/diamond_leggings'],
  ['diamond_boots', 'textures/items/diamond_boots'],
  ['diamond', 'textures/items/diamond'],
  ['emerald', 'textures/items/emerald'],
  ['gold_ingot', 'textures/items/gold_ingot'],
  ['golden_apple', 'textures/items/apple_golden'],
  ['golden_carrot', 'textures/items/carrot_golden'],
  ['iron_sword', 'textures/items/iron_sword'],
  ['iron_pickaxe', 'textures/items/iron_pickaxe'],
  ['iron_shovel', 'textures/items/iron_shovel'],
  ['iron_chestplate', 'textures/items/iron_chestplate'],
  ['iron', 'textures/items/iron_ingot'],
  ['lapis', 'textures/items/dye_powder_blue'],
  ['quartz', 'textures/items/quartz'],
  ['totem', 'textures/items/totem'],
  ['nether_star', 'textures/items/nether_star'],
  ['shulker', 'textures/items/shulker_shell'],
  ['elytra', 'textures/items/elytra'],
  ['wither_skeleton', 'textures/items/spawn_eggs/spawn_egg_wither_skeleton'],
  ['enchant', 'textures/items/book_enchanted'],
  ['spruce', 'textures/blocks/log_spruce_top'],
  ['birch', 'textures/blocks/log_birch_top'],
  ['jungle', 'textures/blocks/log_jungle_top'],
  ['acacia', 'textures/blocks/log_acacia_top'],
  ['dark_oak', 'textures/blocks/log_big_oak_top'],
  ['mangrove', 'textures/blocks/mangrove_log_top'],
  ['cherry', 'textures/blocks/cherry_log_top'],
  ['crimson', 'textures/blocks/huge_fungus/crimson_log_top'],
  ['warped', 'textures/blocks/huge_fungus/warped_stem_top'],
  ['oak_log', 'textures/blocks/log_oak_top'],
  ['oak', 'textures/blocks/planks_oak'],
  ['planks', 'textures/blocks/planks_oak'],
  ['stone_brick', 'textures/blocks/stonebrick'],
  ['stonebrick', 'textures/blocks/stonebrick'],
  ['mossy_cobblestone', 'textures/blocks/cobblestone'],
  ['cobblestone', 'textures/blocks/cobblestone'],
  ['smooth_stone', 'textures/blocks/stone'],
  ['stone', 'textures/blocks/stone'],
  ['sandstone', 'textures/blocks/sand'],
  ['sand', 'textures/blocks/sand'],
  ['gravel', 'textures/blocks/gravel'],
  ['dirt', 'textures/blocks/dirt'],
  ['glass', 'textures/blocks/glass'],
  ['terracotta', 'textures/blocks/hardened_clay'],
  ['hardened_clay', 'textures/blocks/hardened_clay'],
  ['concrete', 'textures/blocks/concrete_white'],
  ['obsidian', 'textures/blocks/obsidian'],
  ['glowstone', 'textures/blocks/glowstone'],
  ['netherrack', 'textures/blocks/netherrack'],
  ['nether_brick', 'textures/blocks/netherrack'],
  ['purpur', 'textures/blocks/purpur_block'],
  ['end_stone', 'textures/blocks/end_stone'],
  ['beef', 'textures/items/beef_cooked'],
  ['steak', 'textures/items/beef_cooked'],
  ['porkchop', 'textures/items/porkchop_cooked'],
  ['bread', 'textures/items/bread'],
  ['salmon', 'textures/items/fish_salmon_cooked'],
  ['cod', 'textures/items/fish_cooked'],
  ['chorus', 'textures/items/chorus_fruit'],
  ['wheat', 'textures/items/wheat'],
  ['carrot', 'textures/items/carrot'],
  ['potato', 'textures/items/potato'],
  ['melon', 'textures/items/melon'],
  ['pumpkin', 'textures/blocks/pumpkin_face_off'],
  ['sugar_cane', 'textures/items/reeds'],
  ['nether_wart', 'textures/items/nether_wart'],
];

export function isFormattedDisplayName(name: string | undefined): boolean {
  if (!name || name.trim().length === 0) {
    return false;
  }
  const clean = name.replace(/§[0-9a-fk-or]/gi, '').trim();
  if (clean.includes(':') || clean.includes('_')) {
    return false;
  }
  if (/^[a-z]+[A-Z]/.test(clean)) {
    return false;
  }
  if (/^[a-z0-9]+$/.test(clean)) {
    return false;
  }
  return true;
}

export function generateDisplayName(typeId: string): string {
  if (!typeId || typeId.trim().length === 0) {
    return 'Unknown Item';
  }

  const cached = displayNameCache.get(typeId);
  if (cached !== undefined) {
    return cached;
  }

  const withoutNamespace = typeId.includes(':') ? (typeId.split(':')[1] ?? typeId) : typeId;
  const normalized = withoutNamespace
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])([0-9]+)/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();

  const formattedName = normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  const result = formattedName || 'Unknown Item';
  displayNameCache.set(typeId, result);
  return result;
}

export function resolveIcon(typeId: string): string {
  if (!typeId || typeId.trim().length === 0) {
    return 'textures/ui/icon_recipe_equipment';
  }

  const cached = iconCache.get(typeId);
  if (cached !== undefined) {
    return cached;
  }

  const normalized = typeId
    .replace(/^minecraft:/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();

  if (irregularItemTextures[normalized]) {
    const texPath = irregularItemTextures[normalized]!;
    iconCache.set(typeId, texPath);
    return texPath;
  }

  for (const [pattern, texPath] of familyIconFallbacks) {
    if (normalized.includes(pattern)) {
      iconCache.set(typeId, texPath);
      return texPath;
    }
  }

  let iconPath: string;
  if (normalized.endsWith('_spawn_egg')) {
    const entityName = normalized.replace('_spawn_egg', '');
    iconPath = `textures/items/spawn_eggs/spawn_egg_${entityName}`;
  } else {
    let isBlock = false;
    try {
      const fullId = typeId.includes(':') ? typeId : 'minecraft:' + normalized;
      isBlock = Boolean(mc.BlockTypes?.get?.(fullId));
    } catch {
      isBlock = false;
    }
    iconPath = isBlock ? `textures/blocks/${normalized}` : `textures/items/${normalized}`;
  }

  iconCache.set(typeId, iconPath);
  return iconPath;
}
