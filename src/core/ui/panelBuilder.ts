import * as mc from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';

import { getConfig } from '@core/configManager.js';
import { errorLog } from '@core/logger.js';
import { getValueFromPath } from '@core/objectUtils.js';
import { hasPermission } from '@core/permissionEngine.js';
import { getPlayerFromCache } from '@core/playerCache.js';
import { getOrCreatePlayer, loadPlayerData } from '@core/playerDataManager.js';

import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { panelRouter } from '@ui/PanelRouter.js';
import { panelDefinitions } from '@ui/panelRegistry.js';
import { MainConfig, PanelDefinition, PanelItem, UIContext } from '@ui/types.js';

export function getStaticMenuItems(player: mc.Player, panelDef: PanelDefinition, context?: UIContext): PanelItem[] {
    const config = getConfig() as unknown as MainConfig;
    const items = (isDefined(panelDef.items) ? panelDef.items : [])
        .filter((item: PanelItem) => {
            return hasPermission(player, item.permission ?? 'ui.panel.member');
        })
        .map((item: PanelItem) => {
            const newItem = { ...item };
            let isDisabled = false;
            if (isNonEmptyString(item.requiresFeature)) {
                const isEnabled = getValueFromPath(config, item.requiresFeature);
                if (isEnabled !== true) {
                    isDisabled = true;
                }
            } else if (item.actionValue === 'shopMainPanel' && (isDefined(config.shop) ? config.shop.enabled : undefined) !== true) {
                // Fallback for older hardcoded definition
                isDisabled = true;
            }

            if (isDisabled) {
                newItem.text += '\n[§4Disabled]';
            }
            return newItem;
        })
        .toSorted((a: PanelItem, b: PanelItem) => (a.sortId ?? 0) - (b.sortId ?? 0));

    // Create a copy to avoid mutating the registry
    const resultItems: PanelItem[] = items.map((i) => ({ ...i }));

    if (isNonEmptyString(panelDef.parentPanelId) || (isDefined(context) && isNonEmptyString(context.returnPanel))) {
        resultItems.unshift({
            id: '__back__',
            text: '< Back',
            icon: 'textures/gui/controls/left.png',
            permission: 'ui.panel.member',
            actionType: 'openPanel',
            actionValue: isDefined(context) && isNonEmptyString(context.returnPanel) ? context.returnPanel : (panelDef.parentPanelId as string)
        });
    }
    return resultItems;
}

export async function buildPanelForm(player: mc.Player, panelId: string, context: UIContext): Promise<ActionFormData | ModalFormData | undefined> {
    try {
        const panelDef = panelDefinitions[panelId];
        if (panelDef && isNonEmptyString(panelDef.permission) && !hasPermission(player, panelDef.permission)) {
            // Access Denied
            return undefined;
        }

        // 1. Check Panel Router (Modular System)
        const handler = panelRouter.getHandler(panelId);
        if (isDefined(handler)) {
            if (handler.buildModal !== undefined) {
                const modal = await handler.buildModal(player, panelId, context);
                if (isDefined(modal)) return modal as ModalFormData;
            }
            if (handler.getItems !== undefined) {
                const items = await handler.getItems(player, panelId, context);
                if (isDefined(items)) {
                    return buildActionFormFromItems(player, panelId, context, items);
                }
            }
        }

        // 2. Fallback: Static Definition
        if (isDefined(panelDef)) {
            const items = getStaticMenuItems(player, panelDef, context);
            if (items.length > 0 || isDefined(panelDef.parentPanelId) || isNonEmptyString(context.returnPanel)) {
                return buildActionFormFromItems(player, panelId, context, items);
            }
        }

        return undefined;
    } catch (error) {
        errorLog(`[UIManager] Error building panel ${panelId}`, error);
        return undefined;
    }
}

// Helper to build form from items (used by handlers via buildPanelForm)

async function buildActionFormFromItems(player: mc.Player, panelId: string, context: UIContext, items: PanelItem[]) {
    const form = new ActionFormData();

    const panelDef = panelDefinitions[panelId];
    let title = panelDef ? panelDef.title : panelId;

    // Delegation: Get title from handler
    const handler = panelRouter.getHandler(panelId);
    if (isDefined(handler) && handler.getTitle !== undefined) {
        try {
            const dynamicTitle = await handler.getTitle(player, panelId, context);
            if (isNonEmptyString(dynamicTitle)) {
                title = dynamicTitle;
            }
        } catch (error) {
            errorLog(`[UIManager] Error getting title for panel ${panelId}`, error);
        }
    }

    if (isNonEmptyString(context.customTitle)) title = context.customTitle;

    // Resolve placeholders in title
    if (title.includes('{playerName}')) {
        const targetId = (context.targetPlayerId ?? context.selectedItemId) as string;
        if (isNonEmptyString(targetId)) {
            // Optimization: Use cache instead of scanning world players
            const onlinePlayer = getPlayerFromCache(targetId);
            const pData = isDefined(onlinePlayer) ? getOrCreatePlayer(onlinePlayer) : loadPlayerData(targetId);

            if (isDefined(pData)) title = title.replace('{playerName}', pData.name);
        }
    }

    form.title(title);

    // Delegation: Get body from handler
    if (isDefined(handler) && handler.getBody !== undefined) {
        try {
            const bodyText = await handler.getBody(player, panelId, context);
            if (isNonEmptyString(bodyText)) {
                form.body(bodyText);
            }
        } catch (error) {
            errorLog(`[UIManager] Error getting body for panel ${panelId}`, error);
        }
    } else if (isDefined(panelDef) && isDefined(panelDef.body)) {
        // Fallback to static body
        form.body(panelDef.body);
    }

    for (const item of items) {
        form.button(item.text, item.icon);
    }

    return form;
}
