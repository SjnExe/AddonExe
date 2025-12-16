import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { constants } from '@core/constants.js';
import { sendMessage } from '@core/messaging.js';
import {
    addTpaBlockedPlayer,
    getPlayerIdByName,
    getPlayerNameById,
    removeTpaBlockedPlayer,
    setTpaRequestsDisabled
} from '@core/playerDataManager.js';
import { playSound, resolveTarget } from '@core/utils.js';

import {
    acceptRequest,
    cancelRequest,
    createRequest,
    denyRequest,
    getIncomingRequest,
    getOutgoingRequest
} from '../tpaManager.js';

const tpaCommand: CustomCommand = {
    name: 'tpa',
    description: 'Sends a request to teleport to another player.',
    category: 'Transportation',
    aliases: ['tprequest', 'asktp', 'requesttp'],
    permissionLevel: 1024,
    hasCooldown: true,
    parameters: [{ name: 'target', type: 'string' }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;

        const targetName = args.target as string;
        const config = getConfig();
        if (!config.tpa.enabled) return sendMessage(constants.tpaDisabled, executor);

        if (!targetName) return sendMessage('§cPlease specify a player.', executor);

        // Block mass selectors
        if (targetName.startsWith('@a') || targetName.startsWith('@e')) {
            return sendMessage('§cSelectors @a and @e are disabled for TPA.', executor);
        }

        const targets = resolveTarget(targetName, executor);

        if (!targets || targets.length === 0) return sendMessage('§cPlayer not found.', executor);
        if (targets.length > 1) return sendMessage('§cMultiple players found. Please be more specific.', executor);

        const targetPlayer = targets[0];

        if (targetPlayer.id === executor.id)
            return sendMessage('§cYou cannot send a TPA request to yourself.', executor);

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
    category: 'Transportation',
    aliases: ['tphere', 'tprequesthere'],
    permissionLevel: 1024,
    hasCooldown: true,
    cooldownId: 'tpa',
    parameters: [{ name: 'target', type: 'string' }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;

        const targetName = args.target as string;
        const config = getConfig();
        if (!config.tpa.enabled) return sendMessage(constants.tpaDisabled, executor);

        if (!targetName) return sendMessage('§cPlease specify a player.', executor);

        // Block mass selectors
        if (targetName.startsWith('@a') || targetName.startsWith('@e')) {
            return sendMessage('§cSelectors @a and @e are disabled for TPA.', executor);
        }

        const targets = resolveTarget(targetName, executor);
        if (!targets || targets.length === 0) return sendMessage('§cPlayer not found.', executor);
        if (targets.length > 1) return sendMessage('§cMultiple players found. Please be more specific.', executor);

        const targetPlayer = targets[0];

        if (targetPlayer.id === executor.id)
            return sendMessage('§cYou cannot send a TPA request to yourself.', executor);

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

interface TpaResponseArgs {
    player?: string;
}

const tpaAcceptCommand: CustomCommand = {
    name: 'tpaccept',
    aliases: ['tpyes', 'tpac'],
    description: 'Accepts an incoming TPA request.',
    category: 'Transportation',
    permissionLevel: 1024,
    parameters: [{ name: 'player', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;
        const config = getConfig();
        if (!config.tpa.enabled) return sendMessage(constants.tpaDisabled, executor);

        const typedArgs = args as unknown as TpaResponseArgs;
        let targetName = typedArgs.player;

        if (targetName) {
            const targets = resolveTarget(targetName, executor);
            if (targets.length > 0) targetName = targets[0].name;
            else {
                // If not online, maybe it's just a name string? But acceptRequest usually expects exact name or handles it.
                // Let's pass the string as is if resolution fails, but tpaManager likely matches online players.
            }
        }

        acceptRequest(executor, targetName);
    }
};

const tpaDenyCommand: CustomCommand = {
    name: 'tpadeny',
    aliases: ['tpno', 'tpdeny'],
    description: 'Denies an incoming TPA request.',
    category: 'Transportation',
    permissionLevel: 1024,
    parameters: [{ name: 'player', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;
        const config = getConfig();
        if (!config.tpa.enabled) return sendMessage(constants.tpaDisabled, executor);

        const typedArgs = args as unknown as TpaResponseArgs;
        let targetName = typedArgs.player;

        if (targetName) {
            const targets = resolveTarget(targetName, executor);
            if (targets.length > 0) targetName = targets[0].name;
        }

        denyRequest(executor, targetName);
    }
};

const tpaCancelCommand: CustomCommand = {
    name: 'tpacancel',
    description: 'Cancels your outgoing TPA request.',
    category: 'Transportation',
    permissionLevel: 1024,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) return;
        const config = getConfig();
        if (!config.tpa.enabled) return sendMessage(constants.tpaDisabled, executor);

        cancelRequest(executor);
    }
};

const tpaStatusCommand: CustomCommand = {
    name: 'tpastatus',
    description: 'Checks the status of your outgoing and incoming TPA requests.',
    category: 'Transportation',
    permissionLevel: 1024,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) return;
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

// --- Online Blocking (Selectors) ---

const tpaStopCommand: CustomCommand = {
    name: 'tpastop',
    aliases: ['tpstop', 'tpablock', 'tpblock'],
    description: 'Disables TPA requests or blocks specific players.',
    category: 'Transportation',
    permissionLevel: 1024,
    parameters: [{ name: 'targets', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;
        const targetStr = args.targets as string | undefined;

        if (targetStr) {
            const targets = resolveTarget(targetStr, executor);
            if (targets.length === 0) return sendMessage('§cPlayer not found.', executor);

            for (const target of targets) {
                addTpaBlockedPlayer(executor.id, target.id);
                sendMessage(`§aYou have blocked ${target.name} from sending you TPA requests.`, executor);
            }
        } else {
            setTpaRequestsDisabled(executor.id, true);
            sendMessage('§aYou have disabled all incoming TPA requests.', executor);
        }
    }
};

const tpaStartCommand: CustomCommand = {
    name: 'tpastart',
    aliases: ['tpstart', 'tpaunblock', 'tpunblock'],
    description: 'Enables TPA requests or unblocks specific players.',
    category: 'Transportation',
    permissionLevel: 1024,
    parameters: [{ name: 'targets', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;
        const targetStr = args.targets as string | undefined;

        if (targetStr) {
            const targets = resolveTarget(targetStr, executor);
            if (targets.length === 0) return sendMessage('§cPlayer not found.', executor);

            for (const target of targets) {
                removeTpaBlockedPlayer(executor.id, target.id);
                sendMessage(`§aYou have unblocked ${target.name}. They can now send you TPA requests.`, executor);
            }
        } else {
            setTpaRequestsDisabled(executor.id, false);
            sendMessage('§aYou have enabled all incoming TPA requests.', executor);
        }
    }
};

// --- Offline Blocking (Strings) ---

const oTpaStopCommand: CustomCommand = {
    name: 'otpastop',
    aliases: ['offlinetpastop', 'otpablock'],
    description: 'Blocks an offline player from sending TPA requests.',
    category: 'Transportation',
    permissionLevel: 1024,
    hidden: true,
    parameters: [{ name: 'target', type: 'string' }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;
        const targetName = args.target as string;

        if (!targetName) return sendMessage('§cPlease specify a player name.', executor);

        const targetId = getPlayerIdByName(targetName);
        if (!targetId) return sendMessage(`§cPlayer "${targetName}" never joined.`, executor);
        const displayName = getPlayerNameById(targetId) || targetName;

        addTpaBlockedPlayer(executor.id, targetId);
        sendMessage(`§aYou have blocked ${displayName} from sending you TPA requests (Offline).`, executor);
    }
};

const oTpaStartCommand: CustomCommand = {
    name: 'otpastart',
    aliases: ['offlinetpastart', 'otpaunblock'],
    description: 'Unblocks an offline player from sending TPA requests.',
    category: 'Transportation',
    permissionLevel: 1024,
    hidden: true,
    parameters: [{ name: 'target', type: 'string' }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;
        const targetName = args.target as string;

        if (!targetName) return sendMessage('§cPlease specify a player name.', executor);

        const targetId = getPlayerIdByName(targetName);
        if (!targetId) return sendMessage(`§cPlayer "${targetName}" never joined.`, executor);
        const displayName = getPlayerNameById(targetId) || targetName;

        removeTpaBlockedPlayer(executor.id, targetId);
        sendMessage(`§aYou have unblocked ${displayName} (Offline).`, executor);
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
    tpaStartCommand,
    oTpaStopCommand,
    oTpaStartCommand
];
