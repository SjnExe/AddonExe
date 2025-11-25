import * as mc from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { CustomCommand, CommandExecutor } from './commandManager.js';
import { errorLog } from '../../core/logger.js';
import * as homesManager from '../../core/homesManager.js';
import { getConfig } from '../../core/configManager.js';
import { startTeleportWarmup } from '../../core/utils.js';
import { setCooldown } from '../../core/cooldownManager.js';
import { sendMessage } from '../../core/messaging.js';
import { constants } from '../../core/constants.js';

const homeCommand: CustomCommand = {
    name: 'home',
    description: 'Teleports you to one of your set homes.',
    permissionLevel: 1024,
    hasCooldown: true,
    cooldownId: 'homes',
    parameters: [
        { name: 'homeName', type: 'string', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, any>) => {
        if (!(executor instanceof mc.Player)) {return;}
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
                    executor.teleport(homeLocation, { dimension: mc.world.getDimension(homeLocation.dimensionId) });
                    sendMessage(`§aTeleported to home '${homeName}'.`, executor);
                    setCooldown(executor, 'homes');
                } catch (e: any) {
                    sendMessage(`§cFailed to teleport. Error: ${e.message}`, executor);
                    errorLog(`[/home] Failed to teleport: ${e.stack}`);
                }
            };
            startTeleportWarmup(executor, warmupSeconds, teleportLogic, `home '${homeName}'`);
        };

        const homeNameArg = args.homeName as string | undefined;
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

        const form = new ActionFormData()
            .title('Teleport to Home')
            .body('Select a home to teleport to:');

        homeList.forEach(homeName => form.button(homeName));

        form.show(executor).then(response => {
            if (response.canceled) {return;}
            if (response.selection === undefined) {return;}
            const selectedHome = homeList[response.selection];
            teleportToHome(selectedHome);
        }).catch(e => errorLog(`[/home UI] ${e.stack}`));
    }
};

const homesCommand: CustomCommand = {
    name: 'homes',
    description: 'Lists all of your set homes.',
    aliases: ['homelist'],
    permissionLevel: 1024,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {return;}
        const config = getConfig();
        if (!config.homes.enabled) {
            sendMessage(constants.homesDisabled, executor);
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
    permissionLevel: 1024,
    parameters: [
        { name: 'homeName', type: 'string', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, any>) => {
        if (!(executor instanceof mc.Player)) {return;}
        const config = getConfig();
        if (!config.homes.enabled) {
            sendMessage(constants.homesDisabled, executor);
            return;
        }

        const deleteHomeByName = (homeName: string) => {
            const result = homesManager.deleteHome(executor, homeName);
            sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`, executor);
        };

        const homeNameArg = args.homeName as string | undefined;
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

        const form = new ActionFormData()
            .title('Delete a Home')
            .body('Select a home to delete:');

        homeList.forEach(homeName => form.button(homeName));

        form.show(executor).then(response => {
            if (response.canceled) {return;}
            if (response.selection === undefined) {return;}
            const selectedHome = homeList[response.selection];
            deleteHomeByName(selectedHome);
        }).catch(e => errorLog(`[/delhome UI] ${e.stack}`));
    }
};

const setHomeCommand: CustomCommand = {
    name: 'sethome',
    aliases: ['addhome', '+home'],
    description: 'Sets a home at your current location.',
    permissionLevel: 1024,
    parameters: [
        { name: 'homeName', type: 'string', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, any>) => {
        if (!(executor instanceof mc.Player)) {return;}
        const config = getConfig();
        if (!config.homes.enabled) {
            sendMessage(constants.homesDisabled, executor);
            return;
        }

        let homeNameToSet;
        const homeNameArg = args.homeName as string | undefined;

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
