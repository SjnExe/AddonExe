import { world } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { commandManager } from './commandManager.js';
import { errorLog } from '../../core/errorLogger.js';
import * as homesManager from '../../core/homesManager.js';
import { getConfig } from '../../core/configManager.js';
import { startTeleportWarmup } from '../../core/utils.js';
import { setCooldown } from '../../core/cooldownManager.js';

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
    execute: (player, args) => {
        const config = getConfig();
        if (!config.homes.enabled) {
            player.sendMessage('§cThe homes system is currently disabled.');
            return;
        }

        const teleportToHome = (homeName) => {
            const homeLocation = homesManager.getHome(player, homeName);
            if (!homeLocation) {
                // This case should ideally not be hit if homes are validated before calling
                player.sendMessage(`§cHome '${homeName}' not found.`);
                return;
            }

            const warmupSeconds = config.homes.teleportWarmupSeconds;
            const teleportLogic = () => {
                try {
                    player.teleport(homeLocation, { dimension: world.getDimension(homeLocation.dimensionId) });
                    player.sendMessage(`§aTeleported to home '${homeName}'.`);
                    setCooldown(player, 'homes');
                } catch (e) {
                    player.sendMessage(`§cFailed to teleport. Error: ${e.message}`);
                    errorLog(`[/x:home] Failed to teleport: ${e.stack}`);
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
            player.sendMessage('§cYou have no homes set. Use /sethome <name> to create one.');
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
            if (response.canceled) return;
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
    execute: (player, args) => {
        const config = getConfig();
        if (!config.homes.enabled) {
            player.sendMessage('§cThe homes system is currently disabled.');
            return;
        }

        const homeList = homesManager.listHomes(player);
        const homeCount = homeList.length;
        const maxHomes = config.homes.maxHomes;

        if (homeCount === 0) {
            player.sendMessage(`§aYou have no homes set. Use /sethome <name> to set one. (${homeCount}/${maxHomes})`);
        } else {
            player.sendMessage(`§aYour homes (${homeCount}/${maxHomes}): §e${homeList.join(', ')}`);
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
    execute: (player, args) => {
        const config = getConfig();
        if (!config.homes.enabled) {
            player.sendMessage('§cThe homes system is currently disabled.');
            return;
        }

        const deleteHomeByName = (homeName) => {
            const result = homesManager.deleteHome(player, homeName);
            player.sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`);
        };

        if (args.homeName) {
            deleteHomeByName(args.homeName);
            return;
        }

        const homeList = homesManager.listHomes(player);

        if (homeList.length === 0) {
            player.sendMessage('§cYou have no homes to delete.');
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
            if (response.canceled) return;
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
    execute: (player, args) => {
        const config = getConfig();
        if (!config.homes.enabled) {
            player.sendMessage('§cThe homes system is currently disabled.');
            return;
        }

        let homeNameToSet;

        if (args.homeName) {
            // If a name is provided, use it directly.
            // The homesManager.setHome function will handle the error for duplicate names.
            homeNameToSet = args.homeName;
        } else {
            // If no name is provided, find the next available "home" name.
            const existingHomes = new Set(homesManager.listHomes(player).map(h => h.toLowerCase()));
            let i = 1;
            let baseName = 'home';
            homeNameToSet = baseName;

            // If "home" doesn't exist, we'll use it. If it does, find the next number.
            if (existingHomes.has(homeNameToSet)) {
                i = 2; // Start checking from home2
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
        player.sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`);
    }
});
