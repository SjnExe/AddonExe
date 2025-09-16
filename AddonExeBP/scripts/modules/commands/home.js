import { world } from '@minecraft/server';
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
    parameters: [
        { name: 'homeName', type: 'string', description: 'The name of the home to teleport to. Defaults to "home".', optional: true }
    ],
    execute: (player, args) => {
        const config = getConfig();
        if (!config.homes.enabled) {
            player.sendMessage('§cThe homes system is currently disabled.');
            return;
        }

        const homeName = args.homeName || 'home';
        const homeLocation = homesManager.getHome(player, homeName);

        if (!homeLocation) {
            player.sendMessage(`§cHome '${homeName}' not found. Use /homes to see your list of homes.`);
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
    description: 'Deletes one of your set homes.',
    category: 'Home System',
    permissionLevel: 1024, // Everyone
    parameters: [
        { name: 'homeName', type: 'string', description: 'The name of the home to delete.' }
    ],
    execute: (player, args) => {
        const config = getConfig();
        if (!config.homes.enabled) {
            player.sendMessage('§cThe homes system is currently disabled.');
            return;
        }

        const { homeName } = args;

        const result = homesManager.deleteHome(player, homeName);
        player.sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`);
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

        const homeName = args.homeName || 'home';

        const result = homesManager.setHome(player, homeName);
        player.sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`);
    }
});
