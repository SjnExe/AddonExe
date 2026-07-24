import { getPlayerNameById, loadPlayerData, setPlayerRanks } from '@core/playerDataManager.js';
import { getAllRanks } from '@core/rankManager.js';
import { showPanel } from '@core/uiManager.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';

// oxlint-disable-next-line oxc/only-used-in-recursion
export async function showRankManagementPanel(player: mc.Player, targetPlayerId: string, _page: number = 1): Promise<void> {
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

        // Prevent editing owner rank from UI
        if (rank.id === 'owner') {
            return;
        }

        // Prevent removing locked ranks like member if they already have it
        let buttonText = `§l${rank.name}§r\n${hasRank ? '§2Click to Remove' : '§4Click to Add'}`;
        if (hasRank && rank.locked) {
            buttonText = `§l${rank.name}§r\n§8Cannot be removed`;
        }

        form.button(buttonText, icon, async () => {
            const { getConfig } = await import('@core/configManager.js');
            const { getPlayerRank } = await import('@core/rankManager.js');
            const editorRank = getPlayerRank(player, getConfig());

            // Require owner rank to give/remove admin rank
            if (rank.id === 'admin' && editorRank.id !== 'owner') {
                player.sendMessage('§cOnly players with the Owner rank can modify the Admin rank.');
                return;
            }

            if (hasRank) {
                // If it's their only rank, prevent removal
                if (targetData.ranks.length === 1 && targetData.ranks[0] === rank.id) {
                    player.sendMessage(`§cCannot remove the player's only rank.`);
                } else if (rank.locked) {
                    player.sendMessage(`§cCannot remove a core system rank (${rank.name}).`);
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
            await showRankManagementPanel(player, targetPlayerId, _page);
        });
    });

    form.addBackButton(async () => {
        await showPanel(player, 'playerActionsPanel', { targetPlayerId });
    });

    await form.show(player);
}
