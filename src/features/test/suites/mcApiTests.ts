import { getConfig } from '@core/config/configManager.js';
import { getShopConfig, getXrayConfig } from '@core/config/configurations.js';
import { deserializeItem, serializeItem } from '@core/data/itemSerializer.js';
import { floatingTextId } from '@core/utils/constants.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes, MinecraftEnchantmentTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';
import { addTest, assert } from '../testRunner.js';

const SUITE_NAME = 'mc_api';

export function registerMcApiTests() {
    addTest(SUITE_NAME, 'World dimensions (Overworld, Nether, The End) are accessible', () => {
        const overworld = mc.world.getDimension(MinecraftDimensionTypes.Overworld);
        assert.ok(overworld, 'Overworld dimension should exist');

        const nether = mc.world.getDimension(MinecraftDimensionTypes.Nether);
        assert.ok(nether, 'Nether dimension should exist');

        const end = mc.world.getDimension(MinecraftDimensionTypes.TheEnd);
        assert.ok(end, 'The End dimension should exist');
    });

    addTest(SUITE_NAME, 'System currentTick and dynamic properties read/write/delete work', () => {
        assert.ok(typeof mc.system.currentTick === 'number' && mc.system.currentTick >= 0, 'currentTick should be non-negative number');

        const testKey = 'exe:__runtime_test_prop__';
        mc.world.setDynamicProperty(testKey, 'ok_123');
        assert.equal(mc.world.getDynamicProperty(testKey), 'ok_123', 'Dynamic property should read back written string');

        mc.world.setDynamicProperty(testKey, undefined);
        assert.equal(mc.world.getDynamicProperty(testKey), undefined, 'Dynamic property should be deleted when set to undefined');
    });

    addTest(SUITE_NAME, 'Custom entity exe:floating_text is registered in Behavior Pack', () => {
        const entityTypesApi = (mc as unknown as { EntityTypes?: { get?: (id: string) => unknown } }).EntityTypes;
        if (entityTypesApi && typeof entityTypesApi.get === 'function') {
            const ftType = entityTypesApi.get(floatingTextId);
            assert.ok(ftType, `Custom entity '${floatingTextId}' is missing from mc.EntityTypes`);
        }
    });

    addTest(SUITE_NAME, 'All configured Kit item typeIds exist in mc.ItemTypes', () => {
        if (!mc.ItemTypes || typeof mc.ItemTypes.get !== 'function') {
            return;
        }
        const kits = getConfig().kits.kitDefinitions;
        for (const [kitName, kit] of Object.entries(kits)) {
            for (const item of kit.items) {
                const resolved = mc.ItemTypes.get(item.typeId);
                assert.ok(resolved, `Kit '${kitName}' references unknown item typeId: ${item.typeId}`);
            }
        }
    });

    addTest(SUITE_NAME, 'All configured X-Ray monitored blockIds exist in mc.BlockTypes', () => {
        if (!mc.BlockTypes || typeof mc.BlockTypes.get !== 'function') {
            return;
        }
        const xray = getXrayConfig();
        for (const [oreKey, ore] of Object.entries(xray.monitoredOreTypes)) {
            for (const block of ore.blocks) {
                const resolved = mc.BlockTypes.get(block.blockId);
                assert.ok(resolved, `X-Ray ore '${oreKey}' references unknown blockId: ${block.blockId}`);
            }
        }
    });

    addTest(SUITE_NAME, 'ItemStack serializeItem and deserializeItem roundtrip preserves metadata', () => {
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

        const serialized = serializeItem(stack);
        assert.equal(serialized.nameTag, '§bExcalibur', 'Serialized nameTag should match');
        assert.deepEqual(serialized.lore, ['§7Line 1', '§eLine 2'], 'Serialized lore should match');
        assert.equal(serialized.keepOnDeath, true, 'Serialized keepOnDeath should be true');

        const restored = deserializeItem(serialized);
        assert.ok(restored, 'Deserialized ItemStack should be defined');
        assert.equal(restored!.nameTag, '§bExcalibur', 'Restored nameTag should match');
        assert.deepEqual(restored!.getLore(), ['§7Line 1', '§eLine 2'], 'Restored lore should match');
        assert.equal(restored!.keepOnDeath, true, 'Restored keepOnDeath should match');
    });

    addTest(SUITE_NAME, 'Shop categories contain valid structure', () => {
        const shop = getShopConfig();
        assert.ok(shop && typeof shop.categories === 'object', 'shopConfig.categories should exist');
        assert.ok(Object.keys(shop.categories).length > 0, 'shopConfig should have at least 1 category');
    });
}
