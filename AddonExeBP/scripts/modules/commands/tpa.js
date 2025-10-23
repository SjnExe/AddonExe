import { commandManager } from './commandManager.js';
import { createRequest, acceptRequest, denyRequest, cancelRequest, getOutgoingRequest, getIncomingRequest } from '../../core/tpaManager.js';
import { getConfig } from '../../core/configManager.js';
import { playSound } from '../../core/utils.js';
import { addTpaBlockedPlayer, removeTpaBlockedPlayer, setTpaRequestsDisabled } from '../../core/playerDataManager.js';
import { sendMessage } from '../../core/messaging.js';
import { constants } from '../../core/constants.js';

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
    /**
     * Executes the /tpa command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} args.target The target player array.
     */
    execute: (player, args) => {
        const { target } = args;
        const config = getConfig();
        if (!config.tpa.enabled) {
            sendMessage(constants.tpaDisabled, player);
            return;
        }

        if (!target || target.length === 0) {
            sendMessage('§cPlayer not found.', player);
            return;
        }

        const targetPlayer = target[0];

        if (targetPlayer.id === player.id) {
            sendMessage('§cYou cannot send a TPA request to yourself.', player);
            return;
        }

        const result = createRequest(player, targetPlayer, 'tpa');

        if (result.success) {
            sendMessage(`§aTPA request sent to ${targetPlayer.name}. They have ${config.tpa.requestTimeoutSeconds} seconds to accept.`, player);
            sendMessage(`§a${player.name} has requested to teleport to you. Type §e/tpaccept§a to accept or §e/tpadeny§a to deny.`, targetPlayer);
        } else {
            sendMessage(`§c${result.message}`, player);
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
    cooldownId: 'tpa',
    parameters: [
        { name: 'target', type: 'player', description: 'The player to send the request to.' }
    ],
    /**
     * Executes the /tpahere command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} args.target The target player array.
     */
    execute: (player, args) => {
        const { target } = args;
        const config = getConfig();
        if (!config.tpa.enabled) {
            sendMessage(constants.tpaDisabled, player);
            return;
        }

        if (!target || target.length === 0) {
            sendMessage('§cPlayer not found.', player);
            return;
        }

        const targetPlayer = target[0];

        if (targetPlayer.id === player.id) {
            sendMessage('§cYou cannot send a TPA request to yourself.', player);
            return;
        }

        const result = createRequest(player, targetPlayer, 'tpahere');

        if (result.success) {
            sendMessage(`§aTPA Here request sent to ${targetPlayer.name}. They have ${config.tpa.requestTimeoutSeconds} seconds to accept.`, player);
            sendMessage(`§a${player.name} has requested for you to teleport to them. Type §e/tpaccept§a to accept or §e/tpadeny§a to deny.`, targetPlayer);
        } else {
            sendMessage(`§c${result.message}`, player);
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
    /**
     * Executes the /tpaccept command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} [args.player] The optional target player array.
     */
    execute: (player, args) => {
        const config = getConfig();
        if (!config.tpa.enabled) {
            sendMessage(constants.tpaDisabled, player);
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
    /**
     * Executes the /tpadeny command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} [args.player] The optional target player array.
     */
    execute: (player, args) => {
        const config = getConfig();
        if (!config.tpa.enabled) {
            sendMessage(constants.tpaDisabled, player);
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
    /**
     * Executes the /tpacancel command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     */
    execute: (player) => {
        const config = getConfig();
        if (!config.tpa.enabled) {
            sendMessage(constants.tpaDisabled, player);
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
    /**
     * Executes the /tpastatus command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     */
    execute: (player) => {
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

        sendMessage(statusMessage.trim(), player, { raw: true });
        playSound(player, constants.soundTeleport);
    }
});

commandManager.register({
    name: 'tpastop',
    aliases: ['tpstop', 'tpablock', 'tpblock'],
    description: 'Disables TPA requests or blocks a specific player.',
    category: 'TPA System',
    permissionLevel: 1024,
    parameters: [
        { name: 'player', type: 'player', description: 'The player to block from sending TPA requests.', optional: true }
    ],
    /**
     * Executes the /tpastop command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} [args.player] The optional target player array.
     */
    execute: (player, args) => {
        const target = args.player ? args.player[0] : null;

        if (target) {
            // Block a specific player
            addTpaBlockedPlayer(player.id, target.id);
            sendMessage(`§aYou have blocked ${target.name} from sending you TPA requests.`, player);
        } else {
            // Disable all TPA requests
            setTpaRequestsDisabled(player.id, true);
            sendMessage('§aYou have disabled all incoming TPA requests.', player);
        }
    }
});

commandManager.register({
    name: 'tpastart',
    aliases: ['tpstart', 'tpaunblock', 'tpunblock'],
    description: 'Enables TPA requests or unblocks a specific player.',
    category: 'TPA System',
    permissionLevel: 1024,
    parameters: [
        { name: 'player', type: 'player', description: 'The player to unblock from sending TPA requests.', optional: true }
    ],
    /**
     * Executes the /tpastart command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} [args.player] The optional target player array.
     */
    execute: (player, args) => {
        const target = args.player ? args.player[0] : null;

        if (target) {
            // Unblock a specific player
            removeTpaBlockedPlayer(player.id, target.id);
            sendMessage(`§aYou have unblocked ${target.name}. They can now send you TPA requests.`, player);
        } else {
            // Enable all TPA requests
            setTpaRequestsDisabled(player.id, false);
            sendMessage('§aYou have enabled all incoming TPA requests.', player);
        }
    }
});
