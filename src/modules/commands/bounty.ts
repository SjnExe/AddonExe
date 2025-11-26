import * as mc from '@minecraft/server';

import * as bountyManager from '../../core/bountyManager.js';
import { getConfig } from '../../core/configManager.js';
import { findPlayerByName } from '../../core/playerCache.js';
import { getOrCreatePlayer, incrementPlayerBalance } from '../../core/playerDataManager.js';

import { CustomCommand, CommandExecutor } from './commandManager.js';

function placeBounty(player: mc.Player, targetPlayer: mc.Player, amount: number) {
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

    const targetData = getOrCreatePlayer(targetPlayer);
    if (!targetData) {
        player.sendMessage("§cCould not find the target player's data. They may need to join the server first.");
        return;
    }

    incrementPlayerBalance(player.id, -amount);
    bountyManager.incrementBounty(targetPlayer.id, amount);

    player.sendMessage(`§aYou have placed a bounty of §e$${amount}§a on ${targetPlayer.name}.`);
    mc.world.sendMessage(`§cSomeone has placed a bounty of §e$${amount}§c on ${targetPlayer.name}!`);
}

interface RemoveBountyArgs {
    target?: mc.Player[];
    amount?: number;
}

const removeBountyCommand: CustomCommand = {
    name: 'removebounty',
    aliases: ['rbounty', 'delbounty', '-bounty'],
    description: 'Removes a bounty from a player using your money.',
    permissionLevel: 1024,
    parameters: [
        { name: 'amount', type: 'float' },
        { name: 'target', type: 'player', optional: true }
    ],
    execute: (executor: CommandExecutor, args: RemoveBountyArgs) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const { target, amount } = args;
        let targetPlayer = executor;

        if (target && target.length > 0) {
            targetPlayer = target[0];
        }

        if (amount === undefined || isNaN(amount) || amount <= 0) {
            executor.sendMessage('§cInvalid amount. Please enter a positive number.');
            return;
        }

        const targetBounty = bountyManager.getBounty(targetPlayer.id);
        if (!targetBounty) {
            executor.sendMessage('§cThis player has no bounty on them.');
            return;
        }

        if (amount > targetBounty.amount) {
            executor.sendMessage(
                `§cYou cannot remove more than the bounty amount ($${targetBounty.amount.toFixed(2)}).`
            );
            return;
        }

        const pData = getOrCreatePlayer(executor);
        if (pData.balance < amount) {
            executor.sendMessage('§cYou dont have enough money for this!');
            return;
        }

        incrementPlayerBalance(executor.id, -amount);
        bountyManager.incrementBounty(targetPlayer.id, -amount);
        executor.sendMessage(`§aYou have removed $${amount.toFixed(2)} from ${targetPlayer.name}'s bounty.`);
    }
};

interface BountyCommandArgs {
    target?: mc.Player[];
    amount?: number;
}

const bountyCommand: CustomCommand = {
    name: 'bounty',
    description: 'Place a bounty on a player.',
    aliases: ['setbounty', 'addbounty', '+bounty', 'abounty'],
    permissionLevel: 1024,
    parameters: [
        { name: 'target', type: 'player' },
        { name: 'amount', type: 'int' }
    ],
    execute: (executor: CommandExecutor, args: BountyCommandArgs) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const { target, amount } = args;
        if (!target || target.length === 0) {
            executor.sendMessage('§cPlayer not found.');
            return;
        }
        if (amount === undefined) {
            executor.sendMessage('§cUsage: /bounty <playerName> <amount>');
            return;
        }
        placeBounty(executor, target[0], amount);
    }
};

interface ListBountyArgs {
    target?: mc.Player[];
}

const listBountyCommand: CustomCommand = {
    name: 'listbounty',
    aliases: ['lbounty', 'bounties', 'bountylist', 'showbounties', 'hitlist'],
    description: "Lists all active bounties or a specific player's bounty.",
    permissionLevel: 1024,
    allowConsole: true,
    parameters: [{ name: 'target', type: 'player', optional: true }],
    execute: (executor: CommandExecutor, args: ListBountyArgs) => {
        const targetPlayers = args.target;
        if (targetPlayers && targetPlayers.length > 0) {
            const targetPlayer = targetPlayers[0];
            const bounty = bountyManager.getBounty(targetPlayer.id);
            if (!bounty) {
                executor.sendMessage(`§aThere is no bounty on ${targetPlayer.name}.`);
                return;
            }
            executor.sendMessage(`§aBounty on ${targetPlayer.name}: §e$${bounty.amount.toFixed(2)}`);
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
            executor.sendMessage(message.trim());
        }
    }
};

export default [removeBountyCommand, bountyCommand, listBountyCommand];
