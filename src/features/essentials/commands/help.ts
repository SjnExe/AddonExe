import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';

import { getConfig } from '@core/configManager.js';
import { noPermission } from '@core/constants.js';
import { sendMessage } from '@core/messaging.js';
import { hasPermission } from '@core/permissionEngine.js';
import { uiWait } from '@core/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

import { CommandExecutor, commandManager, CustomCommand } from '@commands/commandManager.js';

// Cache for categorized commands
let categorizedCache: Map<string, CustomCommand[]> | undefined;

function getCategorizedCommands(): Map<string, CustomCommand[]> {
    if (isDefined(categorizedCache)) return categorizedCache;

    const map = new Map<string, CustomCommand[]>();
    for (const cmd of commandManager.commands.values()) {
        const cat = cmd.category ?? 'General';
        if (!map.has(cat)) {
            map.set(cat, []);
        }
        map.get(cat)!.push(cmd);
    }
    categorizedCache = map;
    return map;
}

// Preferred sort order
const CATEGORY_ORDER = ['General', 'Transportation', 'Economy', 'Moderation', 'Administration', 'PvP', 'X-Ray Detection'];

function getSortedCategories(availableCategories: string[]): string[] {
    const sorted = [...availableCategories];
    sorted.toSorted((a, b) => {
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
 * Helper to resolve the command object and check basic permissions/console usage.
 */
function resolveCommandForHelp(executor: CommandExecutor, commandName: string): { cmd: CustomCommand | undefined; error?: string } {
    const isConsole = !(executor instanceof mc.Player);
    const realCommandName = commandManager.aliases.get(commandName) ?? commandName;
    let cmd = commandManager.commands.get(realCommandName);

    if (!isDefined(cmd)) {
        // Fallback search by slashName
        for (const command of commandManager.commands.values()) {
            if (isDefined(command.slashName) && command.slashName.toLowerCase() === commandName) {
                cmd = command;
                break;
            }
        }
    }

    if (!isDefined(cmd)) {
        return { cmd: undefined, error: `§cUnknown command: '${commandName}'.` };
    }

    if (isConsole && (cmd.allowConsole ?? false) === false) {
        return { cmd: undefined, error: `§cCommand '${commandName}' cannot be run from console.` };
    }

    if (!isConsole && !hasPermission(executor, cmd.permissionNode)) {
        return { cmd: undefined, error: `§cYou do not have permission to view command: '${commandName}'.` };
    }

    return { cmd };
}

/**
 * Displays detailed help for a specific command.
 */
function showSpecificHelp(executor: CommandExecutor, commandName: string) {
    const { cmd, error } = resolveCommandForHelp(executor, commandName);

    if (isDefined(error)) {
        if (executor instanceof mc.Player) {
            sendMessage(error, executor);
        } else {
            executor.sendMessage(error);
        }
        return;
    }

    if (!isDefined(cmd)) return;

    const slashCommand = cmd.slashName ?? cmd.name;

    let paramString = '';
    if (isDefined(cmd.parameters) && cmd.parameters.length > 0) {
        paramString =
            ' ' +
            cmd.parameters
                .map((p) => {
                    const options = typeof p.enumOptions === 'function' ? p.enumOptions() : p.enumOptions;
                    const name = isDefined(options) ? options.join('|') : p.name;
                    return p.optional === true ? `[${name}]` : `<${name}>`;
                })
                .join(' ');
    }

    let helpMessage = `§a--- Help: /${slashCommand} ---§r\n`;
    helpMessage += `§eDescription§r: ${cmd.description}\n`;
    helpMessage += `§eSyntax§r: /${slashCommand}${paramString}\n`;

    if (isDefined(cmd.aliases) && cmd.aliases.length > 0) {
        helpMessage += `§eAliases§r: ${cmd.aliases.join(', ')}\n`;
    }

    helpMessage += `§eCategory§r: ${cmd.category ?? 'General'}`;

    if (executor instanceof mc.Player) {
        sendMessage(helpMessage, executor, { raw: true });
    } else {
        executor.sendMessage(helpMessage);
    }
}

/**
 * Displays the chat-based categorized help.
 */
function showChatHelp(executor: CommandExecutor) {
    const allCategories = getCategorizedCommands();
    const visibleCategories: string[] = [];

    // Filter categories: Only show if category contains at least one visible command
    for (const [cat, cmds] of allCategories) {
        if (cmds.some((c) => (executor instanceof mc.Player ? hasPermission(executor, c.permissionNode) : true) && c.hidden !== true)) {
            visibleCategories.push(cat);
        }
    }

    if (visibleCategories.length === 0) {
        if (executor instanceof mc.Player) {
            sendMessage(noPermission, executor);
        } else {
            executor.sendMessage(noPermission);
        }
        return;
    }

    const sortedCats = getSortedCategories(visibleCategories);
    let helpMessage = '§a--- Available Commands ---';

    for (const categoryName of sortedCats) {
        const commands = allCategories.get(categoryName) ?? [];
        const visibleCmds = commands
            .filter((c) => (executor instanceof mc.Player ? hasPermission(executor, c.permissionNode) : true) && c.hidden !== true)
            .toSorted((a, b) => a.name.localeCompare(b.name));

        if (visibleCmds.length > 0) {
            helpMessage += `\n§l§e--- ${categoryName} ---§r`;
            for (const cmd of visibleCmds) {
                const slashCommand = cmd.slashName ?? cmd.name;
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
async function showUIHelp(player: mc.Player) {
    const allCategories = getCategorizedCommands();
    const visibleCategories: string[] = [];

    for (const [cat, cmds] of allCategories) {
        if (cmds.some((c) => hasPermission(player, c.permissionNode) && c.hidden !== true)) {
            visibleCategories.push(cat);
        }
    }

    if (visibleCategories.length === 0) {
        sendMessage(noPermission, player);
        return;
    }

    const sortedCats = getSortedCategories(visibleCategories);

    const form = new ActionFormData().title('§lHelp Menu').body('Select a category to view commands:');

    for (const cat of sortedCats) form.button(cat);

    try {
        const response = (await uiWait(player, form)) as ActionFormResponse;
        if (response.canceled || response.selection === undefined) return;

        const selectedCat = sortedCats[response.selection];
        if (selectedCat !== undefined) {
            await showUICategory(player, selectedCat);
        }
    } catch {
        // Ignore UI errors
    }
}

async function showUICategory(player: mc.Player, category: string) {
    const cmds = getCategorizedCommands().get(category) ?? [];
    const visibleCmds = cmds.filter((c) => hasPermission(player, c.permissionNode) && c.hidden !== true).toSorted((a, b) => a.name.localeCompare(b.name));

    const form = new ActionFormData().title(`§l${category}`).body(`Commands in ${category}:`);

    form.button('§4< Back');
    for (const c of visibleCmds) form.button(`/${c.name}`);

    try {
        const response = (await uiWait(player, form)) as ActionFormResponse;
        if (response.canceled || response.selection === undefined) return;

        if (response.selection === 0) {
            return showUIHelp(player);
        }

        const selectedCmd = visibleCmds[response.selection - 1];
        if (isDefined(selectedCmd)) {
            showSpecificHelp(player, selectedCmd.name);
        }
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
    permissionNode: 'cmd.help',
    allowConsole: true,
    parameters: [{ name: 'command', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: HelpCommandArgs) => {
        const topic = isNonEmptyString(args.command) ? String(args.command).toLowerCase() : undefined;

        // Handle Mode Switching Override
        if (topic === 'ui' && executor instanceof mc.Player) {
            showUIHelp(executor).catch(() => {});
            return;
        }
        if (topic === 'chat') {
            showChatHelp(executor);
            return;
        }

        if (isNonEmptyString(topic)) {
            showSpecificHelp(executor, topic);
            return;
        }

        // Default Mode Logic
        const config = getConfig() as HelpConfig;
        const defaultMode = (isDefined(config.helpSystem) ? config.helpSystem.defaultMode : undefined) ?? 'chat';

        if (defaultMode === 'ui' && executor instanceof mc.Player) {
            showUIHelp(executor).catch(() => {});
        } else {
            showChatHelp(executor);
        }
    }
};

export default helpCommand;
