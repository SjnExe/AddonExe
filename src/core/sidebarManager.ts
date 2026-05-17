/* eslint-disable @typescript-eslint/no-unsafe-argument */
import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { getSidebarConfig } from '@core/configurations.js';
import { getLeaderboard } from '@core/leaderboardManager.js';
import { debugLog } from '@core/logger.js';
import { getAllPlayersFromCache, getPlayerCount } from '@core/playerCache.js';
import { getPlayTime, getPlayer, getSidebarVisible } from '@core/playerDataManager.js';
import { getPlayerRank } from '@core/rankManager.js';
import { formatCurrency, formatDuration } from '@core/utils.js';
import { getTeamByPlayer } from '@features/teams/teamManager.js';
import { isDefined, isNumber } from '@lib/guards.js';

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

    for (const player of players) {
        try {
            if (!player.isValid) continue;

            const pData = getPlayer(player.id);
            if (!isDefined(pData)) continue;

            // Check if player has disabled sidebar
            if (!getSidebarVisible(player.id)) {
                player.onScreenDisplay.setTitle(''); // Clear
                continue;
            }

            const title = config.title;
            const lines: string[] = [];

            for (const line of config.sidebarLines) {
                // Use the shared placeholder resolver
                const processedLine = resolveGlobalPlaceholders(line, player);
                lines.push(processedLine);
            }

            const body = lines.join('\n');
            player.onScreenDisplay.setActionBar(title + '\n' + body);
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
        const leaderboard = getLeaderboard();
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
            const team = getTeamByPlayer(player.id);
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
