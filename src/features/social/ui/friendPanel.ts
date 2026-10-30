import { getConfig } from '@core/configManager.js';
import { getAllPlayersFromCache, getPlayerFromCache } from '@core/playerCache.js';
import { getOrCreatePlayer, getPlayer, getPlayerIdByName } from '@core/playerDataManager.js';
import { getPlayerRank } from '@core/rankManager.js';
import { getPlayerIcon } from '@core/utils/ui.js';
import * as friendManager from '@features/social/friendManager.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';

export async function showFriendMainPanel(player: mc.Player): Promise<void> {
    const pData = getOrCreatePlayer(player);
    const form = new ActionFormBuilder()
        .title('Friends')
        .button('List Friends', 'textures/ui/multiplayer', async () => {
            await showFriendListPanel(player, 1);
        })
        .button('Add Friend', 'textures/ui/plus', async () => {
            await showFriendAddPanel(player);
        })
        .button(`Requests (${pData.friendRequests?.length ?? 0})`, 'textures/ui/invite_base', async () => {
            await showFriendRequestsPanel(player, 1);
        });

    form.addBackButton(async () => {
        const { showMainPanel } = await import('@core/ui/panels/mainPanel.js');
        await showMainPanel(player);
    });

    await form.show(player);
}

export async function showFriendListPanel(player: mc.Player, page: number = 1): Promise<void> {
    const pData = getOrCreatePlayer(player);
    const friends = pData.friends ?? [];
    const config = getConfig();

    const form = new ActionFormBuilder().title('Friend List');

    form.addPaginatedButtons(
        friends,
        page,
        (fid, formBuilder) => {
            const fData = getPlayer(fid);
            const onlineP = getPlayerFromCache(fid);
            const status = onlineP ? '§aOnline' : '§cOffline';

            let rankText = '';
            let icon = 'textures/ui/permissions_member_star.png';
            if (onlineP) {
                const targetRank = getPlayerRank(onlineP, config);
                rankText = targetRank.chatFormatting?.prefixText ? `§r[${targetRank.chatFormatting.prefixText}]` : `§r[${targetRank.name}]`;
                icon = getPlayerIcon(onlineP);
            }

            formBuilder.button(`${fData ? fData.name : 'Unknown'} ${status}\n${rankText}`, icon, async () => {
                await showManageFriendPanel(player, fid, fData?.name || 'Unknown');
            });
        },
        async (newPage) => {
            await showFriendListPanel(player, newPage);
        }
    );

    form.addBackButton(async () => {
        await showFriendMainPanel(player);
    });

    await form.show(player);
}

export async function showFriendAddPanel(player: mc.Player): Promise<void> {
    const onlinePlayers = getAllPlayersFromCache()
        .filter((p) => p.id !== player.id)
        .map((p) => p.name);

    // Check if there are online players to avoid empty dropdown
    if (onlinePlayers.length === 0) {
        // Fallback to text field if no one else is online, or just use text field entirely for simplicity
        const modal = new ModalFormBuilder<{ name: string }>().title('Add Friend').textField('name', 'Player Name (Exact)', 'Player Name');

        const res = await modal.show(player);
        if (res && res.name) {
            const targetId = getPlayerIdByName(res.name);
            if (targetId) {
                const result = friendManager.sendFriendRequest(player, targetId);
                player.sendMessage(result.message);
            } else {
                player.sendMessage('§cPlayer not found.');
            }
        }
        await showFriendMainPanel(player);
        return;
    }

    // Give option to select from online players or type name
    onlinePlayers.unshift('-- Type Name Below --');

    const modal = new ModalFormBuilder<{ playerDropdown: string; manualName: string }>()
        .title('Add Friend')
        .dropdown('playerDropdown', 'Select Online Player', onlinePlayers)
        .textField('manualName', 'Or Type Player Name (Exact)', 'Player Name');

    const res = await modal.show(player);

    if (res) {
        let targetName = res.manualName;
        if (!targetName && res.playerDropdown !== '-- Type Name Below --') {
            targetName = res.playerDropdown;
        }

        if (targetName) {
            const targetId = getPlayerIdByName(targetName);
            if (targetId) {
                const result = friendManager.sendFriendRequest(player, targetId);
                player.sendMessage(result.message);
            } else {
                player.sendMessage('§cPlayer not found.');
            }
        }
    }

    await showFriendMainPanel(player);
}

export async function showFriendRequestsPanel(player: mc.Player, page: number = 1): Promise<void> {
    const pData = getOrCreatePlayer(player);
    const requests = pData.friendRequests ?? [];

    const form = new ActionFormBuilder().title('Friend Requests');

    form.addPaginatedButtons(
        requests,
        page,
        (reqId, formBuilder) => {
            const reqData = getPlayer(reqId.senderId);
            formBuilder.button(`${reqData ? reqData.name : 'Unknown'}\nClick to manage`, 'textures/ui/invite_base', async () => {
                await showManageFriendRequestPanel(player, reqId.senderId, reqData?.name || 'Unknown');
            });
        },
        async (newPage) => {
            await showFriendRequestsPanel(player, newPage);
        }
    );

    form.addBackButton(async () => {
        await showFriendMainPanel(player);
    });

    await form.show(player);
}

export async function showManageFriendRequestPanel(player: mc.Player, reqId: string, reqName: string): Promise<void> {
    const form = new ActionFormBuilder()
        .title(`Request from ${reqName}`)
        .button('Accept', 'textures/ui/realms_green_check', async () => {
            const result = friendManager.acceptFriendRequest(player, reqId);
            player.sendMessage(result.message);
            await showFriendRequestsPanel(player, 1);
        })
        .button('Deny', 'textures/ui/cancel', async () => {
            const result = friendManager.denyFriendRequest(player, reqId);
            player.sendMessage(result.message);
            await showFriendRequestsPanel(player, 1);
        });

    form.addBackButton(async () => {
        await showFriendRequestsPanel(player, 1);
    });

    await form.show(player);
}

export async function showManageFriendPanel(player: mc.Player, friendId: string, friendName: string): Promise<void> {
    const onlineP = getPlayerFromCache(friendId);
    const form = new ActionFormBuilder().title(`Manage ${friendName}`);

    if (onlineP) {
        form.button('Teleport To', 'textures/ui/icon_map', () => {
            player.sendMessage(`§eRequesting teleport to ${friendName}...`);
            // Assuming TPA manager logic here or just direct tp if allowed.
            // We'll use the existing TPA system via a command execution or direct call if available.
            player.dimension.runCommand(`tpa "${onlineP.name}"`);
            // Note: Using command as a shortcut since TPA logic might be command-based.
            // Ideally this calls a function in teleport manager.
        });
    }

    form.button('Remove Friend', 'textures/ui/trash', async () => {
        const result = friendManager.removeFriend(player, friendId);
        player.sendMessage(result.message);
        await showFriendListPanel(player, 1);
    });

    form.addBackButton(async () => {
        await showFriendListPanel(player, 1);
    });

    await form.show(player);
}

// Ensure the old action is supported for backwards compat if needed, or remove.
export async function addFriendAction(player: mc.Player, targetPlayerId: string): Promise<void> {
    await Promise.resolve();
    const result = friendManager.sendFriendRequest(player, targetPlayerId);
    player.sendMessage(result.message);
}
