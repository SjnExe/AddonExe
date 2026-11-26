import { feature } from 'bun:bundle';

import { getConfig } from '@core/config/configManager.js';
import { getXrayConfig } from '@core/config/configurations.js';
import { deserializeItem, serializeItem } from '@core/data/itemSerializer.js';
import { StorageManager } from '@core/data/storageManager.js';
import { diagnosticBotName, floatingTextId } from '@core/utils/constants.js';
import { debugLog, warnLog } from '@core/utils/logger.js';
import * as mc from '@minecraft/server';
import {
  MinecraftBlockTypes,
  MinecraftDimensionTypes,
  MinecraftEnchantmentTypes,
  MinecraftItemTypes,
} from '@minecraft/vanilla-data';

import { addTest, assert } from '../testRunner.js';

const suiteName = 'mc_api';

/** Registers in-game runtime diagnostic tests validating native Bedrock Script API capabilities. */
export function registerMcApiTests(): void {
  addTest(suiteName, 'World dimensions, ticks, and >30KB sharded dynamic properties work in live engine', () => {
    assert.ok(mc.world.getDimension(MinecraftDimensionTypes.Overworld), 'Overworld dimension missing');
    assert.ok(mc.world.getDimension(MinecraftDimensionTypes.Nether), 'Nether dimension missing');
    assert.ok(mc.world.getDimension(MinecraftDimensionTypes.TheEnd), 'The End dimension missing');
    assert.ok(typeof mc.system.currentTick === 'number' && mc.system.currentTick >= 0, 'Invalid system.currentTick');

    const storage = new StorageManager('exe:__test_sharded_storage__');
    const largeItems = Array.from({ length: 1200 }, (_, i) => `entry_${i}_${'x'.repeat(30)}`);
    storage.save({ count: largeItems.length, items: largeItems });

    const loaded = storage.load<{ count: number; items: string[] }>();
    assert.ok(
      loaded && loaded.count === 1200 && loaded.items[1199] === largeItems[1199],
      'Sharded storage roundtrip failed',
    );

    storage.delete();
    assert.equal(storage.load(), undefined, 'Storage should be undefined after delete()');
  });

  addTest(suiteName, 'Pack registries resolve custom entities, kit items, and X-Ray blocks', () => {
    if (mc.EntityTypes && typeof mc.EntityTypes.get === 'function') {
      assert.ok(
        mc.EntityTypes.get(floatingTextId as Parameters<typeof mc.EntityTypes.get>[0]),
        `Custom entity '${floatingTextId}' missing from mc.EntityTypes`,
      );
      assert.ok(
        mc.EntityTypes.get('exe:seat' as Parameters<typeof mc.EntityTypes.get>[0]),
        `Custom entity 'exe:seat' missing from mc.EntityTypes`,
      );
    }

    if (mc.BlockTypes && typeof mc.BlockTypes.get === 'function') {
      for (const lightId of [
        MinecraftBlockTypes.LightBlock15,
        MinecraftBlockTypes.LightBlock14,
        MinecraftBlockTypes.LightBlock10,
        MinecraftBlockTypes.LightBlock7,
      ]) {
        assert.ok(mc.BlockTypes.get(lightId), `Dynamic lighting block '${lightId}' missing from mc.BlockTypes`);
      }
    }

    if (mc.BlockComponentTypes) {
      assert.ok(mc.BlockComponentTypes.Inventory, 'BlockComponentTypes.Inventory missing in live engine');
      assert.ok(mc.BlockComponentTypes.Sign, 'BlockComponentTypes.Sign missing in live engine');
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

  addTest(suiteName, 'ItemStack serializeItem and deserializeItem roundtrip preserves component metadata', () => {
    if (!mc.ItemTypes || typeof mc.ItemTypes.get !== 'function') {
      return;
    }
    const swordType = mc.ItemTypes.get(MinecraftItemTypes.DiamondSword);
    assert.ok(swordType, 'DiamondSword type should exist');

    const stack = new mc.ItemStack(swordType!, 1);
    stack.nameTag = '§bExcalibur';
    stack.setLore(['§7Line 1', '§eLine 2']);
    stack.keepOnDeath = true;

    const enchantComp = stack.getComponent(mc.ItemComponentTypes.Enchantable) as
      mc.ItemEnchantableComponent | undefined;
    const unbreakingType = mc.EnchantmentTypes?.get(MinecraftEnchantmentTypes.Unbreaking);
    if (enchantComp && unbreakingType) {
      enchantComp.addEnchantment({ type: unbreakingType, level: 3 });
    }

    const restored = deserializeItem(serializeItem(stack));
    assert.ok(restored, 'Deserialized ItemStack should be defined');
    assert.equal(restored!.nameTag, '§bExcalibur', 'Restored nameTag mismatch');
    assert.deepEqual(restored!.getLore(), ['§7Line 1', '§eLine 2'], 'Restored lore mismatch');
    assert.equal(restored!.keepOnDeath, true, 'Restored keepOnDeath mismatch');

    const serializedWithContainer = {
      ...serializeItem(stack),
      containerItems: [{ slot: 0, item: { typeId: MinecraftItemTypes.Diamond, amount: 64 } }],
    };
    const restoredContainerItem = deserializeItem(serializedWithContainer);
    assert.ok(restoredContainerItem, 'Container item deserialization should succeed');
  });

  addTest(suiteName, 'Live engine tickingarea command executes and cleans up cleanly', () => {
    const overworld = mc.world.getDimension(MinecraftDimensionTypes.Overworld);
    const areaName = 'exe_test_chunky';
    try {
      overworld.runCommand(`tickingarea remove ${areaName}`);
    } catch {
      // Ignore if not present
    }
    try {
      const res = overworld.runCommand(`tickingarea add 0 0 0 0 0 0 ${areaName} true`);
      if (res && typeof res.successCount === 'number') {
        assert.ok(res.successCount >= 1, `Expected tickingarea add to succeed, got successCount=${res.successCount}`);
      }
    } finally {
      try {
        overworld.runCommand(`tickingarea remove ${areaName}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  if (feature('CANARY')) {
    addTest(suiteName, 'Server GameTest simulated player framework initializes cleanly in live engine', async () => {
      let gametest: typeof import('@minecraft/server-gametest');
      try {
        gametest = await import('@minecraft/server-gametest');
      } catch (err: unknown) {
        throw new Error(
          `Failed to import @minecraft/server-gametest: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      assert.ok(gametest, 'Expected @minecraft/server-gametest module to be resolvable');
      assert.equal(typeof gametest.spawnSimulatedPlayer, 'function', 'spawnSimulatedPlayer should be a function');
      assert.equal(typeof gametest.register, 'function', 'register should be a function');

      const players = mc.world.getAllPlayers();
      const spawnLoc: mc.DimensionLocation =
        players.length > 0
          ? {
              x: Math.floor(players[0]!.location.x),
              y: Math.floor(players[0]!.location.y) + 2,
              z: Math.floor(players[0]!.location.z),
              dimension: players[0]!.dimension,
            }
          : {
              x: 0,
              y: 100,
              z: 0,
              dimension: mc.world.getDimension(MinecraftDimensionTypes.Overworld),
            };

      let bot: ReturnType<typeof gametest.spawnSimulatedPlayer>;
      try {
        bot = gametest.spawnSimulatedPlayer(spawnLoc, diagnosticBotName, mc.GameMode.Creative);
      } catch (err: unknown) {
        throw new Error(
          `Failed to spawn simulated player (${players.length > 0 ? 'near player' : 'default location, no players online'}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      assert.ok(bot, 'Expected simulated player instance to be created');

      let assertionError: unknown;
      try {
        assert.ok(bot.isValid, 'SimulatedPlayer should be valid after spawn');
        assert.equal(typeof bot.disconnect, 'function', 'SimulatedPlayer.disconnect should be a function');

        // Verify custom exe:seat entity spawns cleanly with Rideable component in a loaded chunk
        let seat: mc.Entity | undefined;
        try {
          seat = bot.dimension.spawnEntity('exe:seat' as Parameters<typeof bot.dimension.spawnEntity>[0], bot.location);
          assert.ok(seat.isValid, 'Spawned exe:seat entity should be valid');
          assert.ok(seat.getComponent(mc.EntityComponentTypes.Rideable), 'exe:seat should have Rideable component');
        } finally {
          if (seat?.isValid) {
            seat.remove();
          }
        }
      } catch (err: unknown) {
        assertionError = err;
      }

      let cleanupError: unknown;
      try {
        if (typeof bot.disconnect === 'function') {
          bot.disconnect();
        }
      } catch (err: unknown) {
        cleanupError = err;
      }

      if (assertionError) {
        if (cleanupError) {
          warnLog(
            `[TestRunner] Failed to disconnect simulated bot during cleanup: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          );
        }
        throw assertionError;
      }

      if (cleanupError) {
        throw new Error(
          `Failed to disconnect simulated bot: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
    });

    addTest(suiteName, 'Debug utilities collectRuntimeStats and collectPluginStats report memory metrics', async () => {
      let debugUtils: typeof import('@minecraft/debug-utilities');
      try {
        debugUtils = await import('@minecraft/debug-utilities');
      } catch (err: unknown) {
        throw new Error(
          `Failed to import @minecraft/debug-utilities: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      assert.ok(debugUtils, 'Expected @minecraft/debug-utilities to resolve');
      assert.equal(typeof debugUtils.collectRuntimeStats, 'function', 'collectRuntimeStats should be a function');
      const runtimeStats = debugUtils.collectRuntimeStats();
      assert.ok(runtimeStats && typeof runtimeStats.memoryUsedSize === 'number', 'Invalid runtime memory stats');

      assert.equal(typeof debugUtils.collectPluginStats, 'function', 'collectPluginStats should be a function');
      const pluginStats = debugUtils.collectPluginStats();
      assert.ok(pluginStats && Array.isArray(pluginStats.plugins), 'Invalid plugin stats');

      const usedMb = (runtimeStats.memoryUsedSize / (1024 * 1024)).toFixed(2);
      const allocMb = (runtimeStats.memoryAllocatedSize / (1024 * 1024)).toFixed(2);
      let totalHandles = 0;
      for (const plugin of pluginStats.plugins) {
        totalHandles += Object.values(plugin.handleCounts).reduce((acc, count) => acc + count, 0);
      }
      debugLog(
        `[TestRunner] Memory: ${usedMb}/${allocMb} MB | Objects: ${runtimeStats.objectCount} (str: ${runtimeStats.stringCount}, arr: ${runtimeStats.arrayCount}) | Handles: ${totalHandles}`,
      );
    });
  }
}
