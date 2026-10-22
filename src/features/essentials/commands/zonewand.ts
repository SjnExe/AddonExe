import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { clearZoneSelection, getZoneSelection, giveZoneSelectionWand, setZoneSelectionPos } from '@features/essentials/zoneSelectionManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

const zoneWandCommand: CustomCommand = {
    name: 'zonewand',
    aliases: ['wand', 'pos1', 'pos2'],
    description: 'Gives the World Protection Selection Wand or sets Pos1/Pos2 at your feet.',
    category: 'Administration',
    permissionNode: 'cmd.worldborder.admin',
    parameters: [
        {
            name: 'action',
            type: 'string',
            optional: true,
            enumOptions: ['wand', 'pos1', 'pos2', 'clear', 'status']
        }
    ],
    execute: (executor: CommandExecutor, args: { action?: string }) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const sub = isNonEmptyString(args.action) ? args.action.toLowerCase() : 'wand';
        if (sub === 'pos1') {
            setZoneSelectionPos(executor, 'pos1', executor.location);
            return;
        }
        if (sub === 'pos2') {
            setZoneSelectionPos(executor, 'pos2', executor.location);
            return;
        }
        if (sub === 'clear') {
            clearZoneSelection(executor.id);
            executor.sendMessage('§aCleared your Pos1/Pos2 zone selection.');
            return;
        }
        if (sub === 'status') {
            const sel = getZoneSelection(executor.id);
            const p1 = isDefined(sel?.pos1) ? `${sel.pos1.x} ${sel.pos1.y} ${sel.pos1.z}` : 'Not set';
            const p2 = isDefined(sel?.pos2) ? `${sel.pos2.x} ${sel.pos2.y} ${sel.pos2.z}` : 'Not set';
            executor.sendMessage(`§d[ZoneWand] §bPos1: §f${p1} §8| §ePos2: §f${p2}`);
            return;
        }

        giveZoneSelectionWand(executor);
    }
};

export default zoneWandCommand;
