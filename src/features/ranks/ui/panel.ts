import { getConfig } from '@core/configManager.js';
import { canAssignRankToPlayer, isAdmin, isOwner } from '@core/permissionEngine.js';
import { getPlayerFromCache } from '@core/playerCache.js';
import { getPlayerNameById, loadPlayerData, setPlayerRanks } from '@core/playerDataManager.js';
import { canTarget, getAllRanks, updatePlayerNameTag } from '@core/rankManager.js';
import { showPanel } from '@core/uiManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';

export async function showRankManagementPanel(player: mc.Player, targetPlayerId: string, page: number = 1): Promise<void> {
    if (!isAdmin(player)) {
        player.sendMessage('§cYou do not have permission to manage player ranks.');
        return showPanel(player, 'playerActionsPanel', { targetPlayerId });
    }

    const targetName = getPlayerNameById(targetPlayerId) || targetPlayerId;
    const targetData = loadPlayerData(targetPlayerId);
    if (!targetData) {
        player.sendMessage('§cCannot manage ranks. Player data not found.');
        return showPanel(player, 'playerActionsPanel', { targetPlayerId });
    }

    const viewerIsOwner = isOwner(player);
    if (!viewerIsOwner && player.id !== targetPlayerId && !canTarget(player, targetPlayerId)) {
        player.sendMessage('§cYou cannot manage ranks for a player with the same or higher rank than you.');
        return showPanel(player, 'playerActionsPanel', { targetPlayerId });
    }

    const allRanks = [...getAllRanks()].toSorted((a, b) => a.priority - b.priority);
    const currentRanksStr = targetData.ranks.join(', ') || 'member';

    const form = new ActionFormBuilder().title(`Ranks: ${targetName}`).body(`§7Assigned Ranks: §e${currentRanksStr}\n§7Select a rank below to grant or revoke it:`);

    for (const rank of allRanks) {
        if (rank.id === 'owner') {
            continue;
        }

        const hasRank = targetData.ranks.includes(rank.id);
        const assignCheck = canAssignRankToPlayer(player, targetPlayerId, rank.id);
        const prefix = rank.chatFormatting?.prefixText ?? rank.nametagPrefix ?? rank.name;

        let buttonText = `§l${prefix}§r §8(Priority: ${rank.priority})\n${hasRank ? '§a✔ Assigned — Click to Remove' : '§7Click to Grant'}`;
        let icon = hasRank ? 'textures/ui/realms_green_check' : 'textures/ui/cancel';

        if (!assignCheck.allowed) {
            buttonText = `§l${prefix}§r\n§8[Owner Only]`;
            icon = 'textures/ui/lock_color';
        } else if (hasRank && rank.locked) {
            buttonText = `§l${prefix}§r\n§8[Core Default Rank]`;
        }

        form.button(buttonText, icon, async () => {
            if (!assignCheck.allowed) {
                player.sendMessage(assignCheck.reason ?? '§cYou do not have permission to modify this rank.');
                await showRankManagementPanel(player, targetPlayerId, page);
                return;
            }

            if (hasRank) {
                if (targetData.ranks.length === 1 && targetData.ranks[0] === rank.id) {
                    player.sendMessage("§cCannot remove the player's only rank.");
                } else if (rank.locked) {
                    player.sendMessage(`§cCannot remove a core system rank (${rank.name}).`);
                } else {
                    const newRanks = targetData.ranks.filter((r) => r !== rank.id);
                    setPlayerRanks(targetPlayerId, newRanks);
                    const onlineTarget = getPlayerFromCache(targetPlayerId);
                    if (isDefined(onlineTarget)) {
                        updatePlayerNameTag(onlineTarget, getConfig());
                        onlineTarget.sendMessage(`§cYour rank §e${rank.name}§c has been removed.`);
                    }
                    player.sendMessage(`§aRemoved rank ${rank.name} from ${targetName}.`);
                }
            } else {
                const newRanks = [...targetData.ranks, rank.id];
                setPlayerRanks(targetPlayerId, newRanks);
                const onlineTarget = getPlayerFromCache(targetPlayerId);
                if (isDefined(onlineTarget)) {
                    updatePlayerNameTag(onlineTarget, getConfig());
                    onlineTarget.sendMessage(`§aYou have been granted the rank §e${rank.name}§a!`);
                }
                player.sendMessage(`§aAdded rank ${rank.name} to ${targetName}.`);
            }

            await showRankManagementPanel(player, targetPlayerId, page);
        });
    }

    form.addBackButton(async () => {
        await showPanel(player, 'playerActionsPanel', { targetPlayerId });
    });

    await form.show(player);
}
