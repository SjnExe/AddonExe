import * as mc from '@minecraft/server';
import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { isDefined } from '@lib/guards.js';

const listranksCommand: CustomCommand = {
    name: 'listranks',
    description: 'List all configured ranks.',
    category: 'Ranks',
    permissionNode: 'cmd.listranks.admin',
    allowConsole: true,
    execute: async (executor: CommandExecutor) => {
        const configManager = await import('@core/configManager.js');
        const ranksConfig = configManager.getConfig().ranks as any;

        let ranksDef;
        if (isDefined(ranksConfig) && isDefined(ranksConfig.rankDefinitions)) {
            ranksDef = ranksConfig.rankDefinitions;
        } else {
             const { default: defaultRanksConfig } = await import('@features/ranks/ranksConfig.js');
             ranksDef = defaultRanksConfig.rankDefinitions;
        }

        if (!isDefined(ranksDef) || ranksDef.length === 0) {
            const msg = '§cNo ranks configured.';
            if (executor instanceof mc.Player) executor.sendMessage(msg);
            else executor.sendMessage(msg);
            return;
        }

        let message = `§2Configured Ranks:§r\n`;
        message += ranksDef.map((r: any) => `§7- §b${r.name} §8(ID: ${r.id}, Priority: ${r.priority})`).join('\n');

        if (executor instanceof mc.Player) {
            executor.sendMessage(message);
        } else {
            executor.sendMessage(message);
        }
    }
};

export default listranksCommand;
