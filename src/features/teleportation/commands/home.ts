import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { constants } from '@core/constants.js';
import { setCooldown } from '@core/cooldownManager.js';
import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { startTeleportWarmup, uiWait } from '@core/utils.js';

import { saveLastLocation } from '../teleportUtils.js';
import * as homesManager from '../homesManager.js';

interface HomeCommandArgs {
    homeName?: string;
}

const homeCommand: CustomCommand = {
    name: 'home',
    description: 'Teleports you to one of your set homes.',
    category: 'Transportation',
    permissionLevel: 1024,
    hasCooldown: true,
    cooldownId: 'homes',
    parameters: [{ name: 'homeName', type: 'string', optional: true }],
    execute: async (executor: CommandExecutor, args: HomeCommandArgs) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.homes.enabled) {
            sendMessage(constants.homesDisabled, executor);
            return;
        }

        const teleportToHome = (homeName: string) => {
            const homeLocation = homesManager.getHome(executor, homeName);
            if (!homeLocation) {
                sendMessage(`§cHome '${homeName}' not found.`, executor);
                return;
            }

            const warmupSeconds = config.homes.teleportWarmupSeconds;
            const teleportLogic = () => {
                try {
                    saveLastLocation(executor);
                    executor.teleport(homeLocation, { dimension: mc.world.getDimension(homeLocation.dimensionId) });
                    sendMessage(`§aTeleported to home '${homeName}'.`, executor);
                    setCooldown(executor, 'homes');
                } catch (e: unknown) {
                    const message = e instanceof Error ? e.message : String(e);
                    const stack = e instanceof Error ? e.stack : String(e);
                    sendMessage(`§cFailed to teleport. Error: ${message}`, executor);
                    errorLog(`[/home] Failed to teleport: ${stack}`);
                }
            };
            startTeleportWarmup(executor, warmupSeconds, teleportLogic, `home '${homeName}'`);
        };

        const homeNameArg = args.homeName;
        if (homeNameArg) {
            teleportToHome(homeNameArg);
            return;
        }

        const homeList = homesManager.listHomes(executor);

        if (homeList.length === 0) {
            sendMessage('§cYou have no homes set. Use §e/sethome <name>§c to create one.', executor);
            return;
        }

        if (homeList.length === 1) {
            teleportToHome(homeList[0]);
            return;
        }

        const form = new ActionFormData().title('Teleport to Home').body('Select a home to teleport to:');

        homeList.forEach((homeName) => form.button(homeName));

        try {
            const response = await uiWait(executor, form);
            if (!response || response.canceled) return;
            const selection = (response as ActionFormResponse).selection;
            if (selection !== undefined) {
                const selectedHome = homeList[selection];
                teleportToHome(selectedHome);
            }
        } catch (e: unknown) {
            errorLog(`[/home UI] ${String(e)}`);
        }
    }
};

const homesCommand: CustomCommand = {
    name: 'homes',
    description: 'Lists all of your set homes.',
    category: 'Transportation',
    aliases: ['homelist'],
    permissionLevel: 1024,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.homes.enabled) {
            sendMessage(constants.homesDisabled, executor);
            return;
        }

        const homeList = homesManager.listHomes(executor);
        const homeCount = homeList.length;
        const maxHomes = config.homes.maxHomes;

        if (homeCount === 0) {
            sendMessage(
                `§aYou have no homes set. Use §e/sethome <name>§a to set one. (${homeCount}/${maxHomes})`,
                executor
            );
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
    permissionLevel: 1024,
    parameters: [{ name: 'homeName', type: 'string', optional: true }],
    execute: async (executor: CommandExecutor, args: HomeCommandArgs) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.homes.enabled) {
            sendMessage(constants.homesDisabled, executor);
            return;
        }

        const deleteHomeByName = (homeName: string) => {
            const result = homesManager.deleteHome(executor, homeName);
            sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`, executor);
        };

        const homeNameArg = args.homeName;
        if (homeNameArg) {
            deleteHomeByName(homeNameArg);
            return;
        }

        const homeList = homesManager.listHomes(executor);

        if (homeList.length === 0) {
            sendMessage('§cYou have no homes to delete.', executor);
            return;
        }

        if (homeList.length === 1) {
            deleteHomeByName(homeList[0]);
            return;
        }

        const form = new ActionFormData().title('Delete a Home').body('Select a home to delete:');

        homeList.forEach((homeName) => form.button(homeName));

        try {
            const response = await uiWait(executor, form);
            if (!response || response.canceled) return;
            const selection = (response as ActionFormResponse).selection;
            if (selection !== undefined) {
                const selectedHome = homeList[selection];
                deleteHomeByName(selectedHome);
            }
        } catch (e: unknown) {
            errorLog(`[/delhome UI] ${String(e)}`);
        }
    }
};

const setHomeCommand: CustomCommand = {
    name: 'sethome',
    aliases: ['addhome', '+home'],
    description: 'Sets a home at your current location.',
    category: 'Transportation',
    permissionLevel: 1024,
    parameters: [{ name: 'homeName', type: 'string', optional: true }],
    execute: (executor: CommandExecutor, args: HomeCommandArgs) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.homes.enabled) {
            sendMessage(constants.homesDisabled, executor);
            return;
        }

        let homeNameToSet;
        const homeNameArg = args.homeName;

        if (homeNameArg) {
            homeNameToSet = homeNameArg;
        } else {
            const existingHomes = new Set(homesManager.listHomes(executor).map((h: string) => h.toLowerCase()));
            let i = 1;
            const baseName = 'home';
            homeNameToSet = baseName;

            if (existingHomes.has(homeNameToSet)) {
                i = 2;
                while (true) {
                    homeNameToSet = `${baseName}${i}`;
                    if (!existingHomes.has(homeNameToSet)) {
                        break;
                    }
                    i++;
                }
            }
        }

        const result = homesManager.setHome(executor, homeNameToSet);
        sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`, executor);
    }
};

export default [homeCommand, homesCommand, delHomeCommand, setHomeCommand];
