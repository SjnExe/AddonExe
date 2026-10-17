import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getAllRanks } from '@core/rankManager.js';
import { isDefined } from '@lib/guards.js';

const listranksCommand: CustomCommand = {
    name: 'listranks',
    description: 'List all configured server ranks and their priorities.',
    category: 'Ranks',
    permissionNode: 'cmd.listranks.member',
    allowConsole: true,
    execute: (executor: CommandExecutor) => {
        const ranksDef = [...getAllRanks()].toSorted((a, b) => a.priority - b.priority);

        if (!isDefined(ranksDef) || ranksDef.length === 0) {
            executor.sendMessage('§cNo ranks configured.');
            return;
        }

        const lines = ranksDef.map((r) => {
            const prefix = r.chatFormatting?.prefixText ?? r.nametagPrefix ?? r.name;
            const groups = r.groups.length > 0 ? r.groups.join(', ') : 'none';
            return `§7- ${prefix}§r §8(ID: §b${r.id}§8, Priority: §f${r.priority}§8, Groups: §e${groups}§8)`;
        });

        executor.sendMessage(`§2--- Configured Server Ranks (${ranksDef.length}) ---§r\n${lines.join('\n')}`);
    }
};

export default listranksCommand;
