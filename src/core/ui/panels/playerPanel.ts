import { getConfig } from '@core/config/configManager.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import { getVisiblePlayers, loadPlayerData } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { getPlayerRank } from '@core/permissions/rankManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import { frozenTag } from '@core/utils/constants.js';
import { formatCurrency } from '@core/utils/economy.js';
import { formatDuration } from '@core/utils/time.js';
import { getPlayerIcon } from '@core/utils/ui.js';
import { getBounty } from '@features/economy/bounty/manager.js';
import { saveLastLocation } from '@features/teleport/utils.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

async function showPaginatedOnlinePlayers(
  player: mc.Player,
  title: string,
  page: number,
  onPageChange: (newPage: number) => Promise<void>,
  onBack: () => Promise<void>,
): Promise<void> {
  const form = new ActionFormBuilder().title(title);
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
    onPageChange,
  );

  form.addBackButton(onBack);
  await form.show(player);
}

export async function showPlayerListPanel(player: mc.Player, page: number = 1): Promise<void> {
  await showPaginatedOnlinePlayers(
    player,
    'Online Players',
    page,
    (newPage) => showPlayerListPanel(player, newPage),
    async () => {
      const { showMainPanel } = await import('./mainPanel.js');
      await showMainPanel(player);
    },
  );
}

export async function showPlayerManagementPanel(player: mc.Player, page: number = 1): Promise<void> {
  await showPaginatedOnlinePlayers(
    player,
    'Player Management',
    page,
    (newPage) => showPlayerManagementPanel(player, newPage),
    async () => {
      const { showStaffDashboardPanel } = await import('./adminPanel.js');
      await showStaffDashboardPanel(player);
    },
  );
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
    form.button('Manage Stats', 'textures/blocks/scaffolding_top', async () => {
      const { showStatsPanel } = await import('@core/ui/panels/statsPanel.js');
      await showStatsPanel(player, targetPlayerId);
    });
    form.button('See Inventory', 'textures/ui/icon_recipe_equipment', async () => {
      const { showInventoryPanel } = await import('@core/ui/panels/inventoryPanel.js');
      await showInventoryPanel(player, targetPlayerId);
    });
    form.button('See Ender Chest', 'textures/ui/icon_recipe_equipment', async () => {
      const { showEnderChestPanel } = await import('@core/ui/panels/inventoryPanel.js');
      await showEnderChestPanel(player, targetPlayerId);
    });
    form.button('Moderation History', 'textures/ui/icon_book_writable', async () => {
      const { showPlayerModerationHistoryPanel } = await import('@features/moderation/ui/panel.js');
      await showPlayerModerationHistoryPanel(player, targetPlayerName, targetPlayerId);
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

  if (isDefined(onlineTarget) && onlineTarget.id !== player.id) {
    form.button('Send Private Message', 'textures/ui/message', async () => {
      const modal = new CustomFormBuilder<{ msg: string }>(`Message ${targetPlayerName}`)
        .textField('msg', 'Private Message', 'Type your message...', '')
        .submitButton('Send Message');
      const res = await modal.show(player);
      if (res && res.msg.trim().length > 0) {
        const { sendPrivateMessage } = await import('@features/social/pm/manager.js');
        const out = sendPrivateMessage(player, onlineTarget, res.msg.trim());
        if (!out.success && out.message) {
          player.sendMessage(out.message);
        }
      }
      await showPlayerActionsPanel(player, targetPlayerId, targetPlayerName);
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
    const { showBountyPlayer } = await import('@features/economy/bounty/ui/panel.js');
    await showBountyPlayer(player, { targetPlayerId });
  });

  const activeBounty = getBounty(targetPlayerId);
  if (isDefined(activeBounty) && activeBounty.amount > 0) {
    form.button(`Pay Off Bounty (${formatCurrency(activeBounty.amount)})`, 'textures/items/emerald', async () => {
      const { showRemovePlayerBounty } = await import('@features/economy/bounty/ui/panel.js');
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
    const rank = getPlayerRank(player, getConfig());
    const rankDisplay = rank.chatFormatting?.prefixText ?? rank.nametagPrefix ?? rank.name;
    const kdr = data.deaths === 0 ? data.kills.toFixed(2) : (data.kills / data.deaths).toFixed(2);
    const savings = data.bank?.savingsBalance ?? 0;
    const fdTotal = (data.bank?.fixedDeposits ?? []).reduce((sum, fd) => sum + fd.principal, 0);
    form.button(
      `§2Wallet: §r${formatCurrency(data.balance)}\n§7Bank: §b${formatCurrency(savings)} §8| §7FD: §6${formatCurrency(fdTotal)}`,
      'textures/items/emerald',
    );
    form.button(`§6Rank: §r${rankDisplay}`, 'textures/ui/permissions_op_crown');
    form.button(
      `§bPlaytime: §r${formatDuration(data.totalPlayTime)}\n§7Daily Streak: §e${data.dailyStreak ?? 0}d`,
      'textures/items/clock_item',
    );
    form.button(`§cKills: §r${data.kills} §8| §7Streak: §6${data.killStreak ?? 0}`, 'textures/items/iron_sword');
    form.button(`§4Deaths: §r${data.deaths} §8| §7KDR: §b${kdr}`, 'textures/items/mourner_pottery_sherd');
    const msWins = data.gameStats?.minesweeper?.wins ?? 0;
    const tttWins = data.gameStats?.ttt?.wins ?? 0;
    const rpsWins = data.gameStats?.rps?.wins ?? 0;
    const wrdWins = data.gameStats?.wordle?.wins ?? 0;
    const c4Wins = data.gameStats?.connect4?.wins ?? 0;
    const best2048 = data.gameStats?.game2048?.bestTile ?? 0;
    form.button(
      `§bMini-Game Stats\n§7MS:${msWins} TTT:${tttWins} C4:${c4Wins} RPS:${rpsWins} WRD:${wrdWins} 2048:${best2048}`,
      'textures/ui/controller_glyph_color',
    );
  }

  form.addBackButton(async () => {
    await showPanel(player, 'profileHub');
  });

  await form.show(player);
}
