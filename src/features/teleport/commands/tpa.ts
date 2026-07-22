import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { soundTeleport } from '@core/constants.js';
import { sendMessage } from '@core/messaging.js';
import { addTpaBlockedPlayer, getPlayerIdByName, getPlayerNameById, removeTpaBlockedPlayer, setTpaRequestsDisabled } from '@core/playerDataManager.js';
import { playSound, resolveTarget } from '@core/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

import { acceptRequest, cancelRequest, createRequest, denyRequest, getIncomingRequest, getOutgoingRequest } from '@features/teleport/tpaManager.js';

function handleTpaRequest(executor: mc.Player, args: Record<string, unknown>, type: 'tpa' | 'tpahere'): void {
    const config = getConfig();
    if (!config.tpa.enabled) {
        sendMessage('§cThe TPA system is currently disabled globally.', executor);
        return;
    }

    const targetName = args.target as string;
    if (!isNonEmptyString(targetName)) return sendMessage('§cPlease specify a player.', executor);

    // Block mass selectors
    if (targetName.startsWith('@a') || targetName.startsWith('@e')) {
        return sendMessage('§cSelectors @a and @e are disabled for TPA.', executor);
    }

    const targets = resolveTarget(targetName, executor);

    if (!isDefined(targets) || targets.length === 0) return sendMessage('§cPlayer not found.', executor);
    if (targets.length > 1) return sendMessage('§cMultiple players found. Please be more specific.', executor);

    const targetPlayer = targets[0];
    if (!isDefined(targetPlayer)) return sendMessage('§cPlayer not found.', executor);

    if (targetPlayer.id === executor.id) return sendMessage('§cYou cannot send a TPA request to yourself.', executor);

    const result = createRequest(executor, targetPlayer, type);

    if (result.success) {
        if (result.autoAccepted) {
            sendMessage(result.message, executor);
        } else {
            const typeStr = type === 'tpa' ? 'TPA' : 'TPA Here';
            const msgStr = type === 'tpa' ? 'to teleport to you' : 'for you to teleport to them';
            sendMessage(`§a${typeStr} request sent to ${targetPlayer.name}. They have ${config.tpa.requestTimeoutSeconds} seconds to accept.`, executor);
            sendMessage(`§a${executor.name} has requested ${msgStr}. Type §e/tpaccept§a to accept or §e/tpadeny§a to deny.`, targetPlayer);
        }
    } else {
        sendMessage(`§c${result.message}`, executor);
    }
}

interface TpaResponseArgs {
    player?: string;
}

function handleTpaResponse(executor: mc.Player, args: Record<string, unknown>, action: 'accept' | 'deny'): void {
    const config = getConfig();
    if (!config.tpa.enabled) {
        sendMessage('§cThe TPA system is currently disabled globally.', executor);
        return;
    }

    const typedArgs = args as unknown as TpaResponseArgs;
    let targetName = typedArgs.player;

    if (isNonEmptyString(targetName)) {
        const targets = resolveTarget(targetName, executor);
        const target = targets[0];
        if (isDefined(target)) targetName = target.name;
    }

    if (action === 'accept') {
        acceptRequest(executor, targetName);
    } else {
        denyRequest(executor, targetName);
    }
}

const tpaCommand: CustomCommand = {
    name: 'tpa',
    description: 'Sends a request to teleport to another player.',
    category: 'Transportation',
    aliases: ['tprequest', 'asktp', 'requesttp'],
    permissionNode: 'cmd.tpa.member',
    // Note: Using string type instead of 'player' to support non-op players (selector expansion requires permissions).
    // Dynamic suggestions for online players are not possible with static enums for string types.
    parameters: [{ name: 'target', type: 'string' }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (executor instanceof mc.Player) {
            handleTpaRequest(executor, args, 'tpa');
        }
    }
};

const tpaHereCommand: CustomCommand = {
    name: 'tpahere',
    description: 'Requests another player to teleport to you.',
    category: 'Transportation',
    aliases: ['tphere', 'tprequesthere'],
    permissionNode: 'cmd.tpahere.member',
    // Note: Using string type instead of 'player' to support non-op players.
    parameters: [{ name: 'target', type: 'string' }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (executor instanceof mc.Player) {
            handleTpaRequest(executor, args, 'tpahere');
        }
    }
};

const tpaAcceptCommand: CustomCommand = {
    name: 'tpaccept',
    aliases: ['tpyes', 'tpac'],
    description: 'Accepts an incoming TPA request.',
    category: 'Transportation',
    permissionNode: 'cmd.tpaccept.member',
    parameters: [{ name: 'player', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (executor instanceof mc.Player) {
            handleTpaResponse(executor, args, 'accept');
        }
    }
};

const tpaDenyCommand: CustomCommand = {
    name: 'tpadeny',
    aliases: ['tpno', 'tpdeny'],
    description: 'Denies an incoming TPA request.',
    category: 'Transportation',
    permissionNode: 'cmd.tpadeny.member',
    parameters: [{ name: 'player', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (executor instanceof mc.Player) {
            handleTpaResponse(executor, args, 'deny');
        }
    }
};

const tpaCancelCommand: CustomCommand = {
    name: 'tpacancel',
    description: 'Cancels your outgoing TPA request.',
    category: 'Transportation',
    permissionNode: 'cmd.tpacancel.member',
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) return;
        const config = getConfig();
        if (!config.tpa.enabled) {
            sendMessage('§cThe TPA system is currently disabled globally.', executor);
            return;
        }

        cancelRequest(executor);
    }
};

const tpaStatusCommand: CustomCommand = {
    name: 'tpastatus',
    description: 'Checks the status of your outgoing and incoming TPA requests.',
    category: 'Transportation',
    permissionNode: 'cmd.tpastatus.member',
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) return;

        const config = getConfig();
        if (!config.tpa.enabled) {
            sendMessage('§cThe TPA system is currently disabled globally.', executor);
            return;
        }

        const outgoing = getOutgoingRequest(executor);
        const incoming = getIncomingRequest(executor);

        let statusMessage = '§a--- TPA Status ---\n';
        let foundRequest = false;

        if (isDefined(outgoing)) {
            foundRequest = true;
            const typeText = outgoing.type === 'tpa' ? 'teleport to them' : 'teleport them to you';
            statusMessage += `§eOutgoing Request:§r You have sent a request to §b${outgoing.targetPlayerName}§r to ${typeText}.\n`;
            statusMessage += '§7(Use /tpacancel to cancel this request)\n';
        }

        if (isDefined(incoming)) {
            foundRequest = true;
            const typeText = incoming.type === 'tpa' ? 'teleport to you' : 'teleport you to them';
            statusMessage += `§eIncoming Request:§r You have a request from §b${incoming.sourcePlayerName}§r to ${typeText}.\n`;
            statusMessage += '§7(Use /tpaccept or /tpadeny to respond)\n';
        }

        if (!foundRequest) {
            statusMessage += '§fYou have no pending TPA requests.';
        }

        sendMessage(statusMessage.trim(), executor, { raw: true });
        playSound(executor, soundTeleport);
    }
};

// --- Online Blocking (Selectors) ---

const tpaStopCommand: CustomCommand = {
    name: 'tpastop',
    aliases: ['tpstop', 'tpablock', 'tpblock'],
    description: 'Disables TPA requests or blocks specific players.',
    category: 'Transportation',
    permissionNode: 'cmd.tpastop.admin',
    parameters: [{ name: 'targets', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;

        const config = getConfig();
        if (!config.tpa.enabled) {
            sendMessage('§cThe TPA system is currently disabled globally.', executor);
            return;
        }

        const targetStr = args.targets as string | undefined;

        if (isNonEmptyString(targetStr)) {
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
    permissionNode: 'cmd.tpastart.admin',
    parameters: [{ name: 'targets', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;

        const config = getConfig();
        if (!config.tpa.enabled) {
            sendMessage('§cThe TPA system is currently disabled globally.', executor);
            return;
        }

        const targetStr = args.targets as string | undefined;

        if (isNonEmptyString(targetStr)) {
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

function handleOfflineTpaBlock(executor: mc.Player, args: Record<string, unknown>, action: 'block' | 'unblock'): void {
    const config = getConfig();
    if (!config.tpa.enabled) {
        sendMessage('§cThe TPA system is currently disabled globally.', executor);
        return;
    }

    const targetName = args.target as string;

    if (!isNonEmptyString(targetName)) return sendMessage('§cPlease specify a player name.', executor);

    const targetId = getPlayerIdByName(targetName);
    if (!isNonEmptyString(targetId)) return sendMessage(`§cPlayer "${targetName}" never joined.`, executor);
    const displayName = getPlayerNameById(targetId) ?? targetName;

    if (action === 'block') {
        addTpaBlockedPlayer(executor.id, targetId);
        sendMessage(`§aYou have blocked ${displayName} from sending you TPA requests (Offline).`, executor);
    } else {
        removeTpaBlockedPlayer(executor.id, targetId);
        sendMessage(`§aYou have unblocked ${displayName} from sending you TPA requests (Offline).`, executor);
    }
}

const oTpaStopCommand: CustomCommand = {
    name: 'otpastop',
    aliases: ['offlinetpastop', 'otpablock'],
    description: 'Blocks an offline player from sending TPA requests.',
    category: 'Transportation',
    permissionNode: 'cmd.otpastop.admin',
    hidden: true,
    parameters: [{ name: 'target', type: 'string' }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (executor instanceof mc.Player) {
            handleOfflineTpaBlock(executor, args, 'block');
        }
    }
};

const oTpaStartCommand: CustomCommand = {
    name: 'otpastart',
    aliases: ['offlinetpastart', 'otpaunblock'],
    description: 'Unblocks an offline player from sending TPA requests.',
    category: 'Transportation',
    permissionNode: 'cmd.otpastart.admin',
    hidden: true,
    parameters: [{ name: 'target', type: 'string' }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (executor instanceof mc.Player) {
            handleOfflineTpaBlock(executor, args, 'unblock');
        }
    }
};

export default [tpaCommand, tpaHereCommand, tpaAcceptCommand, tpaDenyCommand, tpaCancelCommand, tpaStatusCommand, tpaStopCommand, tpaStartCommand, oTpaStopCommand, oTpaStartCommand];
