import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { uiWait } from '@core/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

import * as homesManager from '@features/teleport/homesManager.js';
import { executeTeleport } from '@features/teleport/utils.js';

interface HomeCommandArgs {
    homeName?: string;
}

const homeCommand: CustomCommand = {
    name: 'home',
    description: 'Teleports you to one of your set homes.',
    category: 'Transportation',
    permissionNode: 'cmd.home.member',
    parameters: [{ name: 'homeName', type: 'string', optional: true }],
    execute: async (executor: CommandExecutor, args: HomeCommandArgs) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        // Check global feature toggle first
        if (!config.homes.enabled) {
            sendMessage('§cThe Homes system is currently disabled globally.', executor);
            return;
        }

        const teleportToHome = (homeName: string) => {
            const homeLocation = homesManager.getHome(executor, homeName);
            if (!isDefined(homeLocation)) {
                sendMessage(`§cHome '${homeName}' not found.`, executor);
                return;
            }

            executeTeleport({
                executor,
                location: homeLocation,
                destinationName: homeName,
                teleportType: 'home',
                warmupSeconds: config.homes.teleportWarmupSeconds,
                cooldownSeconds: config.homes.cooldownSeconds,
                cooldownKey: 'homes'
            });
        };

        const homeNameArg = args.homeName;
        if (isNonEmptyString(homeNameArg)) {
            teleportToHome(homeNameArg);
            return;
        }

        const homeList = homesManager.listHomes(executor);

        if (homeList.length === 0) {
            sendMessage('§cYou have no homes set. Use §e/sethome <name>§c to create one.', executor);
            return;
        }

        const firstHome = homeList[0];
        if (homeList.length === 1 && isNonEmptyString(firstHome)) {
            teleportToHome(firstHome);
            return;
        }

        const form = new ActionFormData().title('Teleport to Home').body('Select a home to teleport to:');

        for (const homeName of homeList) form.button(homeName);

        try {
            const response = await uiWait(executor, form);
            if (!isDefined(response) || response.canceled) return;
            const selection = (response as ActionFormResponse).selection;
            if (isDefined(selection)) {
                const selectedHome = homeList[selection];
                if (isNonEmptyString(selectedHome)) {
                    teleportToHome(selectedHome);
                }
            }
        } catch (error: unknown) {
            errorLog(`[/home UI] ${String(error)}`);
        }
    }
};

const homesCommand: CustomCommand = {
    name: 'homes',
    description: 'Lists all of your set homes.',
    category: 'Transportation',
    aliases: ['homelist'],
    permissionNode: 'cmd.homes.member',
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.homes.enabled) {
            sendMessage('§cThe Homes system is currently disabled globally.', executor);
            return;
        }

        const homeList = homesManager.listHomes(executor);
        const homeCount = homeList.length;
        const maxHomes = config.homes.maxHomes;

        if (homeCount === 0) {
            sendMessage(`§aYou have no homes set. Use §e/sethome <name>§a to set one. (${homeCount}/${maxHomes})`, executor);
        } else {
            sendMessage(`§aYour homes (${homeCount}/${maxHomes}): §e${homeList.join(', ')}`, executor);
        }
    }
};

const delHomeCommand: CustomCommand = {
    name: 'delhome',
    aliases: ['remhome', 'deletehome', 'rmhome', '-home'],
    description: 'Deletes one of your set homes. Leave name blank to choose from a list.',
    category: 'Transportation',
    permissionNode: 'cmd.delhome.member',
    parameters: [{ name: 'homeName', type: 'string', optional: true }],
    execute: async (executor: CommandExecutor, args: HomeCommandArgs) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.homes.enabled) {
            sendMessage('§cThe Homes system is currently disabled globally.', executor);
            return;
        }

        const deleteHomeByName = (homeName: string) => {
            const result = homesManager.deleteHome(executor, homeName);
            sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`, executor);
        };

        const homeNameArg = args.homeName;
        if (isNonEmptyString(homeNameArg)) {
            deleteHomeByName(homeNameArg);
            return;
        }

        const homeList = homesManager.listHomes(executor);

        if (homeList.length === 0) {
            sendMessage('§cYou have no homes to delete.', executor);
            return;
        }

        const firstHome = homeList[0];
        if (homeList.length === 1 && isNonEmptyString(firstHome)) {
            deleteHomeByName(firstHome);
            return;
        }

        const form = new ActionFormData().title('Delete a Home').body('Select a home to delete:');

        for (const homeName of homeList) form.button(homeName);

        try {
            const response = await uiWait(executor, form);
            if (!isDefined(response) || response.canceled) return;
            const selection = (response as ActionFormResponse).selection;
            if (isDefined(selection)) {
                const selectedHome = homeList[selection];
                if (isNonEmptyString(selectedHome)) {
                    deleteHomeByName(selectedHome);
                }
            }
        } catch (error: unknown) {
            errorLog(`[/delhome UI] ${String(error)}`);
        }
    }
};

const setHomeCommand: CustomCommand = {
    name: 'sethome',
    aliases: ['addhome', '+home'],
    description: 'Sets a home at your current location.',
    category: 'Transportation',
    permissionNode: 'cmd.sethome.member',
    parameters: [{ name: 'homeName', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: HomeCommandArgs) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.homes.enabled) {
            sendMessage('§cThe Homes system is currently disabled globally.', executor);
            return;
        }

        let homeNameToSet;
        const homeNameArg = args.homeName;

        if (isNonEmptyString(homeNameArg)) {
            homeNameToSet = homeNameArg;
        } else {
            const existingHomes = new Set(homesManager.listHomes(executor).map((h: string) => h.toLowerCase()));
            const baseName = 'home';
            homeNameToSet = baseName;

            let i = 2;
            while (existingHomes.has(homeNameToSet)) {
                homeNameToSet = `${baseName}${i}`;
                i++;
            }
        }

        const result = homesManager.setHome(executor, homeNameToSet);
        sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`, executor);
    }
};

export default [homeCommand, homesCommand, delHomeCommand, setHomeCommand];
