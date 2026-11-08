import { describe, expect, it } from 'bun:test';

import { generateDisplayName, isFormattedDisplayName, normalizeNamespace, resolveIcon } from '@core/utils/item.js';

describe('Item & Entity Utilities', () => {
  describe('normalizeNamespace', () => {
    it('prepends default minecraft namespace to un-namespaced identifiers', () => {
      expect(normalizeNamespace('panda')).toBe('minecraft:panda');
      expect(normalizeNamespace('wither_skeleton')).toBe('minecraft:wither_skeleton');
      expect(normalizeNamespace('diamond_sword')).toBe('minecraft:diamond_sword');
    });

    it('converts camelCase to snake_case when prefixing namespace', () => {
      expect(normalizeNamespace('diamondSword')).toBe('minecraft:diamond_sword');
      expect(normalizeNamespace('witherSkeleton')).toBe('minecraft:wither_skeleton');
      expect(normalizeNamespace('goldenApple')).toBe('minecraft:golden_apple');
      expect(normalizeNamespace('caveSpider')).toBe('minecraft:cave_spider');
    });

    it('converts PascalCase, spaces, and hyphens to snake_case', () => {
      expect(normalizeNamespace('DiamondSword')).toBe('minecraft:diamond_sword');
      expect(normalizeNamespace('Diamond Sword')).toBe('minecraft:diamond_sword');
      expect(normalizeNamespace('Wither Skeleton')).toBe('minecraft:wither_skeleton');
      expect(normalizeNamespace('diamond-sword')).toBe('minecraft:diamond_sword');
    });

    it('preserves existing namespaces when colon is present and lowercases identifiers', () => {
      expect(normalizeNamespace('minecraft:panda')).toBe('minecraft:panda');
      expect(normalizeNamespace('Minecraft:Bedrock')).toBe('minecraft:bedrock');
      expect(normalizeNamespace('minecraft:diamond_sword')).toBe('minecraft:diamond_sword');
      expect(normalizeNamespace('custom:ruby_sword')).toBe('custom:ruby_sword');
      expect(normalizeNamespace('Custom:Ruby_Sword')).toBe('custom:ruby_sword');
      expect(normalizeNamespace('addon:super_boss')).toBe('addon:super_boss');
    });

    it('supports custom default namespaces', () => {
      expect(normalizeNamespace('ruby_ore', 'custom')).toBe('custom:ruby_ore');
      expect(normalizeNamespace('magicWand', 'rpg')).toBe('rpg:magic_wand');
    });

    it('trims leading and trailing whitespace', () => {
      expect(normalizeNamespace('  panda  ')).toBe('minecraft:panda');
      expect(normalizeNamespace('  minecraft:zombie  ')).toBe('minecraft:zombie');
    });

    it('returns empty string for empty, blank, or malformed candidates', () => {
      expect(normalizeNamespace('')).toBe('');
      expect(normalizeNamespace('   ')).toBe('');
      expect(normalizeNamespace('minecraft:')).toBe('');
      expect(normalizeNamespace(':')).toBe('');
      expect(normalizeNamespace(':zombie')).toBe('');
      expect(normalizeNamespace('___')).toBe('');
      expect(normalizeNamespace('---')).toBe('');
    });
  });

  describe('generateDisplayName', () => {
    it('formats entity identifiers into clean title-cased names', () => {
      expect(generateDisplayName('minecraft:panda')).toBe('Panda');
      expect(generateDisplayName('minecraft:wither_skeleton')).toBe('Wither Skeleton');
      expect(generateDisplayName('minecraft:cave_spider')).toBe('Cave Spider');
      expect(generateDisplayName('minecraft:elder_guardian')).toBe('Elder Guardian');
      expect(generateDisplayName('minecraft:iron_golem')).toBe('Iron Golem');
      expect(generateDisplayName('minecraft:zombified_piglin')).toBe('Zombified Piglin');
    });

    it('formats item identifiers into clean title-cased names', () => {
      expect(generateDisplayName('minecraft:diamond_sword')).toBe('Diamond Sword');
      expect(generateDisplayName('minecraft:golden_apple')).toBe('Golden Apple');
      expect(generateDisplayName('minecraft:enchanted_book')).toBe('Enchanted Book');
      expect(generateDisplayName('minecraft:totem_of_undying')).toBe('Totem Of Undying');
    });

    it('handles identifiers without namespace prefix', () => {
      expect(generateDisplayName('panda')).toBe('Panda');
      expect(generateDisplayName('wither_skeleton')).toBe('Wither Skeleton');
      expect(generateDisplayName('diamond_sword')).toBe('Diamond Sword');
      expect(generateDisplayName('diamondSword')).toBe('Diamond Sword');
    });

    it('handles custom namespaces cleanly', () => {
      expect(generateDisplayName('custom:ruby_sword')).toBe('Ruby Sword');
      expect(generateDisplayName('addon:ancient_titan')).toBe('Ancient Titan');
    });

    it('returns Unknown Item for empty or blank inputs', () => {
      expect(generateDisplayName('')).toBe('Unknown Item');
      expect(generateDisplayName('   ')).toBe('Unknown Item');
    });

    it('caches generated display names on subsequent invocations', () => {
      const first = generateDisplayName('minecraft:polar_bear');
      const second = generateDisplayName('minecraft:polar_bear');
      expect(first).toBe('Polar Bear');
      expect(second).toBe(first);
    });
  });

  describe('isFormattedDisplayName', () => {
    it('returns true for human-readable title-cased display names', () => {
      expect(isFormattedDisplayName('Panda')).toBeTrue();
      expect(isFormattedDisplayName('Wither Skeleton')).toBeTrue();
      expect(isFormattedDisplayName('Diamond Sword')).toBeTrue();
      expect(isFormattedDisplayName('§aDiamond Sword')).toBeTrue();
    });

    it('returns false for unformatted, namespaced, or raw code identifiers', () => {
      expect(isFormattedDisplayName('minecraft:panda')).toBeFalse();
      expect(isFormattedDisplayName('minecraft:diamond_sword')).toBeFalse();
      expect(isFormattedDisplayName('diamond_sword')).toBeFalse();
      expect(isFormattedDisplayName('diamondSword')).toBeFalse();
      expect(isFormattedDisplayName('panda')).toBeFalse();
      expect(isFormattedDisplayName('')).toBeFalse();
      expect(isFormattedDisplayName('   ')).toBeFalse();
    });
  });

  describe('resolveIcon', () => {
    it('resolves irregular textures directly from mapping', () => {
      expect(resolveIcon('minecraft:totem_of_undying')).toBe('textures/items/totem');
      expect(resolveIcon('minecraft:ancient_debris')).toBe('textures/blocks/ancient_debris_side');
    });

    it('resolves family fallback textures', () => {
      expect(resolveIcon('minecraft:diamond_sword')).toBe('textures/items/diamond_sword');
      expect(resolveIcon('minecraft:netherite_chestplate')).toBe('textures/items/netherite_chestplate');
    });

    it('resolves spawn egg textures', () => {
      expect(resolveIcon('minecraft:creeper_spawn_egg')).toBe('textures/items/spawn_eggs/spawn_egg_creeper');
    });

    it('returns fallback icon for empty or blank strings', () => {
      expect(resolveIcon('')).toBe('textures/ui/icon_recipe_equipment');
    });
  });
});
