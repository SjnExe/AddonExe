import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getWorldBorder, setWorldBorder } from '@features/essentials/worldBorderManager.js';
import * as mc from '@minecraft/server';

const worldborderCommand: CustomCommand = {
    name: 'worldborder',
    aliases: ['wb'],
    description: 'Manage the world border.',
    category: 'Essentials',
    permissionNode: 'cmd.worldborder.admin',
    allowConsole: true,
    parameters: [
        { name: 'action', type: 'string', enumOptions: ['on', 'off', 'set', 'info'] },
        { name: 'radius', type: 'float', optional: true },
        { name: 'x', type: 'float', optional: true },
        { name: 'z', type: 'float', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const action = args.action as string;

        if (action === 'info') {
            const config = getWorldBorder();
            const msg = `§2World Border Info:\n§7Status: ${config.enabled ? '§aON' : '§cOFF'}\n§7Center: §b${config.centerX}, ${config.centerZ}\n§7Radius: §b${config.radius}\n§7Dimension: §b${config.dimension}`;
            if (executor instanceof mc.Player) executor.sendMessage(msg);
            else executor.sendMessage(msg);
            return;
        }

        if (action === 'on') {
            setWorldBorder(true);
            const msg = '§aWorld border has been enabled.';
            if (executor instanceof mc.Player) executor.sendMessage(msg);
            else executor.sendMessage(msg);
            return;
        }

        if (action === 'off') {
            setWorldBorder(false);
            const msg = '§cWorld border has been disabled.';
            if (executor instanceof mc.Player) executor.sendMessage(msg);
            else executor.sendMessage(msg);
            return;
        }

        if (action === 'set') {
            const radius = args.radius as number | undefined;
            if (radius === undefined) {
                const msg = '§cYou must provide a radius to set the border.';
                if (executor instanceof mc.Player) executor.sendMessage(msg);
                else executor.sendMessage(msg);
                return;
            }

            let x = args.x as number | undefined;
            let z = args.z as number | undefined;
            let dim = 'minecraft:overworld';

            if (executor instanceof mc.Player) {
                if (x === undefined) x = executor.location.x;
                if (z === undefined) z = executor.location.z;
                dim = executor.dimension.id;
            } else {
                if (x === undefined) x = 0;
                if (z === undefined) z = 0;
            }

            setWorldBorder(true, x, z, radius, dim);
            const msg = `§aWorld border set to radius ${radius} at center ${x}, ${z} in ${dim}.`;
            if (executor instanceof mc.Player) executor.sendMessage(msg);
            else executor.sendMessage(msg);
        }
    }
};

export default worldborderCommand;
