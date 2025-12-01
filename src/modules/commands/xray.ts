import * as mc from '@minecraft/server';

import { getXrayConfig, saveXrayConfig } from '../../core/configurations.js';
import { getOrCreatePlayer } from '../../core/playerDataManager.js';
import { restoreAllHiddenOres } from '../anticheat/xray/obfuscator.js';

import { CustomCommand, CustomCommandParamType, CommandExecutor } from './commandManager.js';

// Define parameters for subcommands
// Usage: /xray <action> [value]

const xrayCommand: CustomCommand = {
    name: 'xray',
    description: 'Manage X-Ray Anti-Cheat system',
    category: 'Administration',
    aliases: ['acxray'],
    execute: (executor, args) => {
        // Permission check
        const isPlayer = executor instanceof mc.Player;
        if (isPlayer) {
            const pData = getOrCreatePlayer(executor);
            if (!pData || pData.permissionLevel > 1) { // Admin only
                executor.sendMessage('§cYou do not have permission to use this command.');
                return;
            }
        }

        if (args.length === 0) {
            sendUsage(executor);
            return;
        }

        const action = (args[0] as string).toLowerCase();

        switch (action) {
            case 'notify':
                handleNotify(executor);
                break;
            case 'toggle':
                handleToggle(executor, args[1] as string);
                break;
            case 'restore':
                handleRestore(executor);
                break;
            case 'status':
                handleStatus(executor);
                break;
            default:
                sendUsage(executor);
                break;
        }
    },
    parameters: [
        {
            name: 'action',
            type: CustomCommandParamType.String,
            optional: true
        },
        {
            name: 'value',
            type: CustomCommandParamType.String,
            optional: true
        }
    ]
};

function sendUsage(executor: CommandExecutor) {
    const msg = [
        '§eX-Ray System Usage:§r',
        '§7/xray notify§r - Toggle your personal alerts',
        '§7/xray toggle <on|off>§r - Enable/Disable entire system',
        '§7/xray restore§r - Emergency: Restore all hidden ores',
        '§7/xray status§r - View system status'
    ].join('\n');

    if (executor instanceof mc.Player) {
        executor.sendMessage(msg);
    } else {
        executor.sendMessage(msg.replace(/§./g, ''));
    }
}

function handleNotify(executor: CommandExecutor) {
    if (executor instanceof mc.Player) {
        const pData = getOrCreatePlayer(executor);
        if (pData) {
            pData.xrayNotificationsEnabled = !pData.xrayNotificationsEnabled;
            executor.sendMessage(`§a[X-Ray] Notifications ${pData.xrayNotificationsEnabled ? 'enabled' : 'disabled'}.`);
        }
    } else {
        // Console toggle
        const config = getXrayConfig();
        if (config) {
            config.notifications.logToConsole = !config.notifications.logToConsole;
            saveXrayConfig(config);
            executor.sendMessage(`[X-Ray] Console logging ${config.notifications.logToConsole ? 'enabled' : 'disabled'}.`);
        }
    }
}

function handleToggle(executor: CommandExecutor, value?: string) {
    const config = getXrayConfig();
    if (!config) return;

    if (!value) {
        // Toggle main obfuscation
        config.obfuscation.enabled = !config.obfuscation.enabled;
    } else {
        const boolVal = value.toLowerCase() === 'on' || value.toLowerCase() === 'true';
        config.obfuscation.enabled = boolVal;
        config.heuristics.enabled = boolVal;
    }

    saveXrayConfig(config);
    const status = config.obfuscation.enabled ? '§aENABLED' : '§cDISABLED';
    const msg = `§e[X-Ray] System is now ${status}`;

    if (executor instanceof mc.Player) executor.sendMessage(msg);
    else executor.sendMessage(msg.replace(/§./g, ''));
}

function handleRestore(executor: CommandExecutor) {
    if (executor instanceof mc.Player) executor.sendMessage('§e[X-Ray] Restoring ores...');
    else executor.sendMessage('[X-Ray] Restoring ores...');

    let count = 0;
    count += restoreAllHiddenOres('minecraft:overworld');
    count += restoreAllHiddenOres('minecraft:nether');

    const msg = `§a[X-Ray] Restored ${count} hidden blocks.`;
    if (executor instanceof mc.Player) executor.sendMessage(msg);
    else executor.sendMessage(msg.replace(/§./g, ''));
}

function handleStatus(executor: CommandExecutor) {
    const config = getXrayConfig();
    if (!config) return;

    const msg = [
        '§2--- X-Ray Status ---§r',
        `Obfuscation: ${config.obfuscation.enabled ? '§aON' : '§cOFF'}`,
        `Heuristics: ${config.heuristics.enabled ? '§aON' : '§cOFF'}`,
        `Log to Console: ${config.notifications.logToConsole}`,
        `Radius: ${config.obfuscation.radius} chunks`,
    ].join('\n');

    if (executor instanceof mc.Player) executor.sendMessage(msg);
    else executor.sendMessage(msg.replace(/§./g, ''));
}

export default xrayCommand;
