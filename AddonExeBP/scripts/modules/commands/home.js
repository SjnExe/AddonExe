import * as mc from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { commandManager } from './commandManager.js';
import { errorLog } from '../../core/logger.js';
import * as homesManager from '../../core/homesManager.js';
import { getConfig } from '../../core/configManager.js';
import { startTeleportWarmup } from '../../core/utils.js';
import { setCooldown } from '../../core/cooldownManager.js';
import { sendMessage } from '../../core/messaging.js';
import { constants } from '../../core/constants.js';

commandManager.register({
    name: 'home',
    description: 'Teleports you to one of your set homes.',
    category: 'Home System',
    permissionLevel: 1024, // Everyone
    hasCooldown: true,
    cooldownId: 'homes',
    parameters: [
        { name: 'homeName', type: 'string', description: 'The name of the home to teleport to. Defaults to "home".', optional: true }
    ],
    /**
     * Executes the /home command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     * @param {object} args The command arguments.
     * @param {string} [args.homeName] The name of the home to teleport to.
     */
    execute: (player, args) => {
        const config = getConfig();
        if (!config.homes.enabled) {
            sendMessage(constants.homesDisabled, player);
            return;
        }

        const teleportToHome = (homeName) => {
            const homeLocation = homesManager.getHome(player, homeName);
            if (!homeLocation) {
                sendMessage(`§cHome '${homeName}' not found.`, player);
                return;
            }

            const warmupSeconds = config.homes.teleportWarmupSeconds;
            const teleportLogic = () => {
                try {
                    player.teleport(homeLocation, { dimension: mc.world.getDimension(homeLocation.dimensionId) });
                    sendMessage(`§aTeleported to home '${homeName}'.`, player);
                    setCooldown(player, 'homes');
                } catch (e) {
                    sendMessage(`§cFailed to teleport. Error: ${e.message}`, player);
                    errorLog(`[/home] Failed to teleport: ${e.stack}`);
                }
            };
            startTeleportWarmup(player, warmupSeconds, teleportLogic, `home '${homeName}'`);
        };

        if (args.homeName) {
            teleportToHome(args.homeName);
            return;
        }

        const homeList = homesManager.listHomes(player);

        if (homeList.length === 0) {
            sendMessage('§cYou have no homes set. Use §e/sethome <name>§c to create one.', player);
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

        form.show(player).then(response => {
            if (response.canceled) {return;}
            const selectedHome = homeList[response.selection];
            teleportToHome(selectedHome);
        }).catch(e => errorLog(`[/home UI] ${e.stack}`));
    }
});

commandManager.register({
    name: 'homes',
    description: 'Lists all of your set homes.',
    aliases: ['homelist'],
    category: 'Home System',
    permissionLevel: 1024, // Everyone
    parameters: [],
    /**
     * Executes the /homes command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     */
    execute: (player) => {
        const config = getConfig();
        if (!config.homes.enabled) {
            sendMessage(constants.homesDisabled, player);
            return;
        }

        const homeList = homesManager.listHomes(player);
        const homeCount = homeList.length;
        const maxHomes = config.homes.maxHomes;

        if (homeCount === 0) {
            sendMessage(`§aYou have no homes set. Use §e/sethome <name>§a to set one. (${homeCount}/${maxHomes})`, player);
        } else {
            sendMessage(`§aYour homes (${homeCount}/${maxHomes}): §e${homeList.join(', ')}`, player);
        }
    }
});

commandManager.register({
    name: 'delhome',
    aliases: ['remhome', 'deletehome', 'rmhome', '-home'],
    description: 'Deletes one of your set homes. Leave name blank to choose from a list.',
    category: 'Home System',
    permissionLevel: 1024, // Everyone
    parameters: [
        { name: 'homeName', type: 'string', description: 'The name of the home to delete. Leave blank to choose from a list.', optional: true }
    ],
    /**
     * Executes the /delhome command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     * @param {object} args The command arguments.
     * @param {string} [args.homeName] The name of the home to delete.
     */
    execute: (player, args) => {
        const config = getConfig();
        if (!config.homes.enabled) {
            sendMessage(constants.homesDisabled, player);
            return;
        }

        const deleteHomeByName = (homeName) => {
            const result = homesManager.deleteHome(player, homeName);
            sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`, player);
        };

        if (args.homeName) {
            deleteHomeByName(args.homeName);
            return;
        }

        const homeList = homesManager.listHomes(player);

        if (homeList.length === 0) {
            sendMessage('§cYou have no homes to delete.', player);
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

        form.show(player).then(response => {
            if (response.canceled) {return;}
            const selectedHome = homeList[response.selection];
            deleteHomeByName(selectedHome);
        }).catch(e => errorLog(`[/delhome UI] ${e.stack}`));
    }
});

commandManager.register({
    name: 'sethome',
    aliases: ['addhome', '+home'],
    description: 'Sets a home at your current location.',
    category: 'Home System',
    permissionLevel: 1024, // Everyone
    parameters: [
        { name: 'homeName', type: 'string', description: 'The name of the home to set. Defaults to "home".', optional: true }
    ],
    /**
     * Executes the /sethome command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     * @param {object} args The command arguments.
     * @param {string} [args.homeName] The name of the home to set.
     */
    execute: (player, args) => {
        const config = getConfig();
        if (!config.homes.enabled) {
            sendMessage(constants.homesDisabled, player);
            return;
        }

        let homeNameToSet;

        if (args.homeName) {
            homeNameToSet = args.homeName;
        } else {
            const existingHomes = new Set(homesManager.listHomes(player).map(h => h.toLowerCase()));
            let i = 1;
            let baseName = 'home';
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

        const result = homesManager.setHome(player, homeNameToSet);
        sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`, player);
    }
});
