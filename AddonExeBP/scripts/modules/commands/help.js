import { commandManager } from './commandManager.js';
import { getPlayer } from '../../core/playerDataManager.js';

function showCategorizedHelp(player, userPermissionLevel, isConsole) {
    const categorizedCommands = {};

    let commandList = commandManager.commands;
    if (isConsole) {
        commandList = commandList.filter(cmd => cmd.allowConsole);
    }

    for (const cmd of commandList) {
        if (userPermissionLevel > cmd.permissionLevel) { continue; }

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
                helpMessage += `\n §b!${cmd.name}§r: ${cmd.description}`;
            }
        }
    }

    if (!commandsShown) {
        player.sendMessage('§cYou do not have permission to use any commands.');
        return;
    }

    player.sendMessage(helpMessage);
}

function showSpecificHelp(player, commandName, isConsole) {
    const cmd = commandManager.commands.find(c => c.name === commandName || (c.aliases && c.aliases.includes(commandName)));

    if (!cmd || (isConsole && !cmd.allowConsole)) {
        player.sendMessage(`§cUnknown command: '${commandName}'. Or it cannot be used from the console.`);
        return;
    }

    let helpMessage = `§a--- Help: !${cmd.name} ---\n`;
    helpMessage += `§eDescription§r: ${cmd.description}\n`;
    if (cmd.aliases && cmd.aliases.length > 0) {
        helpMessage += `§eAliases§r: ${cmd.aliases.map(a => `!${a}`).join(', ')}\n`;
    }
    helpMessage += `§eCategory§r: ${cmd.category || 'General'}\n`;
    helpMessage += `§ePermission Level§r: ${cmd.permissionLevel}`;

    player.sendMessage(helpMessage);
}

commandManager.register({
    name: 'help',
    slashName: 'xhelp',
    aliases: ['?', 'h', 'cmds', 'commands'],
    disabledSlashAliases: ['?'],
    description: 'Displays a list of available commands or help for a specific command.',
    category: 'General',
    permissionLevel: 1024, // Available to everyone
    allowConsole: true,
    parameters: [
        { name: 'command', type: 'string', description: 'The command to get help for.', optional: true }
    ],
    execute: (player, args) => {
        let userPermissionLevel = 1024; // Default for players without data
        if (player.isConsole) {
            userPermissionLevel = 0; // Highest permission for console
        } else {
            const pData = getPlayer(player.id);
            if (pData) {
                userPermissionLevel = pData.permissionLevel;
            }
        }

        const topic = args.command ? args.command.toLowerCase() : null;

        if (!topic) {
            showCategorizedHelp(player, userPermissionLevel, player.isConsole);
        } else {
            showSpecificHelp(player, topic, player.isConsole);
        }
    }
});
