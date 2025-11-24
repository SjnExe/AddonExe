import { commandManager } from './commandManager.js';
import * as bountyManager from '../../core/bountyManager.js';
import { getOrCreatePlayer, incrementPlayerBalance } from '../../core/playerDataManager.js';
import { getConfig } from '../../core/configManager.js';
import * as mc from '@minecraft/server';
import { findPlayerByName } from '../../core/playerCache.js';

commandManager.register({
    name: 'removebounty',
    aliases: ['rbounty', 'delbounty', '-bounty'],
    description: 'Removes a bounty from a player using your money.',
    category: 'Bounty System',
    permissionLevel: 1024, // Everyone
    parameters: [
        { name: 'amount', type: 'float', description: 'The amount to remove from the bounty.' },
        { name: 'target', type: 'player', description: 'The player to remove the bounty from. Defaults to yourself.', optional: true }
    ],
    execute: (player, args) => {
        const { target, amount } = args;
        let targetPlayer = player;

        if (target && target.length > 0) {
            targetPlayer = target[0];
        }

        if (isNaN(amount) || amount <= 0) {
            player.sendMessage('§cInvalid amount. Please enter a positive number.');
            return;
        }

        const targetBounty = bountyManager.getBounty(targetPlayer.id);
        if (!targetBounty) {
            player.sendMessage('§cThis player has no bounty on them.');
            return;
        }

        if (amount > targetBounty.amount) {
            player.sendMessage(`§cYou cannot remove more than the bounty amount ($${targetBounty.amount.toFixed(2)}).`);
            return;
        }

        const pData = getOrCreatePlayer(player);
        if (pData.balance < amount) {
            player.sendMessage('§cYou dont have enough money for this!');
            return;
        }

        incrementPlayerBalance(player.id, -amount);
        bountyManager.incrementBounty(targetPlayer.id, -amount);
        player.sendMessage(`§aYou have removed $${amount.toFixed(2)} from ${targetPlayer.name}'s bounty.`);
    }
});

function placeBounty(player, targetPlayer, amount) {
    const config = getConfig();
    if (!config.economy.enabled) {
        player.sendMessage('§cThe economy system is currently disabled.');
        return;
    }
    if (!targetPlayer) {
        player.sendMessage('§cPlayer not found.');
        return;
    }
    if (isNaN(amount) || amount < config.bounties.minimumBounty) {
        player.sendMessage(`§cInvalid amount. The minimum bounty is $${config.bounties.minimumBounty}.`);
        return;
    }

    const pData = getOrCreatePlayer(player);
    if (pData.balance < amount) {
        player.sendMessage('§cYou do not have enough money for this bounty.');
        return;
    }

    // Ensure the target player has data, which is needed by the bounty manager
    const targetData = getOrCreatePlayer(targetPlayer);
    if (!targetData) {
        player.sendMessage('§cCould not find the target player\'s data. They may need to join the server first.');
        return;
    }

    incrementPlayerBalance(player.id, -amount);
    bountyManager.incrementBounty(targetPlayer.id, amount);

    player.sendMessage(`§aYou have placed a bounty of §e$${amount}§a on ${targetPlayer.name}.`);
    mc.world.sendMessage(`§cSomeone has placed a bounty of §e$${amount}§c on ${targetPlayer.name}!`);
}

commandManager.register({
    name: 'bounty',
    description: 'Place a bounty on a player.',
    aliases: ['setbounty', 'addbounty', '+bounty', 'abounty'],
    category: 'Bounty System',
    permissionLevel: 1024, // Everyone
    parameters: [
        { name: 'target', type: 'player', description: 'The player to place a bounty on.' },
        { name: 'amount', type: 'int', description: 'The amount of the bounty.' }
    ],
    execute: (player, args) => {
        if (Array.isArray(args)) { // Chat command
            if (args.length < 2) {
                player.sendMessage('§cUsage: !bounty <playerName> <amount>');
                return;
            }
            const targetPlayer = findPlayerByName(args[0]);
            const amount = parseInt(args[1]);
            placeBounty(player, targetPlayer, amount);
        } else { // Slash command
            const { target, amount } = args;
            if (!target || target.length === 0) {
                player.sendMessage('§cPlayer not found.');
                return;
            }
            placeBounty(player, target[0], amount);
        }
    }
});

commandManager.register({
    name: 'listbounty',
    aliases: ['lbounty', 'bounties', 'bountylist', 'showbounties', 'hitlist'],
    description: 'Lists all active bounties or a specific player\'s bounty.',
    category: 'Bounty System',
    permissionLevel: 1024, // Everyone
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to check the bounty of.', optional: true }
    ],
    execute: (player, args) => {
        if (args.target && args.target.length > 0) {
            const targetPlayer = args.target[0];
            const bounty = bountyManager.getBounty(targetPlayer.id);
            if (!bounty) {
                player.sendMessage(`§aThere is no bounty on ${targetPlayer.name}.`);
                return;
            }
            player.sendMessage(`§aBounty on ${targetPlayer.name}: §e$${bounty.amount.toFixed(2)}`);
        } else {
            let message = '§a--- All Player Bounties ---\n';
            const allBounties = Array.from(bountyManager.getAllBounties().values());

            if (allBounties.length === 0) {
                message += '§7No active bounties.';
            } else {
                allBounties.sort((a, b) => b.amount - a.amount);
                for (const bounty of allBounties) {
                    message += `§e${bounty.name}§r: $${bounty.amount.toFixed(2)}\n`;
                }
            }
            player.sendMessage(message.trim());
        }
    }
});
