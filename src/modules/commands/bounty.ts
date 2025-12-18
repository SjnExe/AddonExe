import * as mc from '@minecraft/server';

import * as bountyManager from '@core/bountyManager.js';
import { getConfig } from '@core/configManager.js';
import { infoLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import {
    getOrCreatePlayer,
    getPlayerIdByName,
    getPlayerNameById,
    incrementPlayerBalance,
    loadPlayerData
} from '@core/playerDataManager.js';
import { parseCurrency, resolveTarget } from '@core/utils.js';

import { CommandExecutor, CustomCommand } from './commandManager.js';

function placeBounty(executor: mc.Player, targetId: string, targetName: string, amount: number) {
    const config = getConfig();
    if (!config) return;

    if (!config.economy.enabled) {
        sendMessage('§cThe economy system is currently disabled.', executor);
        return;
    }

    if (isNaN(amount) || amount < config.bounties.minimumBounty) {
        sendMessage(`§cInvalid amount. The minimum bounty is $${config.bounties.minimumBounty}.`, executor);
        return;
    }

    const pData = getOrCreatePlayer(executor);
    if (pData.balance < amount) {
        sendMessage('§cYou do not have enough money for this bounty.', executor);
        return;
    }

    // Verify target exists
    const targetData = loadPlayerData(targetId);
    if (!targetData) {
        sendMessage("§cCould not find the target player's data.", executor);
        return;
    }

    infoLog(`[Bounty] Deducting ${amount} from ${executor.name} (${executor.id})`);
    incrementPlayerBalance(executor.id, -amount);
    bountyManager.incrementBounty(targetId, amount);

    sendMessage(`§aYou have placed a bounty of §e$${amount}§a on ${targetName}.`, executor);
    mc.world.sendMessage(`§cSomeone has placed a bounty of §e$${amount}§c on ${targetName}!`);
}

// --- Online Commands ---

const bountyCommand: CustomCommand = {
    name: 'bounty',
    description: 'Place a bounty on a player.',
    category: 'Economy',
    aliases: ['setbounty', 'addbounty', '+bounty', 'abounty'],
    permissionLevel: 1024,
    parameters: [
        { name: 'target', type: 'string' },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;
        const targetName = args.target as string;
        const amountStr = args.amount as string;

        if (!targetName) return sendMessage('§cPlease specify a player.', executor);
        if (!amountStr) return sendMessage('§cUsage: /bounty <player> <amount>', executor);

        // Resolve
        const targets = resolveTarget(targetName, executor);
        const target = targets[0];
        if (!target) return sendMessage('§cPlayer not found.', executor);

        const amount = parseCurrency(amountStr);
        if (isNaN(amount) || amount <= 0) return sendMessage('§cInvalid amount.', executor);

        placeBounty(executor, target.id, target.name, amount);
    }
};

const removeBountyCommand: CustomCommand = {
    name: 'removebounty',
    aliases: ['rbounty', 'delbounty', '-bounty'],
    description: 'Removes a bounty from a player using your money.',
    category: 'Economy',
    permissionLevel: 1024,
    parameters: [
        { name: 'target', type: 'string' },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;
        const targetName = args.target as string;
        const amountStr = args.amount as string;

        if (!targetName) return sendMessage('§cPlease specify a player.', executor);
        if (!amountStr) return sendMessage('§cPlease specify an amount.', executor);

        // Resolve
        const targets = resolveTarget(targetName, executor);
        const target = targets[0];
        if (!target) return sendMessage('§cPlayer not found.', executor);

        const amount = parseCurrency(amountStr);
        if (isNaN(amount) || amount <= 0) return sendMessage('§cInvalid amount.', executor);

        const targetBounty = bountyManager.getBounty(target.id);

        if (!targetBounty) return sendMessage('§cThis player has no bounty on them.', executor);
        // Explicit check to satisfy TS
        if (targetBounty && amount > targetBounty.amount)
            return sendMessage(`§cAmount exceeds bounty ($${targetBounty.amount.toFixed(2)}).`, executor);

        const pData = getOrCreatePlayer(executor);
        if (pData.balance < amount) return sendMessage('§cYou dont have enough money.', executor);

        incrementPlayerBalance(executor.id, -amount);
        bountyManager.incrementBounty(target.id, -amount);
        sendMessage(`§aYou have removed $${amount.toFixed(2)} from ${target.name}'s bounty.`, executor);
    }
};

// --- Offline Commands ---

const oBountyCommand: CustomCommand = {
    name: 'obounty',
    aliases: ['offlinebounty'],
    description: 'Place a bounty on an offline player.',
    category: 'Economy',
    permissionLevel: 1024,
    hidden: true,
    parameters: [
        { name: 'target', type: 'string' },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;
        const targetName = args.target as string;
        const amountStr = args.amount as string;

        if (!targetName) return sendMessage('§cPlease specify a player name.', executor);
        if (!amountStr) return sendMessage('§cUsage: /obounty <player> <amount>', executor);

        const amount = parseCurrency(amountStr);
        if (isNaN(amount) || amount <= 0) return sendMessage('§cInvalid amount.', executor);

        const targetId = getPlayerIdByName(targetName);
        if (!targetId) return sendMessage(`§cPlayer "${targetName}" never joined.`, executor);
        const displayName = getPlayerNameById(targetId) || targetName;

        placeBounty(executor, targetId, displayName, amount);
    }
};

const oRemoveBountyCommand: CustomCommand = {
    name: 'oremovebounty',
    aliases: ['offlineremovebounty'],
    description: 'Removes a bounty from an offline player.',
    category: 'Economy',
    permissionLevel: 1024,
    hidden: true,
    parameters: [
        { name: 'target', type: 'string' },
        { name: 'amount', type: 'string' }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;
        const targetName = args.target as string;
        const amountStr = args.amount as string;

        if (!targetName) return sendMessage('§cPlease specify a player name.', executor);
        if (!amountStr) return sendMessage('§cPlease specify an amount.', executor);

        const amount = parseCurrency(amountStr);
        if (isNaN(amount) || amount <= 0) return sendMessage('§cInvalid amount.', executor);

        const targetId = getPlayerIdByName(targetName);
        if (!targetId) return sendMessage(`§cPlayer "${targetName}" never joined.`, executor);
        const displayName = getPlayerNameById(targetId) || targetName;

        const targetBounty = bountyManager.getBounty(targetId);
        if (!targetBounty) return sendMessage('§cThis player has no bounty on them.', executor);
        if (targetBounty && amount > targetBounty.amount)
            return sendMessage(`§cAmount exceeds bounty ($${targetBounty.amount.toFixed(2)}).`, executor);

        const pData = getOrCreatePlayer(executor);
        if (pData.balance < amount) return sendMessage('§cYou dont have enough money.', executor);

        incrementPlayerBalance(executor.id, -amount);
        bountyManager.incrementBounty(targetId, -amount);
        sendMessage(`§aYou have removed $${amount.toFixed(2)} from ${displayName}'s bounty.`, executor);
    }
};

// --- List Command (Hybrid) ---

const listBountyCommand: CustomCommand = {
    name: 'listbounty',
    aliases: ['lbounty', 'bounties', 'bountylist', 'showbounties', 'hitlist'],
    description: "Lists all active bounties or a specific player's bounty.",
    category: 'Economy',
    permissionLevel: 1024,
    allowConsole: true,
    parameters: [{ name: 'target', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const targetName = args.target as string | undefined;

        if (targetName) {
            // Check online match first, else use name directly?
            let targetId: string | undefined;
            let targetDisplayName = targetName;

            if (executor instanceof mc.Player) {
                const targets = resolveTarget(targetName, executor);
                if (targets.length > 0) {
                    targetId = targets[0].id;
                    targetDisplayName = targets[0].name;
                } else {
                    // Try offline lookup if online failed
                    targetId = getPlayerIdByName(targetName);
                    if (targetId) targetDisplayName = getPlayerNameById(targetId) || targetName;
                }
            } else {
                targetId = getPlayerIdByName(targetName);
            }

            if (!targetId) {
                if (executor instanceof mc.Player) sendMessage('§cPlayer not found (Online or Offline).', executor);
                else executor.sendMessage('§cPlayer not found.');
                return;
            }

            const bounty = bountyManager.getBounty(targetId);
            if (!bounty) {
                if (executor instanceof mc.Player)
                    sendMessage(`§aThere is no bounty on ${targetDisplayName}.`, executor);
                else executor.sendMessage(`§aThere is no bounty on ${targetDisplayName}.`);
                return;
            }
            if (executor instanceof mc.Player)
                sendMessage(`§aBounty on ${targetDisplayName}: §e$${bounty.amount.toFixed(2)}`, executor);
            else executor.sendMessage(`§aBounty on ${targetDisplayName}: §e$${bounty.amount.toFixed(2)}`);
        } else {
            let message = '§a--- All Player Bounties ---\n';
            const allBounties = Array.from(bountyManager.getAllBounties().values());

            if (allBounties.length === 0) {
                message += '§7No active bounties.';
            } else {
                allBounties.sort((a, b) => b.amount - a.amount);
                for (const bounty of allBounties) {
                    if (bounty) {
                        message += `§e${bounty.name}§r: $${bounty.amount.toFixed(2)}\n`;
                    }
                }
            }
            if (executor instanceof mc.Player) sendMessage(message.trim(), executor);
            else executor.sendMessage(message.trim());
        }
    }
};

const oListBountyCommand: CustomCommand = {
    name: 'olistbounty',
    aliases: ['offlinelistbounty'],
    description: "Checks an offline player's bounty.",
    category: 'Economy',
    permissionLevel: 1024,
    allowConsole: true,
    hidden: true,
    parameters: [{ name: 'target', type: 'string' }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const targetName = args.target as string;
        if (!targetName) {
            if (executor instanceof mc.Player) sendMessage('§cPlease specify a player name.', executor);
            else executor.sendMessage('§cPlease specify a player name.');
            return;
        }

        const targetId = getPlayerIdByName(targetName);
        if (!targetId) {
            if (executor instanceof mc.Player) sendMessage(`§cPlayer "${targetName}" never joined.`, executor);
            else executor.sendMessage(`§cPlayer "${targetName}" never joined.`);
            return;
        }
        const displayName = getPlayerNameById(targetId) || targetName;

        const bounty = bountyManager.getBounty(targetId);
        if (!bounty) {
            if (executor instanceof mc.Player) sendMessage(`§aThere is no bounty on ${displayName}.`, executor);
            else executor.sendMessage(`§aThere is no bounty on ${displayName}.`);
            return;
        }

        if (executor instanceof mc.Player)
            sendMessage(`§aBounty on ${displayName}: §e$${bounty.amount.toFixed(2)}`, executor);
        else executor.sendMessage(`§aBounty on ${displayName}: §e$${bounty.amount.toFixed(2)}`);
    }
};

export default [
    bountyCommand,
    removeBountyCommand,
    listBountyCommand,
    oBountyCommand,
    oRemoveBountyCommand,
    oListBountyCommand
];
