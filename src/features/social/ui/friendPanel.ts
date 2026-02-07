/* eslint-disable @typescript-eslint/require-await */
import * as mc from '@minecraft/server';

import { getPlayerFromCache } from '@core/playerCache.js';
import { getOrCreatePlayer, getPlayer } from '@core/playerDataManager.js';
import { IPanelHandler, PanelItem, UIContext } from '@core/ui/types.js';

export class FriendPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId.startsWith('friend');
    }

    async getItems(player: mc.Player, panelId: string, _context: UIContext): Promise<PanelItem[] | undefined> {
        const pData = getOrCreatePlayer(player);

        if (panelId === 'friendMainPanel') {
            return [
                {
                    id: 'friendListBtn',
                    text: 'List Friends',
                    icon: 'textures/ui/multiplayer',
                    actionType: 'openPanel',
                    actionValue: 'friendListPanel',
                    permissionLevel: 1024
                },
                {
                    id: 'friendAddBtn',
                    text: 'Add Friend',
                    icon: 'textures/ui/plus',
                    actionType: 'openPanel',
                    actionValue: 'friendAddPanel',
                    permissionLevel: 1024
                },
                {
                    id: 'friendReqBtn',
                    text: `Requests (${pData.friendRequests?.length ?? 0})`,
                    icon: 'textures/ui/invite_base',
                    actionType: 'openPanel',
                    actionValue: 'friendRequestsPanel',
                    permissionLevel: 1024
                }
            ];
        }

        if (panelId === 'friendListPanel') {
            const friends = pData.friends ?? [];
            return friends.map((fid) => {
                const fData = getPlayer(fid);
                // Optimization: Use cached lookup
                const onlineP = getPlayerFromCache(fid);
                const status = onlineP ? '§aOnline' : '§cOffline';
                return {
                    id: `friend_${fid}`,
                    text: `${fData ? fData.name : 'Unknown'}\n${status}`,
                    icon: 'textures/ui/steve_head',
                    actionType: 'functionCall',
                    actionValue: `manageFriend:${fid}`,
                    permissionLevel: 1024
                };
            });
        }

        return undefined;
    }
}
