import { getConfig } from '@core/config/configManager.js';
import { getXrayConfig } from '@core/config/configurations.js';
import { deserializeItem, serializeItem } from '@core/data/itemSerializer.js';
import { StorageManager } from '@core/data/storageManager.js';
import { floatingTextId } from '@core/utils/constants.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes, MinecraftEnchantmentTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';
import { addTest, assert } from '../testRunner.js';

const SUITE_NAME = 'mc_api';

export function registerMcApiTests(): void {
    addTest(SUITE_NAME, 'World dimensions, ticks, and >30KB sharded dynamic properties work in live engine', () => {
        assert.ok(mc.world.getDimension(MinecraftDimensionTypes.Overworld), 'Overworld dimension missing');
        assert.ok(mc.world.getDimension(MinecraftDimensionTypes.Nether), 'Nether dimension missing');
        assert.ok(mc.world.getDimension(MinecraftDimensionTypes.TheEnd), 'The End dimension missing');
        assert.ok(typeof mc.system.currentTick === 'number' && mc.system.currentTick >= 0, 'Invalid system.currentTick');

        const storage = new StorageManager('exe:__test_sharded_storage__');
        const largeItems = Array.from({ length: 1200 }, (_, i) => `entry_${i}_${'x'.repeat(30)}`);
        storage.save({ count: largeItems.length, items: largeItems });

        const loaded = storage.load<{ count: number; items: string[] }>();
        assert.ok(loaded && loaded.count === 1200 && loaded.items[1199] === largeItems[1199], 'Sharded storage roundtrip failed');

        storage.delete();
        assert.equal(storage.load(), undefined, 'Storage should be undefined after delete()');
    });

    addTest(SUITE_NAME, 'Pack registries resolve custom entities, kit items, and X-Ray blocks', () => {
        if (mc.EntityTypes && typeof mc.EntityTypes.get === 'function') {
            assert.ok(mc.EntityTypes.get(floatingTextId as Parameters<typeof mc.EntityTypes.get>[0]), `Custom entity '${floatingTextId}' missing from mc.EntityTypes`);
        }

        if (mc.ItemTypes && typeof mc.ItemTypes.get === 'function') {
            for (const [kitName, kit] of Object.entries(getConfig().kits.kitDefinitions)) {
                for (const item of kit.items) {
                    assert.ok(mc.ItemTypes.get(item.typeId), `Kit '${kitName}' has unknown item: ${item.typeId}`);
                }
            }
        }

        if (mc.BlockTypes && typeof mc.BlockTypes.get === 'function') {
            for (const [oreKey, ore] of Object.entries(getXrayConfig().monitoredOreTypes)) {
                for (const block of ore.blocks) {
                    assert.ok(mc.BlockTypes.get(block.blockId), `X-Ray ore '${oreKey}' has unknown block: ${block.blockId}`);
                }
            }
        }
    });

    addTest(SUITE_NAME, 'ItemStack serializeItem and deserializeItem roundtrip preserves component metadata', () => {
        if (!mc.ItemTypes || typeof mc.ItemTypes.get !== 'function') {
            return;
        }
        const swordType = mc.ItemTypes.get(MinecraftItemTypes.DiamondSword);
        assert.ok(swordType, 'DiamondSword type should exist');

        const stack = new mc.ItemStack(swordType!, 1);
        stack.nameTag = '§bExcalibur';
        stack.setLore(['§7Line 1', '§eLine 2']);
        stack.keepOnDeath = true;

        const enchantComp = stack.getComponent(mc.ItemComponentTypes.Enchantable) as mc.ItemEnchantableComponent | undefined;
        const unbreakingType = mc.EnchantmentTypes?.get(MinecraftEnchantmentTypes.Unbreaking);
        if (enchantComp && unbreakingType) {
            enchantComp.addEnchantment({ type: unbreakingType, level: 3 });
        }

        const restored = deserializeItem(serializeItem(stack));
        assert.ok(restored, 'Deserialized ItemStack should be defined');
        assert.equal(restored!.nameTag, '§bExcalibur', 'Restored nameTag mismatch');
        assert.deepEqual(restored!.getLore(), ['§7Line 1', '§eLine 2'], 'Restored lore mismatch');
        assert.equal(restored!.keepOnDeath, true, 'Restored keepOnDeath mismatch');
    });
}
