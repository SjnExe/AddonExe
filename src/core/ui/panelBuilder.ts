import * as mc from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';

import { getConfig } from '@core/configManager.js';
import { errorLog } from '@core/logger.js';
import { getOrCreatePlayer, loadPlayerData } from '@core/playerDataManager.js';
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

        // 2. Legacy/Fallback for simple config panels (Rules/Links)
        // If no custom handler exists (or it didn't return a form), we check if it's a simple panel
        // that we can build directly from config here.
        // Ideally, these should move to a dedicated handler file (e.g., infoHandlers.ts), but for now we fix it here.
        if (panelId === 'rulesPanel') {
            const config = getConfig() as unknown as MainConfig;
            // Explicitly cast serverInfo to avoid TS18046 if index signature interferes
            const serverInfo = config.serverInfo as { rules: string[] };
            const rules = serverInfo?.rules || [];
            const form = new ActionFormData()
                .title(panelDefinitions[panelId]?.title || 'Rules')
                .body(rules.join('\n\n'))
                .button('§l§8< Back', 'textures/gui/controls/left.png'); // Back button
            return form;
        }

        if (panelId === 'helpfulLinksPanel') {
            const config = getConfig() as unknown as MainConfig;
            // Explicitly cast serverInfo to avoid TS18046
            const serverInfo = config.serverInfo as { helpfulLinks: { title: string; url: string }[] };
            const links = serverInfo?.helpfulLinks || [];
            const form = new ActionFormData()
                .title(panelDefinitions[panelId]?.title || 'Helpful Links')
                .body('Click a button to see the link in chat.')
                .button('§l§8< Back', 'textures/gui/controls/left.png');

            for (const link of links) {
                form.button(link.title, 'textures/ui/world_glyph_color_2x_black_outline');
            }
            return form;
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

    // Delegation: Get title from handler
    const handler = panelRouter.getHandler(panelId);
    if (handler && handler.getTitle) {
        try {
            const dynamicTitle = await handler.getTitle(player, panelId, context);
            if (dynamicTitle) {
                title = dynamicTitle;
            }
        } catch (e) {
            errorLog(`[UIManager] Error getting title for panel ${panelId}`, e);
        }
    }

    if (context.customTitle) title = context.customTitle as string;

    // Resolve placeholders in title
    if (title.includes('{playerName}')) {
        const targetId = (context.targetPlayerId || context.selectedItemId) as string;
        if (targetId) {
            const onlinePlayer = mc.world.getAllPlayers().find((p) => p.id === targetId);
            let pData;
            if (onlinePlayer) {
                pData = getOrCreatePlayer(onlinePlayer);
            } else {
                pData = loadPlayerData(targetId);
            }

            if (pData) title = title.replace('{playerName}', pData.name);
        }
    }

    form.title(title);

    // Delegation: Get body from handler
    if (handler && handler.getBody) {
        try {
            const bodyText = await handler.getBody(player, panelId, context);
            if (bodyText) {
                form.body(bodyText);
            }
        } catch (e) {
            errorLog(`[UIManager] Error getting body for panel ${panelId}`, e);
        }
    }

    for (const item of items) {
        form.button(item.text, item.icon);
    }

    return form;
}
