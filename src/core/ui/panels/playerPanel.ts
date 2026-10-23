import { getConfig } from '@core/config/configManager.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import { getVisiblePlayers, loadPlayerData } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { getPlayerRank } from '@core/permissions/rankManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import { frozenTag } from '@core/utils/constants.js';
import { formatCurrency } from '@core/utils/economy.js';
import { getPlayerIcon } from '@core/utils/ui.js';
import { getBounty } from '@features/economy/bountyManager.js';
import { saveLastLocation } from '@features/teleport/utils.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m ${s}s`;
}

export async function showPlayerListPanel(player: mc.Player, page: number = 1): Promise<void> {
  const form = new ActionFormBuilder().title('Online Players');
  const config = getConfig();
  const players = getVisiblePlayers(player);

  form.addPaginatedButtons(
    players,
    page,
    (p, formBuilder) => {
      const targetRank = getPlayerRank(p, config);
      const rankText = targetRank.chatFormatting?.prefixText
        ? `[${targetRank.chatFormatting.prefixText}]`
        : `[${targetRank.name}]`;
      formBuilder.button(`${p.name}\n§r${rankText}`, getPlayerIcon(p), () => {
        void showPlayerActionsPanel(player, p.id, p.name);
      });
    },
    async (newPage) => {
      await showPlayerListPanel(player, newPage);
    },
  );

  form.addBackButton(async () => {
    const { showMainPanel } = await import('./mainPanel.js');
    await showMainPanel(player);
  });

  await form.show(player);
}

export async function showPlayerManagementPanel(player: mc.Player, page: number = 1): Promise<void> {
  const form = new ActionFormBuilder().title('Player Management');
  const config = getConfig();
  const players = getVisiblePlayers(player);

  form.addPaginatedButtons(
    players,
    page,
    (p, formBuilder) => {
      const targetRank = getPlayerRank(p, config);
      const rankText = targetRank.chatFormatting?.prefixText
        ? `[${targetRank.chatFormatting.prefixText}]`
        : `[${targetRank.name}]`;
      formBuilder.button(`${p.name}\n§r${rankText}`, getPlayerIcon(p), () => {
        void showPlayerActionsPanel(player, p.id, p.name);
      });
    },
    async (newPage) => {
      await showPlayerManagementPanel(player, newPage);
    },
  );

  form.addBackButton(async () => {
    const { showStaffDashboardPanel } = await import('./adminPanel.js');
    await showStaffDashboardPanel(player);
  });

  await form.show(player);
}

export async function showPlayerActionsPanel(
  player: mc.Player,
  targetPlayerId: string,
  targetPlayerName: string,
): Promise<void> {
  const form = new ActionFormBuilder().title(targetPlayerName);
  const isModMode = hasPermission(player, 'ui.panel.mod');
  const onlineTarget = getPlayerFromCache(targetPlayerId);

  if (isModMode) {
    form.button('Warn', 'textures/ui/WarningGlyph', () => {
      void import('@features/moderation/ui/panel.js').then((m) => m.handleWarnPlayer(player, targetPlayerId));
    });
    form.button('Kick', 'textures/ui/cancel', () => {
      void import('@features/moderation/ui/panel.js').then((m) => m.handleKickPlayer(player, targetPlayerId));
    });
    form.button('Mute', 'textures/ui/mute_on', () => {
      void import('@features/moderation/ui/panel.js').then((m) => m.handleMutePlayer(player, targetPlayerId));
    });
    form.button('Unmute', 'textures/ui/mute_off', () => {
      void import('@features/moderation/ui/panel.js').then((m) => m.handleUnmutePlayer(player, targetPlayerId));
    });
    form.button('Ban', 'textures/ui/hammer_l', () => {
      void import('@features/moderation/ui/panel.js').then((m) => m.handleBanPlayer(player, targetPlayerId));
    });
    if (isDefined(onlineTarget)) {
      const isFrozen = onlineTarget.hasTag(frozenTag);
      form.button(isFrozen ? 'Unfreeze' : 'Freeze', 'textures/ui/lock_color', async () => {
        const { freezePlayer, unfreezePlayer } = await import('@features/moderation/commands/freeze.js');
        if (onlineTarget.hasTag(frozenTag)) {
          unfreezePlayer(player, onlineTarget);
        } else {
          freezePlayer(player, onlineTarget);
        }
      });
    }
    if (hasPermission(player, 'ui.panel.admin') || hasPermission(player, 'cmd.rank.admin')) {
      form.button('Manage Ranks', 'textures/ui/permissions_op_crown', async () => {
        const { showRankManagementPanel } = await import('@features/ranks/ui/panel.js');
        await showRankManagementPanel(player, targetPlayerId);
      });
    }
    form.button('Manage Stats', 'textures/ui/Scaffolding', async () => {
      const { showStatsPanel } = await import('@core/ui/panels/statsPanel.js');
      await showStatsPanel(player, targetPlayerId);
    });
    form.button('See Inventory', 'textures/ui/inventory_icon', async () => {
      const { showInventoryPanel } = await import('@core/ui/panels/inventoryPanel.js');
      await showInventoryPanel(player, targetPlayerId);
    });
    form.button('See Ender Chest', 'textures/ui/inventory_icon', async () => {
      const { showEnderChestPanel } = await import('@core/ui/panels/inventoryPanel.js');
      await showEnderChestPanel(player, targetPlayerId);
    });
    form.button('Teleport To', 'textures/ui/icon_map', () => {
      const target = getPlayerFromCache(targetPlayerId);
      if (isDefined(target)) {
        saveLastLocation(player);
        player.teleport(target.location, { dimension: target.dimension });
      }
    });
    form.button('Teleport Here', 'textures/ui/icon_map', () => {
      const target = getPlayerFromCache(targetPlayerId);
      if (isDefined(target)) {
        saveLastLocation(target);
        target.teleport(player.location, { dimension: player.dimension });
      }
    });
  }

  form.button('Send Friend Request', 'textures/ui/color_plus', () => {
    void import('@features/social/friends/ui/panel.js').then((m) => m.addFriendAction(player, targetPlayerId));
  });

  form.button('Send Money', 'textures/items/gold_ingot', async () => {
    const { showTransferPanel } = await import('@features/economy/ui/transferPanel.js');
    await showTransferPanel(player, targetPlayerId);
  });

  form.button('Place Bounty', 'textures/items/netherite_sword', async () => {
    const { showBountyPlayer } = await import('@features/economy/ui/bountyPanel.js');
    await showBountyPlayer(player, { targetPlayerId });
  });

  const activeBounty = getBounty(targetPlayerId);
  if (isDefined(activeBounty) && activeBounty.amount > 0) {
    form.button(`Pay Off Bounty (${formatCurrency(activeBounty.amount)})`, 'textures/items/emerald', async () => {
      const { showRemovePlayerBounty } = await import('@features/economy/ui/bountyPanel.js');
      await showRemovePlayerBounty(player, { targetPlayerId });
    });
  }

  form.button('Report Player', 'textures/ui/WarningGlyph', async () => {
    const { handleReportPlayer } = await import('@features/moderation/ui/panel.js');
    await handleReportPlayer(player, targetPlayerId);
  });

  form.addBackButton(async () => {
    if (hasPermission(player, 'ui.panel.mod')) {
      await showPlayerManagementPanel(player);
    } else {
      await showPlayerListPanel(player);
    }
  });

  await form.show(player);
}

export async function showMyStatsPanel(player: mc.Player): Promise<void> {
  const form = new ActionFormBuilder().title('Your Stats');
  const data = loadPlayerData(player.id);

  if (data) {
    form.button(`§2Balance: §r${formatCurrency(data.balance)}`, 'textures/items/emerald');
    form.button(`§6Rank: §r${data.rankId}`, 'textures/ui/permissions_op_crown');
    form.button(`${formatDuration(data.totalPlayTime)}`, 'textures/items/clock_item');
    form.button(`§4Kills: §r${data.kills}`, 'textures/items/iron_sword');
    form.button(`§4Deaths: §r${data.deaths}`, 'textures/items/skull_pottery_sherd');
  }

  form.addBackButton(async () => {
    await showPanel(player, 'profileHub');
  });

  await form.show(player);
}
