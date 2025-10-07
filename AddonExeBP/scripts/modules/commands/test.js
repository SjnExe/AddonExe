import { commandManager } from './commandManager.js';
import { world, system, ItemStack, ItemTypes, Block, EnchantmentType } from '@minecraft/server';

// --- Helper Function ---
const log = (message, executor) => {
    const prefix = '§7[§eAPI-Test§7]§r';
    console.warn(`${prefix} ${message}`);
    if (executor && !executor.isConsole) {
        executor.sendMessage(`${prefix} ${message}`);
    }
};

const testSection = async (name, testFn, executor) => {
    log(`--- Testing: ${name} ---`, executor);
    try {
        await testFn();
    } catch (e) {
        log(`§c  FAILURE: An unexpected error occurred in ${name}. Error: ${e.stack}`, executor);
    }
};

commandManager.register({
    name: 'test',
    aliases: ['testapis'],
    description: 'Tests unconfirmed APIs and logs the results to the console.',
    category: 'Admin',
    permissionLevel: 1, // Admin-level command
    allowConsole: true,
    parameters: [],
    execute: (executor, args) => {
        const player = executor.isConsole ? null : executor;
        log('§aStarting tests for unconfirmed APIs...', executor);

        system.run(async () => {
            await testSection('Specific Events', async () => {
                const eventList = ['playerJoin', 'playerLeave', 'playerSpawn', 'playerBreakBlock', 'entityDie', 'weatherChange'];
                let allFound = true;
                for (const eventName of eventList) {
                    if (world.afterEvents[eventName]) {
                        log(`  SUCCESS: Found event world.afterEvents.${eventName}`, executor);
                    } else {
                        log(`  §cFAILURE: Could not find event world.afterEvents.${eventName}`, executor);
                        allFound = false;
                    }
                }
                if (allFound) log('  All example events exist.', executor);
            }, executor);

            await testSection('Game Objects & Classes', async () => {
                if (!player) {
                    log('  SKIPPED: Requires a player context.', executor);
                    return;
                }
                const block = player.getBlockFromViewDirection();
                if (block) {
                    const permutation = block.permutation;
                    if (permutation) {
                        log(`  SUCCESS: Found BlockPermutation. Type: ${permutation.type.id}`, executor);
                    } else {
                        log('  §cFAILURE: Could not get BlockPermutation.', executor);
                    }
                } else {
                    log('  INFO: Not looking at a block for BlockPermutation test.', executor);
                }

                const inv = player.getComponent('inventory').container;
                const slot = inv.getSlot(0);
                if (slot) {
                    log('  SUCCESS: Got ContainerSlot for slot 0.', executor);
                } else {
                    log('  §cFAILURE: Could not get ContainerSlot.', executor);
                }

                if (world.scoreboard.getObjective('test')) {
                    const objective = world.scoreboard.getObjective('test');
                    const identity = objective.getParticipants()[0];
                    if (identity) {
                        log(`  SUCCESS: Got ScoreboardIdentity. DisplayName: ${identity.displayName}`, executor);
                    }
                    if (objective) {
                         log(`  SUCCESS: Got ScoreboardObjective. ID: ${objective.id}`, executor);
                    }
                } else {
                    log('  INFO: Scoreboard objective "test" not found, skipping identity/objective test.', executor);
                }
            }, executor);

            await testSection('Item Components', async () => {
                const diamondSword = new ItemStack(ItemTypes.get('diamond_sword'));
                const apple = new ItemStack(ItemTypes.get('apple'));

                const durability = diamondSword.getComponent('durability');
                if (durability) {
                    log(`  SUCCESS: Got ItemDurabilityComponent. Max Durability: ${durability.maxDurability}`, executor);
                } else {
                     log('  §cFAILURE: Could not get ItemDurabilityComponent.', executor);
                }

                const food = apple.getComponent('food');
                if (food) {
                    log(`  SUCCESS: Got ItemFoodComponent. Nutrition: ${food.nutrition}`, executor);
                } else {
                    log('  §cFAILURE: Could not get ItemFoodComponent.', executor);
                }

                const enchantable = diamondSword.getComponent('enchantable');
                if (enchantable) {
                    log('  SUCCESS: Got ItemEnchantableComponent.', executor);
                } else {
                    log('  §cFAILURE: Could not get ItemEnchantableComponent.', executor);
                }
            }, executor);

            await testSection('Entity & Block Components', async () => {
                if (!player) {
                    log('  SKIPPED: Requires a player context.', executor);
                    return;
                }
                const movement = player.getComponent('movement');
                if (movement) {
                    log(`  SUCCESS: Got EntityMovementComponent. Current Value: ${movement.currentValue}`, executor);
                } else {
                    log('  §cFAILURE: Could not get EntityMovementComponent.', executor);
                }
                const rideable = player.getComponent('rideable');
                 if (rideable) {
                    log('  SUCCESS: Got EntityRideableComponent.', executor);
                } else {
                    log('  §cFAILURE: Could not get EntityRideableComponent.', executor);
                }

                // Look at a jukebox to test
                const block = player.getBlockFromViewDirection();
                if (block && block.typeId === 'minecraft:jukebox') {
                    const jukebox = block.getComponent('record_player');
                    if (jukebox) {
                        log('  SUCCESS: Got BlockRecordPlayerComponent from jukebox.', executor);
                    } else {
                        log('  §cFAILURE: Could not get BlockRecordPlayerComponent from jukebox.', executor);
                    }
                } else {
                    log('  INFO: Not looking at a jukebox, skipping record player test.', executor);
                }
            }, executor);

            await testSection('Managers & Utilities', async () => {
                if (world.lootTables) {
                    log('  SUCCESS: `world.lootTables` (LootTableManager) exists.', executor);
                } else {
                    log('  INFO: `world.lootTables` (LootTableManager) does not exist.', executor);
                }

                try {
                    const rawMessage = { rawtext: [{ text: "This is a " }, { translate: "item.diamond_sword.name" }] };
                    world.sendMessage(rawMessage);
                    log('  SUCCESS: Sent a RawMessage.', executor);
                } catch(e) {
                    log(`  §cFAILURE: Could not send RawMessage. Error: ${e.message}`, executor);
                }

                if (!player) {
                    log('  SKIPPED: Raycast/Query tests require a player context.', executor);
                    return;
                }
                const blockRaycast = player.getBlockFromViewDirection({ maxDistance: 5 });
                if (blockRaycast) {
                     log('  SUCCESS: `getBlockFromViewDirection` with options (BlockRaycastOptions) worked.', executor);
                } else {
                    log('  INFO: `getBlockFromViewDirection` with options returned nothing.', executor);
                }

                const query = { families: ['monster'] };
                const queryResult = player.dimension.getEntities(query);
                log(`  SUCCESS: EntityQueryOptions worked. Found ${queryResult.length} monsters.`, executor);

            }, executor);

            log('§aAll API tests complete.', executor);
        });
    }
});