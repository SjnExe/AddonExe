import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { loadPlayerData } from '../../../core/playerDataManager.js';
import { IPanelHandler, PanelItem, UIContext } from '../../../core/ui/types.js';
import { showPanel } from '../../../core/uiManager.js';
import * as tpaManager from '../tpaManager.js';

export class TeleportPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'tpaSettingsPanel' || panelId === 'tpaBlockListPanel';
    }

    async getItems(player: mc.Player, panelId: string, _context: UIContext): Promise<PanelItem[]> {
        await Promise.resolve();
        const items: PanelItem[] = [];
        const pData = loadPlayerData(player.id);

        const addBack = (target: string) => {
            items.push({
                id: '__back__',
                text: '§l§8< Back',
                icon: 'textures/gui/controls/left.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: target
            });
        };

        if (panelId === 'tpaSettingsPanel') {
            addBack('gameplayPanel');
            const isEnabled = !pData?.tpaRequestsDisabled;
            items.push({
                id: 'toggleTpa',
                text: isEnabled ? '§2Requests: Allowed' : '§4Requests: Blocked',
                icon: isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'toggleTpa'
            });
            items.push({
                id: 'blockList',
                text: 'Blocked Players',
                icon: 'textures/ui/icon_multiplayer',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'tpaBlockListPanel'
            });
            return items;
        }

        if (panelId === 'tpaBlockListPanel') {
            addBack('tpaSettingsPanel');
            const blocked = pData?.tpaBlockedPlayerIds || [];
            for (const id of blocked) {
                const name = loadPlayerData(id)?.name || id;
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

    async handleResponse(
        player: mc.Player,
        panelId: string,
        response: ActionFormResponse | ModalFormResponse,
        context: UIContext
    ): Promise<void> {
        const selection = (response as ActionFormResponse).selection;

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];

                if (item.actionType === 'openPanel') {
                    return showPanel(player, item.actionValue, { ...context, page: 1 });
                }

                if (item.actionValue === 'toggleTpa') {
                    const newState = tpaManager.toggleTpaRequests(player);
                    player.sendMessage(`§aTPA Requests are now ${newState ? '§4Disabled' : '§2Enabled'}.`);
                    return showPanel(player, 'tpaSettingsPanel', context);
                }

                if (item.actionValue === 'unblockPlayer') {
                    const targetId = item.id;
                    if (targetId) {
                        tpaManager.unblockPlayer(player, targetId);
                        player.sendMessage('§aPlayer unblocked.');
                    }
                    return showPanel(player, 'tpaBlockListPanel', context);
                }
            }
        }
    }
}
