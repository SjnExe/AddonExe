import * as configManager from '@core/config/configManager.js';
import { getAllPlayersFromCache, getPlayerFromCache } from '@core/data/playerCache.js';
import { getOrCreatePlayer, getPlayer, getPlayerNameById, loadPlayerData } from '@core/data/playerDataManager.js';
import { getPlayerRank } from '@core/permissions/rankManager.js';
import { getPlayerIcon } from '@core/utils/ui.js';
import * as friendManager from '@features/social/friends/manager.js';
import * as tpaManager from '@features/teleport/tpaManager.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

export async function showFriendMainPanel(player: mc.Player): Promise<void> {
  const pData = getOrCreatePlayer(player);
  const validReqs = friendManager.cleanExpiredRequests(player.id);
  const autoTp = pData.friendSettings?.autoTpAccept ?? false;

  const form = new ActionFormBuilder()
    .title('Friends')
    .body(`§7Friends: §f${pData.friends?.length ?? 0} §8| §7Pending Requests: §e${validReqs.length}`)
    .button(`List Friends (${pData.friends?.length ?? 0})`, 'textures/ui/multiplayer_glyph_color', async () => {
      await showFriendListPanel(player, 1);
    })
    .button('Add Friend', 'textures/ui/plus', async () => {
      await showFriendAddPanel(player);
    })
    .button(`Requests (${validReqs.length})`, 'textures/ui/invite_base', async () => {
      await showFriendRequestsPanel(player, 1);
    })
    .button(
      autoTp ? '§l§2Friend Auto-TPA: ON\n§r§7Tap to disable' : '§l§7Friend Auto-TPA: OFF\n§r§7Tap to enable',
      autoTp ? 'textures/ui/realms_green_check' : 'textures/ui/cancel',
      async () => {
        const next = friendManager.toggleFriendAutoTpAccept(player);
        player.sendMessage(`§aFriend Auto-TPA Accept is now ${next ? '§2ENABLED' : '§cDISABLED'}§a.`);
        await showFriendMainPanel(player);
      },
    );

  form.addBackButton(async () => {
    const { showSocialHub } = await import('@core/ui/panels/mainPanel.js');
    await showSocialHub(player);
  });

  await form.show(player);
}

export async function showFriendListPanel(player: mc.Player, page: number = 1): Promise<void> {
  const pData = getOrCreatePlayer(player);
  const friends = pData.friends ?? [];
  const config = configManager.getConfig();

  const form = new ActionFormBuilder().title('Friend List');

  if (friends.length === 0) {
    form.body('You have not added any friends yet.');
  }

  form.addPaginatedButtons(
    friends,
    page,
    (fid, formBuilder) => {
      const fData = getPlayer(fid) ?? loadPlayerData(fid);
      const friendName = fData?.name ?? getPlayerNameById(fid) ?? fid;
      const onlineP = getPlayerFromCache(fid);
      const status = onlineP ? '§aOnline' : '§cOffline';

      let rankText = '';
      let icon = 'textures/ui/permissions_member_star.png';
      if (onlineP) {
        const targetRank = getPlayerRank(onlineP, config);
        rankText = targetRank.chatFormatting?.prefixText
          ? `§r[${targetRank.chatFormatting.prefixText}]`
          : `§r[${targetRank.name}]`;
        icon = getPlayerIcon(onlineP);
      }

      formBuilder.button(
        `${friendName} ${status}
${rankText}`,
        icon,
        async () => {
          await showManageFriendPanel(player, fid, friendName);
        },
      );
    },
    async (newPage) => {
      await showFriendListPanel(player, newPage);
    },
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

  if (onlinePlayers.length === 0) {
    const modal = new CustomFormBuilder<{ name: string }>('Add Friend')
      .textField('name', 'Player Name (Exact)', 'Player Name', '')
      .submitButton('Add Friend');

    const res = await modal.show(player);
    if (res && res.name) {
      const result = friendManager.sendFriendRequest(player, res.name);
      player.sendMessage(result.message);
    }
    await showFriendMainPanel(player);
    return;
  }

  onlinePlayers.unshift('-- Type Name Below --');

  const modal = new CustomFormBuilder<{ playerDropdown: string; manualName: string }>('Add Friend')
    .dropdown('playerDropdown', 'Select Online Player', onlinePlayers)
    .textField('manualName', 'Or Type Player Name (Exact)', 'Player Name', '')
    .submitButton('Add Friend');

  const res = await modal.show(player);

  if (res) {
    let targetName = res.manualName;
    if (!targetName && res.playerDropdown !== '-- Type Name Below --') {
      targetName = res.playerDropdown;
    }

    if (targetName) {
      const result = friendManager.sendFriendRequest(player, targetName);
      player.sendMessage(result.message);
    }
  }

  await showFriendMainPanel(player);
}

export async function showFriendRequestsPanel(player: mc.Player, page: number = 1): Promise<void> {
  const requests = friendManager.cleanExpiredRequests(player.id);

  const form = new ActionFormBuilder().title('Friend Requests');

  if (requests.length === 0) {
    form.body('You have no pending friend requests.');
  }

  form.addPaginatedButtons(
    requests,
    page,
    (req, formBuilder) => {
      const reqName =
        req.senderName || getPlayerNameById(req.senderId) || loadPlayerData(req.senderId)?.name || 'Unknown';
      formBuilder.button(
        `${reqName}
§7Click to accept or deny`,
        'textures/ui/invite_base',
        async () => {
          await showManageFriendRequestPanel(player, req.senderId, reqName);
        },
      );
    },
    async (newPage) => {
      await showFriendRequestsPanel(player, newPage);
    },
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
    form.button('Teleport To (TPA)', 'textures/ui/icon_map', () => {
      const result = tpaManager.createRequest(player, onlineP, 'tpa');
      player.sendMessage(result.message);
    });
    form.button('Teleport Here (TPAHere)', 'textures/items/ender_pearl', () => {
      const result = tpaManager.createRequest(player, onlineP, 'tpahere');
      player.sendMessage(result.message);
    });
    form.button('Invite to Mini-Game', 'textures/ui/controller_glyph_color', async () => {
      const { showInviteFriendToGameModal } = await import('@features/games/tictactoe/ui/panel.js');
      await showInviteFriendToGameModal(player, 'tictactoe', friendId);
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

export async function addFriendAction(player: mc.Player, targetPlayerId: string): Promise<void> {
  await Promise.resolve();
  if (player.id === targetPlayerId) {
    player.sendMessage('§cYou cannot be friends with yourself.');
    return;
  }

  const targetName = getPlayerNameById(targetPlayerId);
  if (!targetName) {
    player.sendMessage('§cPlayer not found.');
    return;
  }

  const result = friendManager.sendFriendRequest(player, targetName);
  player.sendMessage(result.message);
}
