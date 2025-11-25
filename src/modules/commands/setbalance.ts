import {
    Player
} from '@minecraft/server';
import {
    CustomCommand
} from './commandManager.js';
import {
    getOrCreatePlayer,
    setPlayerBalance,
    incrementPlayerBalance
} from '../../core/playerDataManager.js';
import {
    sendMessage
} from '../../core/messaging.js';
import {
    formatCurrency
} from '../../core/utils.js';
import * as mc from '@minecraft/server';
const setBalanceCommand: CustomCommand = {
    name: 'setbalance',
    aliases: ['setbal', 'setmoney'],
    description: "Sets a player's balance to a specific amount. (Admin and above)",
    category: 'Economy',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [{
        name: 'target',
        type: 'player'
    }, {
        name: 'amount',
        type: 'float'
    }],
    execute: (player, args) => {
        const {
            target,
            amount
        } = args;
        if (!target || (target as Player[]).length === 0) {
            player.sendMessage('§cPlayer not found.');
            return;
        }
        const targetPlayer = (target as Player[])[0];
        if (isNaN(amount as number) || (amount as number) < 0) {
            player.sendMessage('§cInvalid amount. Please enter a non-negative number.');
            return;
        }
        setPlayerBalance(targetPlayer.id, amount as number);
        player.sendMessage(`§aSuccessfully set ${targetPlayer.name}'s balance to §e${formatCurrency(amount as number)}§a.`);
        sendMessage(`§aYour balance has been set to §e${formatCurrency(amount as number)}§a by an administrator.`, targetPlayer);
    }
};
const addBalanceCommand: CustomCommand = {
    name: 'addbalance',
    aliases: ['addbal', '+bal'],
    description: "Adds a specific amount to a player's balance. (Admin and above)",
    category: 'Economy',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [{
        name: 'target',
        type: 'player'
    }, {
        name: 'amount',
        type: 'float'
    }],
    execute: (player, args) => {
        const {
            target,
            amount
        } = args;
        if (!target || (target as Player[]).length === 0) {
            player.sendMessage('§cPlayer not found.');
            return;
        }
        const targetPlayer = (target as Player[])[0];
        if (isNaN(amount as number) || (amount as number) <= 0) {
            player.sendMessage('§cInvalid amount. Please enter a positive number.');
            return;
        }
        incrementPlayerBalance(targetPlayer.id, amount as number);
        const pData = getOrCreatePlayer(targetPlayer);
        player.sendMessage(`§aSuccessfully added §e${formatCurrency(amount as number)}§a to ${targetPlayer.name}'s balance. New balance: §e${formatCurrency(pData.balance)}§a.`);
        sendMessage(`§aAn administrator has added §e${formatCurrency(amount as number)}§a to your balance.`, targetPlayer);
    }
};
const removeBalanceCommand: CustomCommand = {
    name: 'removebalance',
    aliases: ['removebal', '-bal', 'rembal', 'delbal'],
    description: "Removes a specific amount from a player's balance. (Admin and above)",
    category: 'Economy',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [{
        name: 'target',
        type: 'player'
    }, {
        name: 'amount',
        type: 'float'
    }],
    execute: (player, args) => {
        const {
            target,
            amount
        } = args;
        if (!target || (target as Player[]).length === 0) {
            player.sendMessage('§cPlayer not found.');
            return;
        }
        const targetPlayer = (target as Player[])[0];
        if (isNaN(amount as number) || (amount as number) <= 0) {
            player.sendMessage('§cInvalid amount. Please enter a positive number.');
            return;
        }
        const pData = getOrCreatePlayer(targetPlayer);
        if (pData.balance < (amount as number)) {
            player.sendMessage(`§cCannot remove §e${formatCurrency(amount as number)}§c. ${targetPlayer.name}'s balance is only §e${formatCurrency(pData.balance)}§c.`);
            return;
        }
        incrementPlayerBalance(targetPlayer.id, -(amount as number));
        const newPData = getOrCreatePlayer(targetPlayer);
        player.sendMessage(`§aSuccessfully removed §e${formatCurrency(amount as number)}§a from ${targetPlayer.name}'s balance. New balance: §e${formatCurrency(newPData.balance)}§a.`);
        sendMessage(`§cAn administrator has removed §e${formatCurrency(amount as number)}§c from your balance.`, targetPlayer);
    }
};
export default [setBalanceCommand, addBalanceCommand, removeBalanceCommand];