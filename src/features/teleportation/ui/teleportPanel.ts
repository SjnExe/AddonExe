import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { getConfig } from '@core/configManager.js';
import { loadPlayerData } from '@core/playerDataManager.js';
import { showPanel } from '@core/uiManager.js';
import { isNonEmptyString } from '@lib/guards.js';
import { IPanelHandler, PanelItem, UIContext } from '@ui/types.js';
import { addBackButton } from '@ui/uiUtils.js';
import * as tpaManager from '../tpaManager.js';

export class TeleportPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'tpaSettingsPanel' || panelId === 'tpaBlockListPanel';
    }

    async getItems(player: mc.Player, panelId: string, _context: UIContext): Promise<PanelItem[]> {
        await Promise.resolve();
        const items: PanelItem[] = [];
        const pData = loadPlayerData(player.id);

        if (panelId === 'tpaSettingsPanel') {
            addBackButton(items, 'gameplayPanel');
            const config = getConfig();
            if (!config.tpa.enabled) {
                items.push({
                    id: 'tpaDisabled',
                    text: '§cSystem Globally Disabled',
                    icon: 'textures/ui/warning_alert',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'noop'
                });
            }

            const isEnabled = !(pData?.tpaRequestsDisabled ?? false);
            items.push(
                {
                    id: 'toggleTpa',
                    text: isEnabled ? '§2Incoming Requests: Allowed' : '§4Incoming Requests: Blocked',
                    icon: isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'toggleTpa'
                },
                {
                    id: 'blockList',
                    text: 'Blocked Players',
                    icon: 'textures/ui/icon_multiplayer',
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'tpaBlockListPanel'
                }
            );
            return items;
        }

        if (panelId === 'tpaBlockListPanel') {
            addBackButton(items, 'tpaSettingsPanel');
            const blocked = pData?.tpaBlockedPlayerIds ?? [];
            for (const id of blocked) {
                const name = loadPlayerData(id)?.name ?? id;
                items.push({
                    id: id,
                    text: name,
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'unblockPlayer'
                });
            }
            return items;
        }

        return items;
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: UIContext): Promise<void> {
        const selection = (response as ActionFormResponse).selection;

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];
                if (!item) return;

                if (item.actionType === 'openPanel') {
                    return showPanel(player, item.actionValue, { ...context, page: 1 });
                }

                if (item.actionValue === 'noop') {
                    return showPanel(player, panelId, context);
                }

                if (item.actionValue === 'toggleTpa') {
                    const newState = tpaManager.toggleTpaRequests(player);
                    player.sendMessage(`§aTPA Requests are now ${newState ? '§4Disabled' : '§2Enabled'}.`);
                    return showPanel(player, 'tpaSettingsPanel', context);
                }

                if (item.actionValue === 'unblockPlayer') {
                    const targetId = item.id;
                    if (isNonEmptyString(targetId)) {
                        tpaManager.unblockPlayer(player, targetId);
                        player.sendMessage('§aPlayer unblocked.');
                    }
                    return showPanel(player, 'tpaBlockListPanel', context);
                }
            }
        }
    }
}
