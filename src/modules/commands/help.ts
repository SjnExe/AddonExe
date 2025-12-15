import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';

import { getConfig } from '@core/configManager.js';
import { constants } from '@core/constants.js';
import { sendMessage } from '@core/messaging.js';
import { getPlayer } from '@core/playerDataManager.js';
import { uiWait } from '@core/utils.js';

import { CommandExecutor, commandManager, CustomCommand } from './commandManager.js';

// Cache for categorized commands
let categorizedCache: Map<string, CustomCommand[]> | null = null;

function getCategorizedCommands(): Map<string, CustomCommand[]> {
    if (categorizedCache) return categorizedCache;

    const map = new Map<string, CustomCommand[]>();
    for (const cmd of commandManager.commands.values()) {
        const cat = cmd.category || 'General';
        if (!map.has(cat)) {
            map.set(cat, []);
        }
        map.get(cat)!.push(cmd);
    }
    categorizedCache = map;
    return map;
}

// Preferred sort order
const CATEGORY_ORDER = [
    'General',
    'Transportation',
    'Economy',
    'Moderation',
    'Administration',
    'PvP',
    'X-Ray Detection'
];

function getSortedCategories(availableCategories: string[]): string[] {
    const sorted = [...availableCategories];
    sorted.sort((a, b) => {
        const idxA = CATEGORY_ORDER.indexOf(a);
        const idxB = CATEGORY_ORDER.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });
    return sorted;
}

interface HelpConfig {
    helpSystem?: {
        defaultMode?: 'chat' | 'ui';
    };
}

/**
 * Displays detailed help for a specific command.
 */
function showSpecificHelp(executor: CommandExecutor, commandName: string) {
    const isConsole = !(executor instanceof mc.Player);
    const realCommandName = commandManager.aliases.get(commandName) || commandName;
    let cmd = commandManager.commands.get(realCommandName);

    if (!cmd) {
        // Fallback search by slashName
        for (const command of commandManager.commands.values()) {
            if (command.slashName && command.slashName.toLowerCase() === commandName) {
                cmd = command;
                break;
            }
        }
    }

    const pData = isConsole ? null : getPlayer(executor.id);
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

/**
 * Displays the chat-based categorized help.
 */
function showChatHelp(executor: CommandExecutor, userPermissionLevel: number) {
    const allCategories = getCategorizedCommands();
    const visibleCategories: string[] = [];

    // Filter categories
    for (const [cat, cmds] of allCategories) {
        if (cmds.some((c) => userPermissionLevel <= (c.permissionLevel ?? 1024) && !c.hidden)) {
            visibleCategories.push(cat);
        }
    }

    if (visibleCategories.length === 0) {
        if (executor instanceof mc.Player) {
            sendMessage(constants.noPermission, executor);
        } else {
            executor.sendMessage(constants.noPermission);
        }
        return;
    }

    const sortedCats = getSortedCategories(visibleCategories);
    let helpMessage = '§a--- Available Commands ---';

    for (const categoryName of sortedCats) {
        const commands = allCategories.get(categoryName) || [];
        const visibleCmds = commands
            .filter((c) => userPermissionLevel <= (c.permissionLevel ?? 1024) && !c.hidden)
            .sort((a, b) => a.name.localeCompare(b.name));

        if (visibleCmds.length > 0) {
            helpMessage += `\n§l§e--- ${categoryName} ---§r`;
            for (const cmd of visibleCmds) {
                const slashCommand = cmd.slashName || cmd.name;
                helpMessage += `\n §b/${slashCommand}§r: ${cmd.description}`;
            }
        }
    }

    if (executor instanceof mc.Player) {
        sendMessage(helpMessage, executor, { raw: true });
    } else {
        executor.sendMessage(helpMessage);
    }
}

/**
 * Displays the UI-based categorized help.
 */
async function showUIHelp(player: mc.Player, userPermissionLevel: number) {
    const allCategories = getCategorizedCommands();
    const visibleCategories: string[] = [];

    for (const [cat, cmds] of allCategories) {
        if (cmds.some((c) => userPermissionLevel <= (c.permissionLevel ?? 1024) && !c.hidden)) {
            visibleCategories.push(cat);
        }
    }

    if (visibleCategories.length === 0) {
        sendMessage(constants.noPermission, player);
        return;
    }

    const sortedCats = getSortedCategories(visibleCategories);

    const form = new ActionFormData().title('§lHelp Menu').body('Select a category to view commands:');

    sortedCats.forEach((cat) => form.button(cat));

    try {
        const response = (await uiWait(player, form)) as ActionFormResponse;
        if (response.canceled || response.selection === undefined) return;

        const selectedCat = sortedCats[response.selection];
        await showUICategory(player, selectedCat, userPermissionLevel);
    } catch {
        // Ignore UI errors
    }
}

async function showUICategory(player: mc.Player, category: string, userPermissionLevel: number) {
    const cmds = getCategorizedCommands().get(category) || [];
    const visibleCmds = cmds
        .filter((c) => userPermissionLevel <= (c.permissionLevel ?? 1024) && !c.hidden)
        .sort((a, b) => a.name.localeCompare(b.name));

    const form = new ActionFormData().title(`§l${category}`).body(`Commands in ${category}:`);

    form.button('§c< Back');
    visibleCmds.forEach((c) => form.button(`/${c.name}`));

    try {
        const response = (await uiWait(player, form)) as ActionFormResponse;
        if (response.canceled || response.selection === undefined) return;

        if (response.selection === 0) {
            return showUIHelp(player, userPermissionLevel);
        }

        const selectedCmd = visibleCmds[response.selection - 1];
        showSpecificHelp(player, selectedCmd.name);
    } catch {
        // Ignore UI errors
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
    category: 'General',
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

        // Handle Mode Switching Override
        if (topic === 'ui' && executor instanceof mc.Player) {
            showUIHelp(executor, userPermissionLevel).catch(() => {});
            return;
        }
        if (topic === 'chat') {
            showChatHelp(executor, userPermissionLevel);
            return;
        }

        if (topic) {
            showSpecificHelp(executor, topic);
            return;
        }

        // Default Mode Logic
        const config = getConfig() as HelpConfig;
        const defaultMode = config.helpSystem?.defaultMode || 'chat';

        if (defaultMode === 'ui' && executor instanceof mc.Player) {
            showUIHelp(executor, userPermissionLevel).catch(() => {});
        } else {
            showChatHelp(executor, userPermissionLevel);
        }
    }
};

export default helpCommand;
