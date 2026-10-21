import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import { formatCurrency } from '@core/utils/index.js';
import { defaultPlaytimeMilestones, getPlayerPlaytimeSummary } from '@features/economy/playtimeRewardsManager.js';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

export async function showPlaytimeRewardsPanel(player: mc.Player): Promise<void> {
    const cfg = getConfig().playtimeRewards;
    const summary = getPlayerPlaytimeSummary(player);

    const statusLine = cfg?.enabled
        ? `§aActive §7(§a+${formatCurrency(summary.afkRewardMoney)} §7every §e${summary.afkIntervalMinutes}m§7 online — next drop in §b${summary.minutesUntilNextAfkDrop}m§7)`
        : '§cDisabled by Admin';

    const bodyLines = [`§7Total Playtime: §e${summary.totalPlaytimeStr} §8(${summary.totalMinutes} mins)`, `§7Stay-Online / AFK Drops: ${statusLine}`, '\n§l§6Playtime Milestones:§r'];

    const form = new ActionFormBuilder().title('Playtime & AFK Rewards').body(bodyLines.join('\n'));

    for (const m of defaultPlaytimeMilestones) {
        const isClaimed = summary.claimedIds.has(m.id);
        const progress = Math.min(100, Math.floor((summary.totalMinutes / m.requiredMinutes) * 100));
        const subtitle = isClaimed
            ? `§aUnlocked • §6${formatCurrency(m.rewardMoney)} +${m.rewardXpLevels}L`
            : `§e${progress}% (${summary.totalMinutes}/${m.requiredMinutes}m) • §6${formatCurrency(m.rewardMoney)}`;

        form.button(`§l§f${m.name}\n§r${subtitle}`, isClaimed ? 'textures/ui/realms_green_check' : 'textures/items/clock_item', async () => {
            await showPlaytimeRewardsPanel(player);
        });
    }

    form.addBackButton(async () => {
        await showPanel(player, 'economyHub');
    });

    await form.show(player);
}

const playtimeCommand: CustomCommand = {
    name: 'playtime',
    aliases: ['pt', 'milestones', 'afkrewards'],
    description: 'View your total playtime, recurring AFK/online reward timer, and playtime milestones.',
    category: 'Economy',
    permissionNode: 'cmd.playtime.member',
    execute: async (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        await showPlaytimeRewardsPanel(executor);
    }
};

export default playtimeCommand;
