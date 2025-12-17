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
import * as warpsManager from '../warpsManager.js';

interface WarpCommandArgs {
    warpName?: string;
}

const warpCommand: CustomCommand = {
    name: 'warp',
    description: 'Teleports you to a set warp location.',
    category: 'Transportation',
    aliases: ['warps'],
    permissionLevel: 1024,
    hasCooldown: true,
    cooldownId: 'warp',
    parameters: [
        {
            name: 'warpName',
            type: 'string',
            optional: true,
            enumOptions: warpsManager.listWarps()
        }
    ],
    execute: async (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.warps.enabled) {
            sendMessage(constants.warpsDisabled, executor);
            return;
        }

        const teleportToWarp = (warpName: string) => {
            const warpLocation = warpsManager.getWarp(warpName);
            if (!warpLocation) {
                sendMessage(`§cWarp '${warpName}' not found.`, executor);
                return;
            }

            const warmupSeconds = config.warps.teleportWarmupSeconds;
            const teleportLogic = () => {
                try {
                    saveLastLocation(executor);
                    const dimension = mc.world.getDimension(warpLocation.dimensionId);
                    if (dimension) {
                        executor.teleport(warpLocation, { dimension });
                        sendMessage(`§aTeleported to warp '${warpName}'.`, executor);
                        setCooldown(executor, 'warp');
                    } else {
                        sendMessage(`§cError: Dimension '${warpLocation.dimensionId}' not found.`, executor);
                    }
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        sendMessage(`§cFailed to teleport. Error: ${e.message}`, executor);
                        errorLog(`[/warp] Failed to teleport: ${e.stack}`);
                    }
                }
            };
            startTeleportWarmup(executor, warmupSeconds, teleportLogic, `warp '${warpName}'`);
        };

        const warpNameArg = (args as unknown as WarpCommandArgs).warpName;
        if (warpNameArg !== undefined) {
            teleportToWarp(warpNameArg);
            return;
        }

        const warpList = warpsManager.listWarps();

        if (warpList.length === 0) {
            sendMessage('§cThere are no warps set.', executor);
            return;
        }

        const form = new ActionFormData().title('Teleport to a Warp').body('Select a warp to teleport to:');

        warpList.forEach((warpName: string) => {
            const location = warpsManager.getWarp(warpName);
            if (location) {
                form.button(
                    `${warpName}\n§7(X: ${location.x.toFixed(2)}, Y: ${location.y.toFixed(2)}, Z: ${location.z.toFixed(2)})`
                );
            }
        });

        try {
            const response = await uiWait(executor, form);
            if (!response || response.canceled) return;

            const selection = (response as ActionFormResponse).selection;
            if (selection !== undefined) {
                const selectedWarp = warpList[selection];
                if (selectedWarp) {
                    teleportToWarp(selectedWarp);
                }
            }
        } catch (e: unknown) {
            errorLog(`[/warp UI] ${String(e)}`);
        }
    }
};

interface AddWarpArgs {
    warpName: string;
    x?: number;
    y?: number;
    z?: number;
}

const addWarpCommand: CustomCommand = {
    name: 'addwarp',
    description: 'Creates a new warp at your current location or at specified coordinates.',
    category: 'Transportation',
    aliases: ['setwarp'],
    permissionLevel: 1, // Admin
    parameters: [
        { name: 'warpName', type: 'string' },
        { name: 'x', type: 'int', optional: true },
        { name: 'y', type: 'int', optional: true },
        { name: 'z', type: 'int', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const { warpName, x, y, z } = args as unknown as AddWarpArgs;
        const hasX = x !== undefined && x !== null;
        const hasY = y !== undefined && y !== null;
        const hasZ = z !== undefined && z !== null;

        let location;

        if (hasX && hasY && hasZ) {
            location = { x, y, z };
        } else if (!hasX && !hasY && !hasZ) {
            location = executor.location;
        } else {
            sendMessage(
                '§cYou must provide all three coordinates (x, y, z) or none to use your current location.',
                executor
            );
            return;
        }

        const result = warpsManager.setWarp(warpName, location, executor.dimension.id);
        sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`, executor);
    }
};

const delWarpCommand: CustomCommand = {
    name: 'delwarp',
    description: 'Deletes an existing warp.',
    category: 'Transportation',
    permissionLevel: 1, // Admin
    parameters: [
        {
            name: 'warpName',
            type: 'string',
            optional: true,
            enumOptions: warpsManager.listWarps()
        }
    ],
    execute: async (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const deleteWarpByName = (warpName: string) => {
            const result = warpsManager.deleteWarp(warpName);
            sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`, executor);
        };

        const warpNameArg = (args as unknown as WarpCommandArgs).warpName;
        if (warpNameArg) {
            deleteWarpByName(warpNameArg);
            return;
        }

        const warpList = warpsManager.listWarps();
        if (warpList.length === 0) {
            sendMessage('§cThere are no warps to delete.', executor);
            return;
        }

        const form = new ActionFormData().title('Delete a Warp').body('Select a warp to delete:');

        warpList.forEach((warpName: string) => form.button(warpName));

        try {
            const response = await uiWait(executor, form);
            if (!response || response.canceled) return;

            const selection = (response as ActionFormResponse).selection;
            if (selection !== undefined) {
                const selectedWarp = warpList[selection];
                deleteWarpByName(selectedWarp);
            }
        } catch (e: unknown) {
            errorLog(`[/delwarp UI] ${String(e)}`);
        }
    }
};

export default [warpCommand, addWarpCommand, delWarpCommand];
