import { world } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { commandManager } from './commandManager.js';
import { errorLog } from '../../core/logger.js';
import * as warpsManager from '../../core/warpsManager.js';
import { getConfig } from '../../core/configManager.js';
import { startTeleportWarmup } from '../../core/utils.js';
import { setCooldown } from '../../core/cooldownManager.js';
import { sendMessage } from '../../core/messaging.js';
import { Constants } from '../../core/constants.js';

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
    /**
     * Executes the /warp command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     * @param {object} args The command arguments.
     * @param {string} [args.warpName] The name of the warp to teleport to.
     */
    execute: (player, args) => {
        const config = getConfig();
        if (!config.warps.enabled) {
            sendMessage(Constants.WARPS_DISABLED, player);
            return;
        }

        const teleportToWarp = (warpName) => {
            const warpLocation = warpsManager.getWarp(warpName);
            if (!warpLocation) {
                sendMessage(`§cWarp '${warpName}' not found.`, player);
                return;
            }

            const warmupSeconds = config.warps.teleportWarmupSeconds;
            const teleportLogic = () => {
                try {
                    player.teleport(warpLocation, { dimension: world.getDimension(warpLocation.dimensionId) });
                    sendMessage(`§aTeleported to warp '${warpName}'.`, player);
                    setCooldown(player, 'warp');
                } catch (e) {
                    sendMessage(`§cFailed to teleport. Error: ${e.message}`, player);
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
            sendMessage('§cThere are no warps set.', player);
            return;
        }

        const form = new ActionFormData()
            .title('Teleport to a Warp')
            .body('Select a warp to teleport to:');

        warpList.forEach(warpName => {
            const location = warpsManager.getWarp(warpName);
            form.button(`${warpName}\n§7(X: ${location.x.toFixed(2)}, Y: ${location.y.toFixed(2)}, Z: ${location.z.toFixed(2)})`);
        });

        form.show(player).then(response => {
            if (response.canceled) { return; }
            const selectedWarp = warpList[response.selection];
            teleportToWarp(selectedWarp);
        }).catch(e => errorLog(`[/warp UI] ${e.stack}`));
    }
});

commandManager.register({
    name: 'addwarp',
    description: 'Creates a new warp at your current location or at specified coordinates.',
    aliases: ['setwarp'],
    category: 'Administration',
    permissionLevel: 1, // Admin
    parameters: [
        { name: 'warpName', type: 'string', description: 'The name for the new warp.' },
        { name: 'x', type: 'int', description: 'The x-coordinate for the warp.', optional: true },
        { name: 'y', type: 'int', description: 'The y-coordinate for the warp.', optional: true },
        { name: 'z', type: 'int', description: 'The z-coordinate for the warp.', optional: true }
    ],
    /**
     * Executes the /addwarp command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     * @param {object} args The command arguments.
     */
    execute: (player, args) => {
        const { warpName, x, y, z } = args;
        const hasX = x !== undefined && x !== null;
        const hasY = y !== undefined && y !== null;
        const hasZ = z !== undefined && z !== null;

        let location;

        if (hasX && hasY && hasZ) {
            location = { x, y, z };
        } else if (!hasX && !hasY && !hasZ) {
            location = player.location;
        } else {
            sendMessage('§cYou must provide all three coordinates (x, y, z) or none to use your current location.', player);
            return;
        }

        const result = warpsManager.setWarp(warpName, location, player.dimension.id);
        sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`, player);
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
    /**
     * Executes the /delwarp command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     * @param {object} args The command arguments.
     */
    execute: (player, args) => {
        const deleteWarpByName = (warpName) => {
            const result = warpsManager.deleteWarp(warpName);
            sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`, player);
        };

        if (args.warpName) {
            deleteWarpByName(args.warpName);
            return;
        }

        const warpList = warpsManager.listWarps();
        if (warpList.length === 0) {
            sendMessage('§cThere are no warps to delete.', player);
            return;
        }

        const form = new ActionFormData()
            .title('Delete a Warp')
            .body('Select a warp to delete:');

        warpList.forEach(warpName => form.button(warpName));

        form.show(player).then(response => {
            if (response.canceled) { return; }
            const selectedWarp = warpList[response.selection];
            deleteWarpByName(selectedWarp);
        }).catch(e => errorLog(`[/delwarp UI] ${e.stack}`));
    }
});
