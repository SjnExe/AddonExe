import * as mc from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';

import { Report } from '../../features/moderation/reportManager.js';
import { getConfig } from '../configManager.js';
import { errorLog } from '../logger.js';
import { getOrCreatePlayer, loadPlayerData, PlayerData } from '../playerDataManager.js';
import { panelRouter } from './PanelRouter.js';
import { panelDefinitions } from './panelRegistry.js';
import { MainConfig, PanelDefinition, PanelItem, UIContext } from './types.js';

export function getStaticMenuItems(panelDef: PanelDefinition, permissionLevel: number): PanelItem[] {
    const config = getConfig() as unknown as MainConfig;
    const items = (panelDef.items || [])
        .filter((item: PanelItem) => {
            if (item.actionValue === 'shopMainPanel' && !config.shop.enabled) {
                return false;
            }
            return permissionLevel <= item.permissionLevel;
        })
        .sort((a: PanelItem, b: PanelItem) => (a.sortId || 0) - (b.sortId || 0));

    // Create a copy to avoid mutating the registry
    const resultItems: PanelItem[] = items.map((i) => ({ ...i }));

    if (panelDef.parentPanelId) {
        resultItems.unshift({
            id: '__back__',
            text: '§l§8< Back',
            icon: 'textures/gui/controls/left.png',
            permissionLevel: 1024,
            actionType: 'openPanel',
            actionValue: panelDef.parentPanelId
        });
    }
    return resultItems;
}

export async function buildPanelForm(
    player: mc.Player,
    panelId: string,
    context: UIContext
): Promise<ActionFormData | ModalFormData | null> {
    try {
        // 1. Check Panel Router (Modular System)
        const handler = panelRouter.getHandler(panelId);
        if (handler) {
            if (handler.buildModal) {
                const modal = await handler.buildModal(player, panelId, context);
                if (modal) return modal;
            }
            if (handler.getItems) {
                const items = await handler.getItems(player, panelId, context);
                if (items) {
                    return buildActionFormFromItems(player, panelId, context, items);
                }
            }
        }
        return null;
    } catch (e) {
        errorLog(`[UIManager] Error building panel ${panelId}`, e);
        return null;
    }
}

// Helper to build form from items (used by handlers via buildPanelForm)
async function buildActionFormFromItems(player: mc.Player, panelId: string, context: UIContext, items: PanelItem[]) {
    const form = new ActionFormData();

    const panelDef = panelDefinitions[panelId];
    let title = panelDef ? panelDef.title : panelId;

    if (context.customTitle) title = context.customTitle as string;

    // Resolve placeholders in title
    if (title.includes('{playerName}') && context.selectedItemId) {
        const pData =
            getOrCreatePlayer(mc.world.getAllPlayers().find((p) => p.id === context.selectedItemId) as mc.Player) ||
            loadPlayerData(context.selectedItemId as string);
        if (pData) title = title.replace('{playerName}', pData.name);
    }

    form.title(title);

    await addPanelBody(form, player, panelId, context);

    for (const item of items) {
        form.button(item.text, item.icon);
    }

    return form;
}

// Body logic (stripped down to what's needed)
async function addPanelBody(form: ActionFormData, player: mc.Player, panelId: string, context: UIContext) {
    if (panelId === 'myStatsPanel') {
        const pData = getOrCreatePlayer(player);
        const { getTeamByPlayer } = await import('../../features/teams/teamManager.js');
        const team = getTeamByPlayer(player.id);
        const teamName = team ? `§3${team.name}` : '§8None';
        // Need rankManager
        const { getPlayerRank } = await import('../rankManager.js');
        const rank = getPlayerRank(player, getConfig());
        const { getBounty } = await import('../bountyManager.js');
        const bounty = getBounty(player.id)?.amount ?? 0;
        const { formatCurrency } = await import('../utils.js');

        form.body(
            [
                `§8Rank: §r${rank.chatFormatting?.nameColor ?? '§8'}${rank.name}`,
                `§8Team: ${teamName}`,
                `§8Balance: §2${formatCurrency(pData.balance)}`,
                `§8Bounty on you: §6${formatCurrency(bounty)}`
            ].join('\n')
        );
    }
    // Player details body
    else if (panelId === 'playerActionsPanel' && context.targetPlayerId) {
        // Use top-level loadPlayerData
        const targetId = String(context.targetPlayerId as string | number);
        const pData = (context.targetData as PlayerData | undefined) || loadPlayerData(targetId);
        if (pData) {
            const { getRankById } = await import('../rankManager.js');
            const { getBounty } = await import('../bountyManager.js');
            const { formatCurrency } = await import('../utils.js');
            const rank = getRankById(pData.rankId);
            const bounty = getBounty(context.targetPlayerId as string)?.amount ?? 0;
            form.body(
                [
                    `§8Rank: §r${rank?.chatFormatting?.nameColor ?? '§8'}${rank?.name ?? 'Unknown'}`,
                    `§8Balance: §2${formatCurrency(pData.balance)}`,
                    `§8Bounty: §6${formatCurrency(bounty)}`
                ].join('\n')
            );
        }
    }
    // Report details body
    else if (panelId === 'reportActionsPanel' && context.targetReport) {
        const targetReport = context.targetReport as Report;
        form.body(
            [
                `§8Report ID: §6${String(targetReport.id)}`,
                `§8Reported Player: §6${targetReport.reportedPlayerName}`,
                `§8Reporter: §6${targetReport.reporterName}`,
                `§8Reason: §6${targetReport.reason}`,
                `§8Status: §6${targetReport.status}`,
                `§8Date: §6${new Date(targetReport.timestamp).toLocaleString()}`
            ].join('\n')
        );
    }
    // Placeholders
    else if (panelId === 'placeholderListPanel') {
        form.body(
            `§l§6Global Placeholders§r (Scoreboard, Floating Text)\n` +
                `{server_name}, {tps}, {online}, {max_players}, {time}, {date}\n\n` +
                `§l§dPersonal Placeholders§r (Action Bar Only)\n` +
                `{name}, {money}, {rank}, {kills}, {deaths}, {streak}, {kdr}, {playtime}, {team}, {ping}, {x}, {y}, {z}, {dimension}`
        );
    }
}
