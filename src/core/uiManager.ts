import { getCooldown, setCooldown } from '@core/cooldownManager.js';
import { debugLog, errorLog } from '@core/logger.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

/**
 * Main entry point for showing a UI panel to a player.
 */
export async function showPanel(player: mc.Player, panelId: string, _context: Record<string, unknown> = {}) {
    try {
        const cooldown = getCooldown(player.id, 'ui_spam');
        if (cooldown > 0) {
            return;
        }
        setCooldown(player.id, 'ui_spam', 0.5);

        debugLog(`[UIManager] Routing panel '${panelId}'...`);

        if (panelId === 'mainPanel') {
            const { showMainPanel } = await import('@core/ui/panels/mainPanel.js');
            await showMainPanel(player);
            return;
        }

        if (panelId === 'economyHub') {
            const { showEconomyHub } = await import('@core/ui/panels/mainPanel.js');
            await showEconomyHub(player);
            return;
        }

        if (panelId === 'socialHub') {
            const { showSocialHub } = await import('@core/ui/panels/mainPanel.js');
            await showSocialHub(player);
            return;
        }

        if (panelId === 'gamesHub' || panelId === 'gamesMainPanel') {
            const { showGamesHub } = await import('@core/ui/panels/mainPanel.js');
            await showGamesHub(player);
            return;
        }

        if (panelId === 'profileHub') {
            const { showProfileHub } = await import('@core/ui/panels/mainPanel.js');
            await showProfileHub(player);
            return;
        }

        if (panelId === 'staffHub') {
            const { showStaffDashboardPanel } = await import('@core/ui/panels/adminPanel.js');
            await showStaffDashboardPanel(player);
            return;
        }

        if (panelId === 'staffModerationHub') {
            const { showStaffModerationHub } = await import('@core/ui/panels/adminPanel.js');
            await showStaffModerationHub(player);
            return;
        }

        if (panelId === 'staffPlayerHub') {
            const { showStaffPlayerHub } = await import('@core/ui/panels/adminPanel.js');
            await showStaffPlayerHub(player);
            return;
        }

        if (panelId === 'staffWorldHub') {
            const { showStaffWorldHub } = await import('@core/ui/panels/adminPanel.js');
            await showStaffWorldHub(player);
            return;
        }

        if (panelId === 'staffConfigHub') {
            const { showStaffConfigHub } = await import('@core/ui/panels/adminPanel.js');
            await showStaffConfigHub(player);
            return;
        }

        if (panelId === 'wordleMainPanel') {
            const { showWordleMainPanel } = await import('@features/games/wordle/ui/wordleMainPanel.js');
            await showWordleMainPanel(player);
            return;
        }

        if (panelId === 'wordleSinglePlayerPanel') {
            const { showSinglePlayerWordle } = await import('@features/games/wordle/ui/wordlePanel.js');
            await showSinglePlayerWordle(player, _context);
            return;
        }

        if (panelId === 'wordleStaffGamePanel' || panelId === 'wordleSinglePlayerResultPanel') {
            const { WordlePanelHandler } = await import('@features/games/wordle/ui/wordlePanel.js');
            const handler = new WordlePanelHandler();
            const form = await handler.buildModal(player, panelId, _context);
            if (form) {
                const response = await form.show(player);
                await handler.handleResponse(player, panelId, response, _context);
            }
            return;
        }

        if (panelId === 'infoPanel') {
            const { showInfoPanel } = await import('@core/ui/panels/serverInfoPanel.js');
            await showInfoPanel(player);
            return;
        }

        if (panelId === 'profileMainPanel') {
            const { showMyStatsPanel } = await import('@core/ui/panels/playerPanel.js');
            // Check if profile exists, if not, fallback to main
            await showMyStatsPanel(player);
            return;
        }

        if (panelId === 'playerActionsPanel') {
            const targetPlayerId = _context.targetPlayerId as string;
            if (targetPlayerId) {
                const { getPlayerNameById } = await import('@core/playerDataManager.js');
                const targetName = getPlayerNameById(targetPlayerId) || targetPlayerId;
                const { showPlayerActionsPanel } = await import('@core/ui/panels/playerPanel.js');
                await showPlayerActionsPanel(player, targetPlayerId, targetName);
            } else {
                player.sendMessage('§cMissing target player context.');
            }
            return;
        }

        if (panelId === 'reportListPanel') {
            const { showReportListPanel } = await import('@features/moderation/ui/panel.js');
            await showReportListPanel(player);
            return;
        }

        if (panelId === 'shopMainPanel') {
            const { showShopMainPanel } = await import('@features/shop/ui/userPanel.js');
            await showShopMainPanel(player);
            return;
        }

        if (panelId === 'shopBuyOrSellPanel') {
            const { showBuyOrSellPanel } = await import('@features/shop/ui/userPanel.js');
            if (isDefined(_context.itemKey) && isDefined(_context.itemData)) {
                // @ts-ignore dynamic import ReturnContext type not trivially accessible
                const fallbackReturn = { returnTo: 'main', page: 1 };
                // @ts-ignore dynamic import ReturnContext type not trivially accessible
                await showBuyOrSellPanel(player, _context.itemKey as string, _context.itemData, isDefined(_context.returnCtx) ? _context.returnCtx : fallbackReturn);
            } else {
                const { showShopMainPanel } = await import('@features/shop/ui/userPanel.js');
                await showShopMainPanel(player);
            }
            return;
        }

        if (panelId === 'teamMainPanel') {
            const { showTeamMainPanel } = await import('@features/team/ui/panel.js');
            await showTeamMainPanel(player);
            return;
        }

        if (panelId === 'friendMainPanel') {
            const { showFriendMainPanel } = await import('@features/social/ui/friendPanel.js');
            await showFriendMainPanel(player);
            return;
        }

        if (panelId === 'bountyListPanel') {
            const { showBountyListPanel } = await import('@features/economy/ui/bountyPanel.js');
            await showBountyListPanel(player, _context);
            return;
        }

        if (panelId === 'moderationPanel') {
            const { showModerationPanel } = await import('@features/moderation/ui/panel.js');
            await showModerationPanel(player);
            return;
        }

        if (panelId === 'configCategoryPanel') {
            const { showConfigCategoryPanel } = await import('@core/ui/panels/configPanel.js');
            await showConfigCategoryPanel(player);
            return;
        }

        debugLog(`[UIManager] Panel ${panelId} is not available or not implemented.`);
        player.sendMessage(`§cPanel ${panelId} is not available.`);
    } catch (error: unknown) {
        errorLog(`[UIManager] showPanel failed for panel '${String(panelId)}': ${String(error)}`);
        player.sendMessage('§cAn unexpected error occurred while trying to open the UI.');
    }
}
