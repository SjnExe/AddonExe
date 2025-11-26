import * as mc from '@minecraft/server';

import { constants } from '../../core/constants.js';
import { sendMessage } from '../../core/messaging.js';
import { getPlayer } from '../../core/playerDataManager.js';

import { commandManager, CustomCommand, CommandExecutor } from './commandManager.js';

/**
 * Displays a categorized list of commands available to the player.
 */
function showCategorizedHelp(executor: CommandExecutor, userPermissionLevel: number) {
    const categorizedCommands: { [key: string]: CustomCommand[] } = {};
    const isConsole = !(executor instanceof mc.Player);

    let commandList = Array.from(commandManager.commands.values());
    if (isConsole) {
        commandList = commandList.filter((cmd) => cmd.allowConsole);
    }

    for (const cmd of commandList) {
        if (userPermissionLevel > (cmd.permissionLevel ?? 1024)) {
            continue;
        }

        const category = cmd.category || 'General';
        if (!categorizedCommands[category]) {
            categorizedCommands[category] = [];
        }
        categorizedCommands[category].push(cmd);
    }

    const categoryOrder = [
        'Administration',
        'Moderation',
        'Economy',
        'Shop System',
        'Bounty System',
        'Home System',
        'TPA System',
        'General'
    ];

    let helpMessage = '§a--- Available Commands ---';
    let commandsShown = false;

    for (const categoryName of categoryOrder) {
        const commands = categorizedCommands[categoryName];

        if (commands && commands.length > 0) {
            commandsShown = true;
            helpMessage += `\n§l§e--- ${categoryName} ---§r`;
            for (const cmd of commands.sort((a, b) => a.name.localeCompare(b.name))) {
                const slashCommand = cmd.slashName || cmd.name;
                helpMessage += `\n §b/${slashCommand}§r: ${cmd.description}`;
            }
        }
    }

    if (!commandsShown) {
        if (executor instanceof mc.Player) {
            sendMessage(constants.noPermission, executor);
        } else {
            executor.sendMessage(constants.noPermission);
        }
        return;
    }

    if (executor instanceof mc.Player) {
        sendMessage(helpMessage, executor, { raw: true });
    } else {
        executor.sendMessage(helpMessage);
    }
}

/**
 * Displays detailed help for a specific command.
 */
function showSpecificHelp(executor: CommandExecutor, commandName: string) {
    const isConsole = !(executor instanceof mc.Player);
    const realCommandName = commandManager.aliases.get(commandName) || commandName;
    let cmd = commandManager.commands.get(realCommandName);

    if (!cmd) {
        for (const command of commandManager.commands.values()) {
            if (command.slashName && command.slashName.toLowerCase() === commandName) {
                cmd = command;
                break;
            }
        }
    }

    const pData = isConsole ? null : getPlayer((executor as mc.Player).id);
    const userPermissionLevel = isConsole ? 0 : (pData?.permissionLevel ?? 1024);

    if (!cmd || (isConsole && !cmd.allowConsole) || userPermissionLevel > (cmd.permissionLevel ?? 1024)) {
        const message = `§cUnknown command: '${commandName}'. Or you do not have permission to view it.`;
        if (executor instanceof mc.Player) {
            sendMessage(message, executor);
        } else {
            executor.sendMessage(message);
        }
        return;
    }

    const slashCommand = cmd.slashName || cmd.name;

    let paramString = '';
    if (cmd.parameters && cmd.parameters.length > 0) {
        paramString =
            ' ' +
            cmd.parameters
                .map((p) => {
                    const name = p.enumOptions ? p.enumOptions.join('|') : p.name;
                    return p.optional ? `[${name}]` : `<${name}>`;
                })
                .join(' ');
    }

    let helpMessage = `§a--- Help: /${slashCommand} ---§r\n`;
    helpMessage += `§eDescription§r: ${cmd.description}\n`;
    helpMessage += `§eSyntax§r: /${slashCommand}${paramString}\n`;

    if (cmd.aliases && cmd.aliases.length > 0) {
        helpMessage += `§eAliases§r: ${cmd.aliases.join(', ')}\n`;
    }

    helpMessage += `§eCategory§r: ${cmd.category || 'General'}`;

    if (executor instanceof mc.Player) {
        sendMessage(helpMessage, executor, { raw: true });
    } else {
        executor.sendMessage(helpMessage);
    }
}

interface HelpCommandArgs {
    command?: string;
}

const helpCommand: CustomCommand = {
    name: 'help',
    slashName: 'xhelp',
    aliases: ['?', 'h', 'cmds', 'commands'],
    description: 'Displays a list of available commands or help for a specific command.',
    permissionLevel: 1024,
    allowConsole: true,
    parameters: [{ name: 'command', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: HelpCommandArgs) => {
        let userPermissionLevel = 1024;
        if (executor instanceof mc.Player) {
            const pData = getPlayer(executor.id);
            if (pData) {
                userPermissionLevel = pData.permissionLevel;
            }
        } else {
            userPermissionLevel = 0;
        }

        const topic = args.command ? String(args.command).toLowerCase() : null;

        if (!topic) {
            showCategorizedHelp(executor, userPermissionLevel);
        } else {
            showSpecificHelp(executor, topic);
        }
    }
};

export default helpCommand;
