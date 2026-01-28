import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getOrCreatePlayer, updatePlayerData } from '@core/playerDataManager.js';
import { showPanel } from '@core/uiManager.js';
import { showConfirmationDialog } from '@ui/components.js';
import { PanelItem, UIContext } from '@ui/panelRegistry.js';
import { IPanelHandler } from '@ui/types.js';
import { addBackButton } from '@ui/uiUtils.js';
import { acceptFriendRequest, removeFriend, sendFriendRequest } from '../friendManager.js';
import { isNonEmptyString } from '@lib/guards.js';

export class FriendPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId.startsWith('friend');
    }

    async getItems(player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        const items: PanelItem[] = [];
        const pData = getOrCreatePlayer(player);

        if (panelId === 'friendMainPanel') {
            addBackButton(items, 'gameplayPanel');

            items.push({
                id: 'addFriend',
                text: 'Add Friend',
                icon: 'textures/ui/color_plus',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'friendAddPanel'
            });

            const pendingCount = pData.friendRequests?.length ?? 0;
            items.push(
                {
                    id: 'requests',
                    text: `Requests (${pendingCount})`,
                    icon: 'textures/ui/mail_icon',
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'friendRequestsPanel'
                },
                {
                    id: 'settings',
                    text: 'Settings',
                    icon: 'textures/ui/icon_setting',
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'friendSettingsPanel'
                }
            );

            // List Friends
            if (pData.friends && pData.friends.length > 0) {
                // Use for...of loop to support await inside
                const { getPlayerNameById } = await import('@core/playerDataManager.js');

                for (const fid of pData.friends) {
                    const onlineP = mc.world.getAllPlayers().find((p) => p.id === fid);
                    const status = onlineP ? '§2● Online' : '§8● Offline';
                    // We need name. If online, use player object. If offline, use cache or fallback.
                    const name = getPlayerNameById(fid) ?? 'Unknown';

                    items.push({
                        id: fid,
                        text: `${name}\n${status}`,
                        icon: 'textures/ui/icon_steve',
                        permissionLevel: 1024,
                        actionType: 'openPanel',
                        actionValue: 'friendActionPanel'
                    });
                }
            } else {
                items.push({
                    id: 'no_friends',
                    text: '§8No friends added.',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'noop'
                });
            }
            return items;
        }

        if (panelId === 'friendRequestsPanel') {
            addBackButton(items, 'friendMainPanel');
            const requests = pData.friendRequests || [];

            if (requests.length === 0) {
                items.push({
                    id: 'no_req',
                    text: 'No pending requests',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'noop'
                });
            } else {
                for (const req of requests) {
                    items.push({
                        id: req.senderName, // Use name for easy identification in handler
                        text: `Request from ${req.senderName}`,
                        permissionLevel: 1024,
                        actionType: 'functionCall',
                        actionValue: 'manageFriendRequest'
                    });
                }
            }
            return items;
        }

        if (panelId === 'friendActionPanel') {
            addBackButton(items, 'friendMainPanel');
            const targetId = context.selectedItemId as string;
            if (!targetId) return items;

            items.push(
                {
                    id: 'remove',
                    text: '§4Remove Friend',
                    icon: 'textures/ui/trash',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'removeFriend'
                },
                {
                    id: 'tpa',
                    text: 'Teleport',
                    icon: 'textures/items/ender_pearl',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'tpaFriend'
                }
            );

            return items;
        }

        return items;
    }

    buildModal(player: mc.Player, panelId: string, _context: UIContext): Promise<ModalFormData | undefined | void> {
        if (panelId === 'friendAddPanel') {
            return Promise.resolve(
                new ModalFormData().title('Add Friend').textField('Player Name', 'Enter exact name')
            );
        }

        if (panelId === 'friendSettingsPanel') {
            const pData = getOrCreatePlayer(player);
            return Promise.resolve(
                new ModalFormData()
                    .title('Friend Settings')
                    .toggle('Auto-Accept Friend TPA', { defaultValue: pData.friendSettings?.autoTpAccept ?? false })
            );
        }

        return Promise.resolve();
    }

    async handleResponse(
        player: mc.Player,
        panelId: string,
        response: ActionFormResponse | ModalFormResponse,
        context: UIContext
    ): Promise<void> {
        const selection = (response as ActionFormResponse).selection;
        const values = (response as ModalFormResponse).formValues;

        if (panelId === 'friendAddPanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'friendMainPanel');
            const [name] = values as string[];
            if (isNonEmptyString(name)) {
                const res = sendFriendRequest(player, name);
                player.sendMessage(res);
            }
            return showPanel(player, 'friendMainPanel');
        }

        if (panelId === 'friendSettingsPanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'friendMainPanel');
            const [autoTp] = values as boolean[];
            if (autoTp === undefined) return showPanel(player, 'friendMainPanel');

            updatePlayerData(player.id, (data) => {
                if (!data.friendSettings) data.friendSettings = { autoTpAccept: false };
                data.friendSettings.autoTpAccept = autoTp;
            });
            player.sendMessage('§aSettings saved.');
            return showPanel(player, 'friendMainPanel');
        }

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];
                if (!item) return;

                if (item.actionValue === 'noop') return;

                if (item.actionType === 'openPanel') {
                    return showPanel(player, item.actionValue, {
                        ...context,
                        selectedItemId: item.id,
                        id: item.id
                    });
                }

                if (item.actionValue === 'manageFriendRequest') {
                    const senderName = item.id;
                    await showConfirmationDialog(player, {
                        title: 'Friend Request',
                        body: `Accept request from ${senderName}?`,
                        confirmButtonText: '§2Accept',
                        cancelButtonText: 'Cancel',
                        onConfirm: () => {
                            const res = acceptFriendRequest(player, senderName);
                            player.sendMessage(res);
                            return showPanel(player, 'friendMainPanel');
                        },
                        onCancel: () => showPanel(player, 'friendRequestsPanel')
                    });
                    return;
                }

                if (item.actionValue === 'removeFriend') {
                    const targetId = context.selectedItemId as string;
                    const { getPlayerNameById } = await import('@core/playerDataManager.js');
                    const name = getPlayerNameById(targetId) ?? 'Unknown';

                    await showConfirmationDialog(player, {
                        title: 'Remove Friend',
                        body: `Are you sure you want to remove ${name}?`,
                        confirmButtonText: '§4Remove',
                        cancelButtonText: 'Cancel',
                        onConfirm: () => {
                            const res = removeFriend(player, name); // removeFriend handles by name
                            player.sendMessage(res);
                            return showPanel(player, 'friendMainPanel');
                        },
                        onCancel: () => showPanel(player, 'friendMainPanel')
                    });
                    return;
                }

                if (item.actionValue === 'tpaFriend') {
                    // Trigger TPA logic
                    const targetId = context.selectedItemId as string;
                    // We need target player object
                    const targetPlayer = mc.world.getAllPlayers().find((p) => p.id === targetId);
                    if (targetPlayer) {
                        player.runCommand(`tpa "${targetPlayer.name}"`);
                    } else {
                        player.sendMessage('§cPlayer is offline.');
                    }
                    return;
                }
            }
        }
    }
}
