import { commandManager } from './commandManager.js';
import { createRequest, acceptRequest, denyRequest, cancelRequest, getOutgoingRequest, getIncomingRequest } from '../../core/tpaManager.js';
import { getConfig } from '../../core/configManager.js';
import { playSound } from '../../core/utils.js';

commandManager.register({
    name: 'tpa',
    description: 'Sends a request to teleport to another player.',
    aliases: ['tprequest', 'asktp', 'requesttp'],
    category: 'TPA System',
    permissionLevel: 1024, // Everyone
    hasCooldown: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to send the request to.' }
    ],
    execute: (player, args) => {
        const { target } = args;
        const config = getConfig();
        if (!config.tpa.enabled) {
            player.sendMessage('§cThe TPA system is currently disabled.');
            return;
        }

        if (!target || target.length === 0) {
            player.sendMessage('§cPlayer not found.');
            return;
        }

        const targetPlayer = target[0];

        if (targetPlayer.id === player.id) {
            player.sendMessage('§cYou cannot send a TPA request to yourself.');
            return;
        }

        const result = createRequest(player, targetPlayer, 'tpa');

        if (result.success) {
            player.sendMessage(`§aTPA request sent to ${targetPlayer.name}. They have ${config.tpa.requestTimeoutSeconds} seconds to accept.`);
            targetPlayer.sendMessage(`§a${player.name} has requested to teleport to you. Type §e/tpaccept§a to accept or §e/tpadeny§a to deny.`);
        } else {
            player.sendMessage(`§c${result.message}`);
        }
    }
});

commandManager.register({
    name: 'tpahere',
    description: 'Requests another player to teleport to you.',
    aliases: ['tphere', 'tprequesthere'],
    category: 'TPA System',
    permissionLevel: 1024, // Everyone
    hasCooldown: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to send the request to.' }
    ],
    execute: (player, args) => {
        const { target } = args;
        const config = getConfig();
        if (!config.tpa.enabled) {
            player.sendMessage('§cThe TPA system is currently disabled.');
            return;
        }

        if (!target || target.length === 0) {
            player.sendMessage('§cPlayer not found.');
            return;
        }

        const targetPlayer = target[0];

        if (targetPlayer.id === player.id) {
            player.sendMessage('§cYou cannot send a TPA request to yourself.');
            return;
        }

        const result = createRequest(player, targetPlayer, 'tpahere');

        if (result.success) {
            player.sendMessage(`§aTPA Here request sent to ${targetPlayer.name}. They have ${config.tpa.requestTimeoutSeconds} seconds to accept.`);
            targetPlayer.sendMessage(`§a${player.name} has requested for you to teleport to them. Type §e/tpaccept§a to accept or §e/tpadeny§a to deny.`);
        } else {
            player.sendMessage(`§c${result.message}`);
        }
    }
});

commandManager.register({
    name: 'tpaccept',
    aliases: ['tpyes', 'tpac'],
    description: 'Accepts an incoming TPA request.',
    category: 'TPA System',
    permissionLevel: 1024, // Everyone
    parameters: [
        { name: 'player', type: 'player', description: 'The player whose request you want to accept.', optional: true }
    ],
    execute: (player, args) => {
        const config = getConfig();
        if (!config.tpa.enabled) {
            player.sendMessage('§cThe TPA system is currently disabled.');
            return;
        }

        const targetPlayer = args.player ? args.player[0] : null;
        acceptRequest(player, targetPlayer?.name);
    }
});

commandManager.register({
    name: 'tpadeny',
    aliases: ['tpno', 'tpdeny'],
    description: 'Denies an incoming TPA request.',
    category: 'TPA System',
    permissionLevel: 1024, // Everyone
    parameters: [
        { name: 'player', type: 'player', description: 'The player whose request you want to deny.', optional: true }
    ],
    execute: (player, args) => {
        const config = getConfig();
        if (!config.tpa.enabled) {
            player.sendMessage('§cThe TPA system is currently disabled.');
            return;
        }

        const targetPlayer = args.player ? args.player[0] : null;
        denyRequest(player, targetPlayer?.name);
    }
});

commandManager.register({
    name: 'tpacancel',
    description: 'Cancels your outgoing TPA request.',
    category: 'TPA System',
    permissionLevel: 1024, // Everyone
    parameters: [],
    execute: (player, args) => {
        const config = getConfig();
        if (!config.tpa.enabled) {
            player.sendMessage('§cThe TPA system is currently disabled.');
            return;
        }

        cancelRequest(player);
    }
});

commandManager.register({
    name: 'tpastatus',
    description: 'Checks the status of your outgoing and incoming TPA requests.',
    category: 'TPA System',
    permissionLevel: 1024, // Everyone
    parameters: [],
    execute: (player, args) => {
        const outgoing = getOutgoingRequest(player);
        const incoming = getIncomingRequest(player);

        let statusMessage = '§a--- TPA Status ---\n';
        let foundRequest = false;

        if (outgoing) {
            foundRequest = true;
            const typeText = outgoing.type === 'tpa' ? 'teleport to them' : 'teleport them to you';
            statusMessage += `§eOutgoing Request:§r You have sent a request to §b${outgoing.targetPlayerName}§r to ${typeText}.\n`;
            statusMessage += '§7(Use /tpacancel to cancel this request)\n';
        }

        if (incoming) {
            foundRequest = true;
            const typeText = incoming.type === 'tpa' ? 'teleport to you' : 'teleport you to them';
            statusMessage += `§eIncoming Request:§r You have a request from §b${incoming.sourcePlayerName}§r to ${typeText}.\n`;
            statusMessage += '§7(Use /tpaccept or /tpadeny to respond)\n';
        }

        if (!foundRequest) {
            statusMessage += '§fYou have no pending TPA requests.';
        }

        player.sendMessage(statusMessage.trim());
        playSound(player, 'random.orb');
    }
});
