import { world } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { commandManager } from './commandManager.js';
import { errorLog } from '../../core/errorLogger.js';
import * as warpsManager from '../../core/warpsManager.js';
import { getConfig } from '../../core/configManager.js';
import { startTeleportWarmup } from '../../core/utils.js';
import { setCooldown } from '../../core/cooldownManager.js';

commandManager.register({
    name: 'warp',
    description: 'Teleports you to a set warp location.',
    aliases: ['warps'],
    category: 'General',
    permissionLevel: 1024, // Everyone
    hasCooldown: true,
    cooldownId: 'warp',
    parameters: [
        { name: 'warpName', type: 'string', description: 'The name of the warp to teleport to.', optional: true }
    ],
    execute: (player, args) => {
        const config = getConfig();
        if (!config.warps.enabled) {
            player.sendMessage('§cThe warps system is currently disabled.');
            return;
        }

        const teleportToWarp = (warpName) => {
            const warpLocation = warpsManager.getWarp(warpName);
            if (!warpLocation) {
                player.sendMessage(`§cWarp '${warpName}' not found.`);
                return;
            }

            const warmupSeconds = config.warps.teleportWarmupSeconds;
            const teleportLogic = () => {
                try {
                    player.teleport(warpLocation, { dimension: world.getDimension(warpLocation.dimensionId) });
                    player.sendMessage(`§aTeleported to warp '${warpName}'.`);
                    setCooldown(player, 'warp');
                } catch (e) {
                    player.sendMessage(`§cFailed to teleport. Error: ${e.message}`);
                    errorLog(`[/warp] Failed to teleport: ${e.stack}`);
                }
            };
            startTeleportWarmup(player, warmupSeconds, teleportLogic, `warp '${warpName}'`);
        };

        if (args.warpName) {
            teleportToWarp(args.warpName);
            return;
        }

        const warpList = warpsManager.listWarps();

        if (warpList.length === 0) {
            player.sendMessage('§cThere are no warps set.');
            return;
        }

        const form = new ActionFormData()
            .title('Teleport to a Warp')
            .body('Select a warp to teleport to:');

        warpList.forEach(warpName => {
            const location = warpsManager.getWarp(warpName);
            form.button(`${warpName}\n§7(X: ${Math.floor(location.x)}, Y: ${Math.floor(location.y)}, Z: ${Math.floor(location.z)})`);
        });

        form.show(player).then(response => {
            if (response.canceled) {return;}
            const selectedWarp = warpList[response.selection];
            teleportToWarp(selectedWarp);
        }).catch(e => errorLog(`[/warp UI] ${e.stack}`));
    }
});

commandManager.register({
    name: 'addwarp',
    description: 'Creates a new warp at your current location.',
    category: 'Administration',
    permissionLevel: 1, // Admin
    parameters: [
        { name: 'warpName', type: 'string', description: 'The name for the new warp.' }
    ],
    execute: (player, args) => {
        const result = warpsManager.setWarp(args.warpName, player.location, player.dimension.id);
        player.sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`);
    }
});

commandManager.register({
    name: 'delwarp',
    description: 'Deletes an existing warp.',
    category: 'Administration',
    permissionLevel: 1, // Admin
    parameters: [
        { name: 'warpName', type: 'string', description: 'The name of the warp to delete. Leave blank to choose from a list.', optional: true }
    ],
    execute: (player, args) => {
        const deleteWarpByName = (warpName) => {
            const result = warpsManager.deleteWarp(warpName);
            player.sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`);
        };

        if (args.warpName) {
            deleteWarpByName(args.warpName);
            return;
        }

        const warpList = warpsManager.listWarps();
        if (warpList.length === 0) {
            player.sendMessage('§cThere are no warps to delete.');
            return;
        }

        const form = new ActionFormData()
            .title('Delete a Warp')
            .body('Select a warp to delete:');

        warpList.forEach(warpName => form.button(warpName));

        form.show(player).then(response => {
            if (response.canceled) {return;}
            const selectedWarp = warpList[response.selection];
            deleteWarpByName(selectedWarp);
        }).catch(e => errorLog(`[/delwarp UI] ${e.stack}`));
    }
});