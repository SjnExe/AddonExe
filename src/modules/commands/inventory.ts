import * as mc from '@minecraft/server';

import { constants } from '@core/constants.js';
import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { findPlayerByName } from '@core/playerCache.js';
import { getPlayer } from '@core/playerDataManager.js';
import { playSound } from '@core/utils.js';

import { CustomCommand, CommandExecutor } from './commandManager.js';

interface InvseeCommandArgs {
    target?: mc.Player[];
    page?: number;
}

const invseeCommand: CustomCommand = {
    name: 'invsee',
    description: "Views a player's inventory in chat.",
    category: 'Moderation',
    permissionLevel: 2,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player' },
        { name: 'page', type: 'int', optional: true }
    ],
    execute: (executor: CommandExecutor, args: InvseeCommandArgs) => {
        const { target, page: pageArg } = args;

        if (!target || target.length === 0) {
            if (executor instanceof mc.Player) {
                sendMessage('§cPlayer not found.', executor);
            } else {
                executor.sendMessage('§cPlayer not found.');
            }
            return;
        }

        const targetPlayer = target[0];
        const inventory = (targetPlayer.getComponent('inventory') as mc.EntityInventoryComponent | undefined)
            ?.container;
        if (!inventory) {
            if (executor instanceof mc.Player) {
                sendMessage(`§cCould not access the inventory of ${targetPlayer.name}.`, executor);
            } else {
                executor.sendMessage(`§cCould not access the inventory of ${targetPlayer.name}.`);
            }
            return;
        }

        const items: string[] = [];
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (item) {
                items.push(`§eS${i}: §f${item.typeId.replace('minecraft:', '')} §7x${item.amount}`);
            }
        }

        if (items.length === 0) {
            if (executor instanceof mc.Player) {
                sendMessage(`§6Inventory of ${targetPlayer.name}: §r§7(Empty)`, executor);
            } else {
                executor.sendMessage(`§6Inventory of ${targetPlayer.name}: §r§7(Empty)`);
            }
            return;
        }

        const itemsPerPage = 10;
        const totalPages = Math.ceil(items.length / itemsPerPage);
        let page = (pageArg || 1) - 1;
        if (page < 0 || page >= totalPages) {
            page = 0;
        }

        const startIndex = page * itemsPerPage;
        const pageItems = items.slice(startIndex, startIndex + itemsPerPage);

        let message = `§6Inv: ${targetPlayer.name} (Page ${page + 1}/${totalPages})§r\n`;
        message += pageItems.join('\n');

        if (executor instanceof mc.Player) {
            sendMessage(message, executor, { raw: true });
        } else {
            executor.sendMessage(message);
        }
    }
};

const ecseeCommand: CustomCommand = {
    name: 'ecsee',
    description: "Views a player's ender chest inventory in chat.",
    category: 'Moderation',
    aliases: ['seeec'],
    permissionLevel: 2,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player' },
        { name: 'page', type: 'int', optional: true }
    ],
    execute: (executor: CommandExecutor, args: InvseeCommandArgs) => {
        const { target, page: pageArg } = args;

        if (!target || target.length === 0) {
            if (executor instanceof mc.Player) {
                sendMessage('§cPlayer not found.', executor);
            } else {
                executor.sendMessage('§cPlayer not found.');
            }
            return;
        }

        const targetPlayer = target[0];
        const enderChestComp = targetPlayer.getComponent('minecraft:ender_chest') as
            | { container?: mc.Container }
            | undefined;
        const inventory = enderChestComp?.container;

        if (!inventory) {
            if (executor instanceof mc.Player) {
                sendMessage(`§cCould not access the Ender Chest of ${targetPlayer.name}.`, executor);
            } else {
                executor.sendMessage(`§cCould not access the Ender Chest of ${targetPlayer.name}.`);
            }
            return;
        }

        const items: string[] = [];
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (item) {
                items.push(`§eS${i}: §f${item.typeId.replace('minecraft:', '')} §7x${item.amount}`);
            }
        }

        if (items.length === 0) {
            if (executor instanceof mc.Player) {
                sendMessage(`§6Ender Chest of ${targetPlayer.name}: §r§7(Empty)`, executor);
            } else {
                executor.sendMessage(`§6Ender Chest of ${targetPlayer.name}: §r§7(Empty)`);
            }
            return;
        }

        const itemsPerPage = 10;
        const totalPages = Math.ceil(items.length / itemsPerPage);
        let page = (pageArg || 1) - 1;
        if (page < 0 || page >= totalPages) {
            page = 0;
        }

        const startIndex = page * itemsPerPage;
        const pageItems = items.slice(startIndex, startIndex + itemsPerPage);

        let message = `§6EC Inv: ${targetPlayer.name} (Page ${page + 1}/${totalPages})§r\n`;
        message += pageItems.join('\n');

        if (executor instanceof mc.Player) {
            sendMessage(message, executor, { raw: true });
        } else {
            executor.sendMessage(message);
        }
    }
};

interface EcwipeCommandArgs {
    target?: string;
}

const ecwipeCommand: CustomCommand = {
    name: 'ecwipe',
    description: "Clears a player's Ender Chest.",
    category: 'Moderation',
    aliases: ['clearec', 'ecclear'],
    permissionLevel: 2,
    allowConsole: true,
    parameters: [{ name: 'target', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: EcwipeCommandArgs) => {
        let targetPlayer: mc.Player;
        const targetName = args.target;

        if (!targetName) {
            if (!(executor instanceof mc.Player)) {
                executor.sendMessage('§cYou must specify a target player when running this command from the console.');
                return;
            }
            targetPlayer = executor;
        } else {
            const potentialTarget = findPlayerByName(targetName);
            if (!potentialTarget) {
                if (executor instanceof mc.Player) {
                    sendMessage(`§cPlayer "${targetName}" not found or is offline.`, executor);
                    playSound(executor, 'note.bass');
                } else {
                    executor.sendMessage(`§cPlayer "${targetName}" not found or is offline.`);
                }
                return;
            }
            targetPlayer = potentialTarget;

            if (executor instanceof mc.Player) {
                const executorData = getPlayer(executor.id);
                const targetData = getPlayer(targetPlayer.id);

                if (!executorData || !targetData) {
                    sendMessage('§cCould not retrieve player data for permission check.', executor);
                    playSound(executor, 'note.bass');
                    return;
                }

                if (executorData.permissionLevel > targetData.permissionLevel) {
                    sendMessage(
                        '§cYou cannot clear the Ender Chest of a player with a higher rank than you.',
                        executor
                    );
                    playSound(executor, 'note.bass');
                    return;
                }
            }
        }

        try {
            // Try native API first
            const enderChestComp = targetPlayer.getComponent('minecraft:ender_chest') as
                | { container?: mc.Container }
                | undefined;
            const container = enderChestComp?.container;

            if (container) {
                container.clearAll();
            } else {
                // Fallback to command
                for (let i = 0; i < 27; i++) {
                    targetPlayer.runCommand(`replaceitem entity @s slot.enderchest ${i} air 1`);
                }
            }

            if (!(executor instanceof mc.Player) || targetPlayer.id !== executor.id) {
                if (executor instanceof mc.Player) {
                    sendMessage(`§aSuccessfully cleared the Ender Chest of ${targetPlayer.name}.`, executor);
                } else {
                    executor.sendMessage(`§aSuccessfully cleared the Ender Chest of ${targetPlayer.name}.`);
                }
                sendMessage('§eYour Ender Chest has been cleared by an admin.', targetPlayer);
                playSound(targetPlayer, 'random.orb');
            } else {
                sendMessage('§aYour Ender Chest has been cleared.', executor);
            }
            if (executor instanceof mc.Player) {
                playSound(executor, 'random.orb');
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                errorLog(`Failed to clear Ender Chest for ${targetPlayer.name}: ${error.stack}`);
            }
            if (executor instanceof mc.Player) {
                sendMessage('§cAn error occurred while trying to clear the Ender Chest.', executor);
                playSound(executor, 'note.bass');
            } else {
                executor.sendMessage('§cAn error occurred while trying to clear the Ender Chest.');
            }
        }
    }
};

interface CopyInvCommandArgs {
    target?: mc.Player[];
}

const copyinvCommand: CustomCommand = {
    name: 'copyinv',
    description: "Copies a player's inventory, replacing your own.",
    category: 'Moderation',
    permissionLevel: 2,
    parameters: [{ name: 'target', type: 'player' }],
    execute: (executor: CommandExecutor, args: CopyInvCommandArgs) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const { target } = args;

        if (!target || target.length === 0) {
            sendMessage('§cPlayer not found.', executor);
            return;
        }

        const targetPlayer = target[0];

        if (executor.id === targetPlayer.id) {
            sendMessage('§cYou cannot copy your own inventory.', executor);
            return;
        }

        try {
            const playerInv = (executor.getComponent('inventory') as mc.EntityInventoryComponent | undefined)
                ?.container;
            const targetInv = (targetPlayer.getComponent('inventory') as mc.EntityInventoryComponent | undefined)
                ?.container;

            if (!playerInv || !targetInv) {
                sendMessage('§cCould not access inventories.', executor);
                return;
            }

            playerInv.clearAll();

            for (let i = 0; i < targetInv.size; i++) {
                const item = targetInv.getItem(i);
                if (item) {
                    playerInv.setItem(i, item);
                }
            }
            sendMessage(`§aSuccessfully copied inventory from ${targetPlayer.name}.`, executor);
            playSound(executor, constants.soundTeleport);
        } catch (e: unknown) {
            sendMessage('§cFailed to copy inventory.', executor);
            if (e instanceof Error) {
                errorLog(`[/copyinv] Error: ${e.stack}`);
            }
        }
    }
};

export default [invseeCommand, ecseeCommand, ecwipeCommand, copyinvCommand];
