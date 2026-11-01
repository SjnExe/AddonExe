import { getPlayerNameById } from '@core/data/playerDataManager.js';
import {
  showStaffConfigHub,
  showStaffDashboardPanel,
  showStaffModerationHub,
  showStaffPlayerHub,
  showStaffWorldHub,
} from '@core/ui/panels/adminPanel.js';
import { showConfigCategoryPanel } from '@core/ui/panels/configPanel.js';
import {
  showEconomyHub,
  showGamesHub,
  showMainPanel,
  showProfileHub,
  showSocialHub,
  showTeleportHub,
} from '@core/ui/panels/mainPanel.js';
import { showMyStatsPanel, showPlayerActionsPanel, showPlayerListPanel } from '@core/ui/panels/playerPanel.js';
import { showInfoPanel } from '@core/ui/panels/serverInfoPanel.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { showBountyListPanel } from '@features/economy/bounty/ui/panel.js';
import { type ReturnContext, showBuyOrSellPanel, showShopMainPanel } from '@features/economy/shop/ui/userPanel.js';
import { showAddWorldProtectionPanel, showEditWorldProtectionPanel } from '@features/essentials/protection/ui/panel.js';
import { showCodebreakerMenu } from '@features/games/codebreaker/ui/panel.js';
import { showCoinFlipMenu } from '@features/games/coinflip/ui/panel.js';
import { showConnect4Menu } from '@features/games/connect4/ui/panel.js';
import { show2048Menu } from '@features/games/game2048/ui/panel.js';
import { showMinesweeperMenu } from '@features/games/minesweeper/ui/panel.js';
import { showRpsMenu } from '@features/games/rps/ui/panel.js';
import { showStaffGamesHubPanel } from '@features/games/staffRounds/ui/panel.js';
import { showTicTacToeMenu } from '@features/games/tictactoe/ui/panel.js';
import {
  showSinglePlayerWordle,
  showWordleMainPanel,
  showWordleStaffGamePanel,
} from '@features/games/wordle/ui/panel.js';
import { showModerationPanel, showReportListPanel } from '@features/moderation/ui/panel.js';
import { showFriendMainPanel } from '@features/social/friends/ui/panel.js';
import { showTeamMainPanel } from '@features/social/team/ui/panel.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const uiOpenTimestamps = new Map<string, number>();

export function clearPlayerUiTimestamp(playerId: string): void {
  uiOpenTimestamps.delete(playerId);
}

type PanelRouteHandler = (player: mc.Player, context: Record<string, unknown>) => Promise<void>;

const panelRoutes: Record<string, PanelRouteHandler> = {
  mainPanel: (p) => showMainPanel(p),
  economyHub: (p) => showEconomyHub(p),
  teleportHub: (p) => showTeleportHub(p),
  socialHub: (p) => showSocialHub(p),
  gamesHub: (p) => showGamesHub(p),
  gamesMainPanel: (p) => showGamesHub(p),
  profileHub: (p) => showProfileHub(p),
  staffHub: (p) => showStaffDashboardPanel(p),
  staffModerationHub: (p) => showStaffModerationHub(p),
  staffPlayerHub: (p) => showStaffPlayerHub(p),
  staffWorldHub: (p) => showStaffWorldHub(p),
  staffConfigHub: (p) => showStaffConfigHub(p),
  game2048MainPanel: (p) => show2048Menu(p),
  connect4MainPanel: (p) => showConnect4Menu(p),
  codebreakerMainPanel: (p) => showCodebreakerMenu(p),
  staffRoundsMainPanel: (p) => showStaffGamesHubPanel(p),
  coinFlipMainPanel: (p) => showCoinFlipMenu(p),
  ticTacToeMainPanel: (p) => showTicTacToeMenu(p),
  rpsMainPanel: (p) => showRpsMenu(p),
  minesweeperMainPanel: (p) => showMinesweeperMenu(p),
  wordleMainPanel: (p) => showWordleMainPanel(p),
  wordleSinglePlayerPanel: (p, ctx) => showSinglePlayerWordle(p, ctx),
  wordleStaffGamePanel: (p) => showWordleStaffGamePanel(p),
  infoPanel: (p) => showInfoPanel(p),
  profileMainPanel: (p) => showMyStatsPanel(p),
  playerListPanel: (p) => showPlayerListPanel(p),
  playerActionsPanel: async (p, ctx) => {
    const targetPlayerId = ctx.targetPlayerId as string | undefined;
    if (!targetPlayerId) {
      p.sendMessage('§cMissing target player context.');
      return;
    }
    const targetName = getPlayerNameById(targetPlayerId) || targetPlayerId;
    await showPlayerActionsPanel(p, targetPlayerId, targetName);
  },
  reportListPanel: (p) => showReportListPanel(p),
  shopMainPanel: (p) => showShopMainPanel(p),
  shopBuyOrSellPanel: async (p, ctx) => {
    if (isDefined(ctx.itemKey) && isDefined(ctx.itemData)) {
      const fallbackReturn: ReturnContext = { returnTo: 'main', page: 1 };
      await showBuyOrSellPanel(
        p,
        ctx.itemKey as string,
        ctx.itemData as Parameters<typeof showBuyOrSellPanel>[2],
        isDefined(ctx.returnCtx) ? (ctx.returnCtx as ReturnContext) : fallbackReturn,
      );
    } else {
      await showShopMainPanel(p);
    }
  },
  teamMainPanel: (p) => showTeamMainPanel(p),
  friendMainPanel: (p) => showFriendMainPanel(p),
  bountyListPanel: (p, ctx) => showBountyListPanel(p, ctx),
  moderationPanel: (p) => showModerationPanel(p),
  addWorldProtectionPanel: (p, ctx) => showAddWorldProtectionPanel(p, ctx),
  editWorldProtectionPanel: (p, ctx) => showEditWorldProtectionPanel(p, ctx),
  configCategoryPanel: (p) => showConfigCategoryPanel(p),
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
