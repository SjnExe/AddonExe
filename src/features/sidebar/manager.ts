import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { getSidebarConfig } from '@core/configurations.js';
import { debugLog } from '@core/logger.js';
import { getAllPlayersFromCache, getPlayerCount } from '@core/playerCache.js';
import { getPlayTime, getPlayer, getSidebarVisible } from '@core/playerDataManager.js';
import { getPlayerRank } from '@core/rankManager.js';
import { serviceLocator } from '@core/services/serviceLocator.js';
import { formatCurrency, formatDuration } from '@core/utils.js';
import { isDefined, isNumber } from '@lib/guards.js';

interface LeaderboardEntry {
    name: string;
    balance: number;
}

interface EconomyLeaderboardService {
    getLeaderboard: () => LeaderboardEntry[];
}

interface TeamData {
    name: string;
}

interface TeamManagerService {
    getTeamByPlayer: (playerId: string) => TeamData | undefined;
}

let sidebarInterval: number | undefined;

export function initializeSidebar() {
    sidebarInterval = mc.system.runInterval(() => {
        updateSidebars();
    }, 20); // Update every second
}

export function cleanup() {
    if (sidebarInterval !== undefined) {
        mc.system.clearRun(sidebarInterval);
        sidebarInterval = undefined;
    }
}

/**
 * Forces a refresh of the sidebar.
 * Currently just a wrapper for updateSidebars, but kept for API compatibility.
 */
export function forceUpdate() {
    updateSidebars();
}

function updateSidebars() {
    const config = getSidebarConfig();

    if ((config.enabled as boolean | undefined) !== true) {
        return;
    }

    // Use cached players to avoid engine overhead
    const players = getAllPlayersFromCache();

    // Only process if at least one sub-feature is enabled
    // Support migrating from old config format
    const c = config as Record<string, unknown>;
    const globalInfo = c.globalInfo as { enabled?: boolean } | undefined;
    const hud = c.hud as { enabled?: boolean } | undefined;

    const globalInfoEnabled = (globalInfo ? globalInfo.enabled : c.enabled) === true;
    const hudEnabled = (hud ? hud.enabled : c.actionBarEnabled) === true;

    if (!globalInfoEnabled && !hudEnabled) {
        return;
    }

    for (const player of players) {
        try {
            if (!player.isValid) continue;

            const pData = getPlayer(player.id);
            if (!isDefined(pData)) continue;

            // Check if player has disabled sidebar
            if (!getSidebarVisible(player.id)) {
                if (globalInfoEnabled) {
                    player.onScreenDisplay.setTitle(''); // Clear sidebar
                }
                if (hudEnabled) {
                    player.onScreenDisplay.setActionBar(''); // Clear actionbar
                }
                continue;
            }

            // Note: Currently setActionBar is used for globalInfo in the original code.
            // If they are meant to be separate, one could use setTitle for globalInfo (scoreboard)
            // and setActionBar for HUD. We will keep the original logic but conditionally format
            // based on the sub-feature toggles.

            if (globalInfoEnabled) {
                const title = 'globalInfo' in config ? config.globalInfo.title : ((config as { title?: string }).title ?? '§l§6{server_name}');
                const lines: string[] = [];

                const sourceLines = 'globalInfo' in config ? config.globalInfo.sidebarLines : ((config as { sidebarLines?: string[] }).sidebarLines ?? []);
                for (const line of sourceLines) {
                    // Use the shared placeholder resolver
                    const processedLine = resolveGlobalPlaceholders(line, player);
                    lines.push(processedLine);
                }

                const body = lines.join('\n');

                // Usually sidebar is shown with setTitle/setSubtitle, or setActionBar.
                // Keeping original behavior:
                player.onScreenDisplay.setActionBar(title + '\n' + body);
            } else if (hudEnabled) {
                // If only HUD is enabled, display HUD lines on ActionBar
                const lines: string[] = [];
                const sourceLines = 'hud' in config ? config.hud.actionBarLines : ((config as { actionBarLines?: string[] }).actionBarLines ?? []);
                for (const line of sourceLines) {
                    const processedLine = resolveGlobalPlaceholders(line, player);
                    lines.push(processedLine);
                }
                player.onScreenDisplay.setActionBar(lines.join(' '));
            }
        } catch (error) {
            debugLog(`Error updating sidebar for ${player.name}: ${String(error)}`);
        }
    }
}

/**
 * Resolves global placeholders in a text string.
 * @param text The text containing placeholders.
 * @param player Optional player context for player-specific placeholders.
 * @returns The text with placeholders replaced.
 */
export function resolveGlobalPlaceholders(text: string, player?: mc.Player): string {
    // Optimization: Use cached player count
    let processed = text.replace('{online}', getPlayerCount().toString()).replace('{max_online}', '20');

    // Leaderboard Placeholders
    // Check if the text actually contains leaderboard placeholders before fetching
    if (processed.includes('{top_money_')) {
        const leaderboardService = serviceLocator.getService<EconomyLeaderboardService>('economy.leaderboard');
        const leaderboard = leaderboardService ? leaderboardService.getLeaderboard() : [];
        processed = processed.replaceAll(/\{top_money_(\d+)\}/g, (_match, indexStr) => {
            const i = Number.parseInt(indexStr) - 1;
            if (isNumber(i) && i >= 0 && i < leaderboard.length) {
                const entry = leaderboard[i];
                return isDefined(entry) ? `${entry.name}: ${formatCurrency(entry.balance)}` : '---';
            }
            return '---';
        });
    }

    if (player) {
        const pData = getPlayer(player.id);
        if (isDefined(pData)) {
            const mainConfig = getConfig();
            const rank = getPlayerRank(player, mainConfig);
            const teamManagerService = serviceLocator.getService<TeamManagerService>('team.manager');
            const team = teamManagerService ? teamManagerService.getTeamByPlayer(player.id) : undefined;
            const balance = pData.balance;
            const kills = pData.kills || 0;
            const deaths = pData.deaths || 0;
            const kdr = deaths === 0 ? kills : (kills / deaths).toFixed(2);
            const streak = pData.killStreak || 0;
            const playtime = formatDuration(getPlayTime(player.id));

            processed = processed
                .replace('{name}', player.name)
                .replace('{rank}', rank.name)
                .replace('{money}', formatCurrency(balance))
                .replace('{kills}', kills.toString())
                .replace('{deaths}', deaths.toString())
                .replace('{kdr}', kdr.toString())
                .replace('{streak}', streak.toString())
                .replace('{playtime}', playtime);

            processed = team ? processed.replace('{team}', team.name) : processed.replace('{team}', 'None');
        }
    }

    return processed;
}

/**
 * Sets a temporary override message on the action bar.
 * Useful for countdowns or critical alerts.
 */
export function setActionBarOverride(player: mc.Player, message: string, _durationMs: number = 2000) {
    player.onScreenDisplay.setActionBar(message);
}
