/* eslint-disable @typescript-eslint/require-await */
import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { getPlayerFromCache } from '@core/playerCache.js';
import { getOrCreatePlayer, getPlayer } from '@core/playerDataManager.js';
import { getPlayerRank } from '@core/rankManager.js';
import { IPanelHandler, PanelItem, UIContext } from '@ui/types.js';
import { getPlayerIcon } from '@core/utils/ui.js';

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
            const config = getConfig();
            return friends.map((fid) => {
                const fData = getPlayer(fid);
                // Optimization: Use cached lookup
                const onlineP = getPlayerFromCache(fid);
                const status = onlineP ? '§aOnline' : '§cOffline';

                let rankText = '';
                let icon = 'textures/ui/permissions_member_star.png';
                if (onlineP) {
                    const targetRank = getPlayerRank(onlineP, config);
                    rankText = targetRank.chatFormatting?.prefixText ? `§r[${targetRank.chatFormatting.prefixText}]` : `§r[${targetRank.name}]`;
                    icon = getPlayerIcon(onlineP);
                }

                return {
                    id: `friend_${fid}`,
                    text: `${fData ? fData.name : 'Unknown'} ${status}\n${rankText}`,
                    icon: icon,
                    actionType: 'functionCall',
                    actionValue: `manageFriend:${fid}`,
                    permissionLevel: 1024
                };
            });
        }

        return undefined;
    }
}
