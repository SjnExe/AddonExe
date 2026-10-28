import { debugLog, errorLog } from '@core/utils/logger.js';
import type { ReturnContext } from '@features/economy/shop/ui/userPanel.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const uiOpenTimestamps = new Map<string, number>();

export function clearPlayerUiTimestamp(playerId: string): void {
  uiOpenTimestamps.delete(playerId);
}

type PanelRouteHandler = (player: mc.Player, context: Record<string, unknown>) => Promise<void>;

const panelRoutes: Record<string, PanelRouteHandler> = {
  mainPanel: async (p) => (await import('@core/ui/panels/mainPanel.js')).showMainPanel(p),
  economyHub: async (p) => (await import('@core/ui/panels/mainPanel.js')).showEconomyHub(p),
  teleportHub: async (p) => (await import('@core/ui/panels/mainPanel.js')).showTeleportHub(p),
  socialHub: async (p) => (await import('@core/ui/panels/mainPanel.js')).showSocialHub(p),
  gamesHub: async (p) => (await import('@core/ui/panels/mainPanel.js')).showGamesHub(p),
  gamesMainPanel: async (p) => (await import('@core/ui/panels/mainPanel.js')).showGamesHub(p),
  profileHub: async (p) => (await import('@core/ui/panels/mainPanel.js')).showProfileHub(p),
  staffHub: async (p) => (await import('@core/ui/panels/adminPanel.js')).showStaffDashboardPanel(p),
  staffModerationHub: async (p) => (await import('@core/ui/panels/adminPanel.js')).showStaffModerationHub(p),
  staffPlayerHub: async (p) => (await import('@core/ui/panels/adminPanel.js')).showStaffPlayerHub(p),
  staffWorldHub: async (p) => (await import('@core/ui/panels/adminPanel.js')).showStaffWorldHub(p),
  staffConfigHub: async (p) => (await import('@core/ui/panels/adminPanel.js')).showStaffConfigHub(p),
  game2048MainPanel: async (p) => (await import('@features/games/game2048/ui/panel.js')).show2048Menu(p),
  connect4MainPanel: async (p) => (await import('@features/games/connect4/ui/panel.js')).showConnect4Menu(p),
  codebreakerMainPanel: async (p) => (await import('@features/games/codebreaker/ui/panel.js')).showCodebreakerMenu(p),
  staffRoundsMainPanel: async (p) =>
    (await import('@features/games/staffRounds/ui/panel.js')).showStaffGamesHubPanel(p),
  coinFlipMainPanel: async (p) => (await import('@features/games/coinflip/ui/panel.js')).showCoinFlipMenu(p),
  ticTacToeMainPanel: async (p) => (await import('@features/games/tictactoe/ui/panel.js')).showTicTacToeMenu(p),
  rpsMainPanel: async (p) => (await import('@features/games/rps/ui/panel.js')).showRpsMenu(p),
  minesweeperMainPanel: async (p) => (await import('@features/games/minesweeper/ui/panel.js')).showMinesweeperMenu(p),
  wordleMainPanel: async (p) => (await import('@features/games/wordle/ui/panel.js')).showWordleMainPanel(p),
  wordleSinglePlayerPanel: async (p, ctx) =>
    (await import('@features/games/wordle/ui/panel.js')).showSinglePlayerWordle(p, ctx),
  wordleStaffGamePanel: async (p) => (await import('@features/games/wordle/ui/panel.js')).showWordleStaffGamePanel(p),
  infoPanel: async (p) => (await import('@core/ui/panels/serverInfoPanel.js')).showInfoPanel(p),
  profileMainPanel: async (p) => (await import('@core/ui/panels/playerPanel.js')).showMyStatsPanel(p),
  playerListPanel: async (p) => (await import('@core/ui/panels/playerPanel.js')).showPlayerListPanel(p),
  playerActionsPanel: async (p, ctx) => {
    const targetPlayerId = ctx.targetPlayerId as string | undefined;
    if (!targetPlayerId) {
      p.sendMessage('§cMissing target player context.');
      return;
    }
    const { getPlayerNameById } = await import('@core/data/playerDataManager.js');
    const targetName = getPlayerNameById(targetPlayerId) || targetPlayerId;
    const { showPlayerActionsPanel } = await import('@core/ui/panels/playerPanel.js');
    await showPlayerActionsPanel(p, targetPlayerId, targetName);
  },
  reportListPanel: async (p) => (await import('@features/moderation/ui/panel.js')).showReportListPanel(p),
  shopMainPanel: async (p) => (await import('@features/economy/shop/ui/userPanel.js')).showShopMainPanel(p),
  shopBuyOrSellPanel: async (p, ctx) => {
    const { showBuyOrSellPanel, showShopMainPanel } = await import('@features/economy/shop/ui/userPanel.js');
    if (isDefined(ctx.itemKey) && isDefined(ctx.itemData)) {
      const fallbackReturn: ReturnContext = { returnTo: 'main', page: 1 };
      await showBuyOrSellPanel(
        p,
        ctx.itemKey as string,
        ctx.itemData,
        isDefined(ctx.returnCtx) ? (ctx.returnCtx as ReturnContext) : fallbackReturn,
      );
    } else {
      await showShopMainPanel(p);
    }
  },
  teamMainPanel: async (p) => (await import('@features/social/team/ui/panel.js')).showTeamMainPanel(p),
  friendMainPanel: async (p) => (await import('@features/social/friends/ui/panel.js')).showFriendMainPanel(p),
  bountyListPanel: async (p, ctx) => (await import('@features/economy/bounty/ui/panel.js')).showBountyListPanel(p, ctx),
  moderationPanel: async (p) => (await import('@features/moderation/ui/panel.js')).showModerationPanel(p),
  addWorldProtectionPanel: async (p, ctx) =>
    (await import('@features/essentials/protection/ui/panel.js')).showAddWorldProtectionPanel(p, ctx),
  editWorldProtectionPanel: async (p, ctx) =>
    (await import('@features/essentials/protection/ui/panel.js')).showEditWorldProtectionPanel(p, ctx),
  configCategoryPanel: async (p) => (await import('@core/ui/panels/configPanel.js')).showConfigCategoryPanel(p),
};

/** Main entry point for showing a UI panel to a player. */
export async function showPanel(player: mc.Player, panelId: string, context: Record<string, unknown> = {}) {
  try {
    const now = Date.now();
    const lastOpen = uiOpenTimestamps.get(player.id) ?? 0;
    if (now - lastOpen < 150) {
      return;
    }
    uiOpenTimestamps.set(player.id, now);

    debugLog(`[UIManager] Routing panel '${panelId}'...`);
    const route = panelRoutes[panelId];
    if (isDefined(route)) {
      await route(player, context);
      return;
    }

    debugLog(`[UIManager] Panel ${panelId} is not available or not implemented.`);
    player.sendMessage(`§cPanel ${panelId} is not available.`);
  } catch (error: unknown) {
    errorLog(`[UIManager] showPanel failed for panel '${String(panelId)}': ${String(error)}`);
    player.sendMessage('§cAn unexpected error occurred while trying to open the UI.');
  }
}
