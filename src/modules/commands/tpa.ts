import * as mc from '@minecraft/server';

import { getConfig } from '../../core/configManager.js';
import { constants } from '../../core/constants.js';
import { sendMessage } from '../../core/messaging.js';
import { findPlayerByName } from '../../core/playerCache.js';
import { addTpaBlockedPlayer, removeTpaBlockedPlayer, setTpaRequestsDisabled } from '../../core/playerDataManager.js';
import {
    createRequest,
    acceptRequest,
    denyRequest,
    cancelRequest,
    getOutgoingRequest,
    getIncomingRequest
} from '../../core/tpaManager.js';
import { playSound } from '../../core/utils.js';

import { CustomCommand, CommandExecutor } from './commandManager.js';

const tpaCommand: CustomCommand = {
    name: 'tpa',
    description: 'Sends a request to teleport to another player.',
    aliases: ['tprequest', 'asktp', 'requesttp'],
    permissionLevel: 1024,
    hasCooldown: true,
    parameters: [{ name: 'target', type: 'string' }],
    execute: (executor: CommandExecutor, args: Record<string, any>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const { target } = args as { target: string };
        const config = getConfig();
        if (!config.tpa.enabled) {
            sendMessage(constants.tpaDisabled, executor);
            return;
        }

        if (!target) {
            sendMessage('§cPlease specify a player.', executor);
            return;
        }

        const targetPlayer = findPlayerByName(target);

        if (!targetPlayer) {
            sendMessage('§cPlayer not found.', executor);
            return;
        }

        if (targetPlayer.id === executor.id) {
            sendMessage('§cYou cannot send a TPA request to yourself.', executor);
            return;
        }

        const result = createRequest(executor, targetPlayer, 'tpa');

        if (result.success) {
            sendMessage(
                `§aTPA request sent to ${targetPlayer.name}. They have ${config.tpa.requestTimeoutSeconds} seconds to accept.`,
                executor
            );
            sendMessage(
                `§a${executor.name} has requested to teleport to you. Type §e/tpaccept§a to accept or §e/tpadeny§a to deny.`,
                targetPlayer
            );
        } else {
            sendMessage(`§c${result.message}`, executor);
        }
    }
};

const tpaHereCommand: CustomCommand = {
    name: 'tpahere',
    description: 'Requests another player to teleport to you.',
    aliases: ['tphere', 'tprequesthere'],
    permissionLevel: 1024,
    hasCooldown: true,
    cooldownId: 'tpa',
    parameters: [{ name: 'target', type: 'string' }],
    execute: (executor: CommandExecutor, args: Record<string, any>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const { target } = args as { target: string };
        const config = getConfig();
        if (!config.tpa.enabled) {
            sendMessage(constants.tpaDisabled, executor);
            return;
        }

        if (!target) {
            sendMessage('§cPlease specify a player.', executor);
            return;
        }

        const targetPlayer = findPlayerByName(target);

        if (!targetPlayer) {
            sendMessage('§cPlayer not found.', executor);
            return;
        }

        if (targetPlayer.id === executor.id) {
            sendMessage('§cYou cannot send a TPA request to yourself.', executor);
            return;
        }

        const result = createRequest(executor, targetPlayer, 'tpahere');

        if (result.success) {
            sendMessage(
                `§aTPA Here request sent to ${targetPlayer.name}. They have ${config.tpa.requestTimeoutSeconds} seconds to accept.`,
                executor
            );
            sendMessage(
                `§a${executor.name} has requested for you to teleport to them. Type §e/tpaccept§a to accept or §e/tpadeny§a to deny.`,
                targetPlayer
            );
        } else {
            sendMessage(`§c${result.message}`, executor);
        }
    }
};

const tpaAcceptCommand: CustomCommand = {
    name: 'tpaccept',
    aliases: ['tpyes', 'tpac'],
    description: 'Accepts an incoming TPA request.',
    permissionLevel: 1024,
    parameters: [{ name: 'player', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, any>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.tpa.enabled) {
            sendMessage(constants.tpaDisabled, executor);
            return;
        }

        let targetName = args.player as string | undefined;

        if (targetName) {
            const targetPlayer = findPlayerByName(targetName);
            if (targetPlayer) {
                targetName = targetPlayer.name;
            }
        }

        acceptRequest(executor, targetName);
    }
};

const tpaDenyCommand: CustomCommand = {
    name: 'tpadeny',
    aliases: ['tpno', 'tpdeny'],
    description: 'Denies an incoming TPA request.',
    permissionLevel: 1024,
    parameters: [{ name: 'player', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, any>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.tpa.enabled) {
            sendMessage(constants.tpaDisabled, executor);
            return;
        }

        let targetName = args.player as string | undefined;

        if (targetName) {
            const targetPlayer = findPlayerByName(targetName);
            if (targetPlayer) {
                targetName = targetPlayer.name;
            }
        }

        denyRequest(executor, targetName);
    }
};

const tpaCancelCommand: CustomCommand = {
    name: 'tpacancel',
    description: 'Cancels your outgoing TPA request.',
    permissionLevel: 1024,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.tpa.enabled) {
            sendMessage(constants.tpaDisabled, executor);
            return;
        }

        cancelRequest(executor);
    }
};

const tpaStatusCommand: CustomCommand = {
    name: 'tpastatus',
    description: 'Checks the status of your outgoing and incoming TPA requests.',
    permissionLevel: 1024,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const outgoing = getOutgoingRequest(executor);
        const incoming = getIncomingRequest(executor);

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

        sendMessage(statusMessage.trim(), executor, { raw: true });
        playSound(executor, constants.soundTeleport);
    }
};

const tpaStopCommand: CustomCommand = {
    name: 'tpastop',
    aliases: ['tpstop', 'tpablock', 'tpblock'],
    description: 'Disables TPA requests or blocks a specific player.',
    permissionLevel: 1024,
    parameters: [{ name: 'player', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, any>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const targetName = args.player as string | undefined;

        if (targetName) {
            const target = findPlayerByName(targetName);
            if (!target) {
                sendMessage('§cPlayer not found.', executor);
                return;
            }
            addTpaBlockedPlayer(executor.id, target.id);
            sendMessage(`§aYou have blocked ${target.name} from sending you TPA requests.`, executor);
        } else {
            setTpaRequestsDisabled(executor.id, true);
            sendMessage('§aYou have disabled all incoming TPA requests.', executor);
        }
    }
};

const tpaStartCommand: CustomCommand = {
    name: 'tpastart',
    aliases: ['tpstart', 'tpaunblock', 'tpunblock'],
    description: 'Enables TPA requests or unblocks a specific player.',
    permissionLevel: 1024,
    parameters: [{ name: 'player', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, any>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const targetName = args.player as string | undefined;

        if (targetName) {
            const target = findPlayerByName(targetName);
            if (!target) {
                sendMessage('§cPlayer not found.', executor);
                return;
            }
            removeTpaBlockedPlayer(executor.id, target.id);
            sendMessage(`§aYou have unblocked ${target.name}. They can now send you TPA requests.`, executor);
        } else {
            setTpaRequestsDisabled(executor.id, false);
            sendMessage('§aYou have enabled all incoming TPA requests.', executor);
        }
    }
};

export default [
    tpaCommand,
    tpaHereCommand,
    tpaAcceptCommand,
    tpaDenyCommand,
    tpaCancelCommand,
    tpaStatusCommand,
    tpaStopCommand,
    tpaStartCommand
];
