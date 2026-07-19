import { getCooldown, setCooldown } from '@core/cooldownManager.js';
import { debugLog, errorLog } from '@core/logger.js';
import * as mc from '@minecraft/server';

/**
 * Main entry point for showing a UI panel to a player.
 */
export async function showPanel(player: mc.Player, panelId: string, _context: Record<string, unknown> = {}) {
    try {
        const cooldown = getCooldown(player.id, 'ui_spam');
        if (cooldown > 0) return;
        setCooldown(player.id, 'ui_spam', 0.5);

        debugLog(`[UIManager] Routing panel '${panelId}'...`);

        if (panelId === 'mainPanel') {
            const { showMainPanel } = await import('@core/ui/panels/mainPanel.js');
            await showMainPanel(player);
            return;
        }

        if (panelId === 'gamesMainPanel') {
            const { showGamesMainPanel } = await import('@features/games/ui/gamesMainPanel.js');
            await showGamesMainPanel(player);
            return;
        }

        if (panelId === 'wordleMainPanel') {
            const { showWordleMainPanel } = await import('@features/games/wordle/ui/wordleMainPanel.js');
            await showWordleMainPanel(player);
            return;
        }

        if (panelId === 'wordleSinglePlayerPanel' || panelId === 'wordleStaffGamePanel' || panelId === 'wordleSinglePlayerResultPanel') {
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

        if (panelId === 'configCategoryPanel') {
            const { showConfigCategoryPanel } = await import('@core/ui/panels/configPanel.js');
            await showConfigCategoryPanel(player);
            return;
        }

        player.sendMessage(`§cPanel ${panelId} is not available.`);
    } catch (error: unknown) {
        errorLog(`[UIManager] showPanel failed for panel '${String(panelId)}': ${String(error)}`);
        player.sendMessage('§cAn unexpected error occurred while trying to open the UI.');
    }
}
