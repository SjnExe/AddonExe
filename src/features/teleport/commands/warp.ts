import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { uiWait } from '@core/utils.js';
import { isDefined, isNonEmptyString, isNumber } from '@lib/guards.js';

import { executeTeleport } from '@features/teleport/utils.js';
import * as warpsManager from '@features/teleport/warpsManager.js';

interface WarpCommandArgs {
    warpName?: string;
}

const warpCommand: CustomCommand = {
    name: 'warp',
    description: 'Teleports you to a set warp location.',
    category: 'Transportation',
    aliases: ['warps'],
    permissionNode: 'cmd.warp.admin',
    parameters: [
        {
            name: 'warpName',
            type: 'string',
            optional: true,
            enumOptions: () => {
                try {
                    return warpsManager.listWarps();
                } catch {
                    return [];
                }
            }
        }
    ],
    execute: async (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.warps.enabled) {
            sendMessage('§cThe Warps system is currently disabled globally.', executor);
            return;
        }

        const teleportToWarp = (warpName: string) => {
            const warpLocation = warpsManager.getWarp(warpName);
            if (!isDefined(warpLocation)) {
                sendMessage(`§cWarp '${warpName}' not found.`, executor);
                return;
            }

            executeTeleport({
                executor,
                location: warpLocation,
                destinationName: warpName,
                teleportType: 'warp',
                warmupSeconds: config.warps.teleportWarmupSeconds,
                cooldownSeconds: config.warps.cooldownSeconds,
                cooldownKey: 'warp'
            });
        };

        const warpNameArg = (args as unknown as WarpCommandArgs).warpName;
        if (isNonEmptyString(warpNameArg)) {
            teleportToWarp(warpNameArg);
            return;
        }

        const warpList = warpsManager.listWarps();

        if (warpList.length === 0) {
            sendMessage('§cThere are no warps set.', executor);
            return;
        }

        const form = new ActionFormData().title('Teleport to a Warp').body('Select a warp to teleport to:');

        for (const warpName of warpList) {
            const location = warpsManager.getWarp(warpName);
            if (isDefined(location)) {
                form.button(`${warpName}\n§8(X: ${location.x.toFixed(2)}, Y: ${location.y.toFixed(2)}, Z: ${location.z.toFixed(2)})`);
            }
        }

        try {
            const response = await uiWait(executor, form);
            if (!isDefined(response) || response.canceled) return;

            const selection = (response as ActionFormResponse).selection;
            if (isDefined(selection)) {
                const selectedWarp = warpList[selection];
                if (isNonEmptyString(selectedWarp)) {
                    teleportToWarp(selectedWarp);
                }
            }
        } catch (error: unknown) {
            errorLog(`[/warp UI] ${String(error)}`);
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
    permissionNode: 'cmd.addwarp.admin', // Admin
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

        const config = getConfig();
        if (!config.warps.enabled) {
            sendMessage('§cThe Warps system is currently disabled globally.', executor);
            return;
        }

        const { warpName, x, y, z } = args as unknown as AddWarpArgs;
        const hasX = isNumber(x);
        const hasY = isNumber(y);
        const hasZ = isNumber(z);

        let location;

        if (hasX && hasY && hasZ) {
            location = { x, y, z };
        } else if (!hasX && !hasY && !hasZ) {
            location = executor.location;
        } else {
            sendMessage('§cYou must provide all three coordinates (x, y, z) or none to use your current location.', executor);
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
    permissionNode: 'cmd.delwarp.admin', // Admin
    parameters: [
        {
            name: 'warpName',
            type: 'string',
            optional: true,
            enumOptions: () => {
                try {
                    return warpsManager.listWarps();
                } catch {
                    return [];
                }
            }
        }
    ],
    execute: async (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const config = getConfig();
        if (!config.warps.enabled) {
            sendMessage('§cThe Warps system is currently disabled globally.', executor);
            return;
        }

        const deleteWarpByName = (warpName: string) => {
            const result = warpsManager.deleteWarp(warpName);
            sendMessage(result.success ? `§a${result.message}` : `§c${result.message}`, executor);
        };

        const warpNameArg = (args as unknown as WarpCommandArgs).warpName;
        if (isNonEmptyString(warpNameArg)) {
            deleteWarpByName(warpNameArg);
            return;
        }

        const warpList = warpsManager.listWarps();
        if (warpList.length === 0) {
            sendMessage('§cThere are no warps to delete.', executor);
            return;
        }

        const form = new ActionFormData().title('Delete a Warp').body('Select a warp to delete:');

        for (const warpName of warpList) {
            form.button(warpName);
        }

        try {
            const response = await uiWait(executor, form);
            if (!isDefined(response) || response.canceled) return;

            const selection = (response as ActionFormResponse).selection;
            if (isDefined(selection)) {
                const selectedWarp = warpList[selection];
                if (isNonEmptyString(selectedWarp)) {
                    deleteWarpByName(selectedWarp);
                }
            }
        } catch (error: unknown) {
            errorLog(`[/delwarp UI] ${String(error)}`);
        }
    }
};

export default [warpCommand, addWarpCommand, delWarpCommand];
