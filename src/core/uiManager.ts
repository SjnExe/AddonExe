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

        if (panelId === 'profileMainPanel') {
            const { showMyStatsPanel } = await import('@core/ui/panels/playerPanel.js');
            // Check if profile exists, if not, fallback to main
            await showMyStatsPanel(player);
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
