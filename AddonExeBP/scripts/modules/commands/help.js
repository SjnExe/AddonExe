import { commandManager } from './commandManager.js';
import { getPlayer } from '../../core/playerDataManager.js';

function showCategorizedHelp(player, userPermissionLevel, isConsole) {
    const categorizedCommands = {};

    // Get commands from the Map and convert to an array to be able to filter and iterate
    let commandList = Array.from(commandManager.commands.values());
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
                const slashCommand = cmd.slashName || cmd.name;
                helpMessage += `\n §b/${slashCommand}§r: ${cmd.description}`;
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
    // Resolve alias to primary command name, then look up the command
    const realCommandName = commandManager.aliases.get(commandName) || commandName;
    let cmd = commandManager.commands.get(realCommandName);

    // If not found, it might be a unique slash command name, so we have to iterate to find it.
    if (!cmd) {
        for (const command of commandManager.commands.values()) {
            if (command.slashName && command.slashName.toLowerCase() === commandName) {
                cmd = command;
                break;
            }
        }
    }

    const pData = isConsole ? null : getPlayer(player.id);
    const userPermissionLevel = isConsole ? 0 : (pData?.permissionLevel ?? 1024);

    if (!cmd || (isConsole && !cmd.allowConsole) || userPermissionLevel > cmd.permissionLevel) {
        player.sendMessage(`§cUnknown command: '${commandName}'. Or you do not have permission to view it.`);
        return;
    }

    const slashCommand = cmd.slashName || cmd.name;

    // Build the parameter string
    let paramString = '';
    if (cmd.parameters && cmd.parameters.length > 0) {
        paramString = ' ' + cmd.parameters.map(p => {
            const name = p.enumOptions ? p.enumOptions.join('|') : p.name;
            return p.optional ? `[${name}]` : `<${name}>`;
        }).join(' ');
    }

    let helpMessage = `§a--- Help: /${slashCommand} ---§r\n`;
    helpMessage += `§eDescription§r: ${cmd.description}\n`;
    helpMessage += `§eSyntax§r: /${slashCommand}${paramString}\n`;

    if (cmd.aliases && cmd.aliases.length > 0) {
        helpMessage += `§eAliases§r: ${cmd.aliases.join(', ')}\n`;
    }

    helpMessage += `§eCategory§r: ${cmd.category || 'General'}`;

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
