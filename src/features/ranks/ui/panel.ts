import { getPlayerNameById, loadPlayerData, setPlayerRanks } from '@core/playerDataManager.js';
import { getAllRanks } from '@core/rankManager.js';
import { showPanel } from '@core/uiManager.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';

export async function showRankManagementPanel(player: mc.Player, targetPlayerId: string, page: number = 1): Promise<void> {
    const targetName = getPlayerNameById(targetPlayerId) || targetPlayerId;
    const form = new ActionFormBuilder().title(`Ranks: ${targetName}`);

    const targetData = loadPlayerData(targetPlayerId);
    if (!targetData) {
        player.sendMessage(`§cCannot manage ranks. Player data not found.`);
        return showPanel(player, 'playerActionsPanel', { targetPlayerId });
    }

    const allRanks = getAllRanks();

    // Check if player has the rank
    allRanks.forEach((rank) => {
        const hasRank = targetData.ranks.includes(rank.id);
        const icon = hasRank ? 'textures/ui/realms_green_check' : 'textures/ui/cancel';
        const buttonText = `§l${rank.name}§r\n${hasRank ? '§2Click to Remove' : '§4Click to Add'}`;

        form.button(buttonText, icon, async () => {
            if (hasRank) {
                // If it's their only rank, maybe prevent removal or fallback to default
                if (targetData.ranks.length === 1 && targetData.ranks[0] === rank.id) {
                    player.sendMessage(`§cCannot remove the player's only rank.`);
                } else {
                    const newRanks = targetData.ranks.filter((r) => r !== rank.id);
                    setPlayerRanks(targetPlayerId, newRanks);
                    player.sendMessage(`§aRemoved rank ${rank.name} from ${targetName}.`);
                }
            } else {
                const newRanks = [...targetData.ranks, rank.id];
                setPlayerRanks(targetPlayerId, newRanks);
                player.sendMessage(`§aAdded rank ${rank.name} to ${targetName}.`);
            }
            await showRankManagementPanel(player, targetPlayerId, page);
        });
    });

    form.addBackButton(async () => {
        await showPanel(player, 'playerActionsPanel', { targetPlayerId });
    });

    await form.show(player);
}
