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

// Action bar override tracking per player
const actionBarOverrides = new Map<string, number>();

// Sidebar objective name constant
const SIDEBAR_OBJECTIVE_ID = 'exe_sidebar';

// Tracking ticks for performance throttling
let currentTick = 0;
let sidebarInterval: number | undefined;

// TPS calculation state
let lastTpsTime = Date.now();
let lastTpsTick = 0;
let cachedTps = '20.0';

export function initializeSidebar() {
    sidebarInterval = mc.system.runInterval(() => {
        currentTick++;
        updateTps();
        updateSidebars();
    }, 1);
}

export function cleanup() {
    if (sidebarInterval !== undefined) {
        mc.system.clearRun(sidebarInterval);
        sidebarInterval = undefined;
    }
    clearSidebarObjective();
}

/**
 * Forces an immediate refresh of the sidebar.
 */
export function forceUpdate() {
    updateSidebars(true);
}

function updateTps() {
    if (currentTick % 20 !== 0) {return;}
    const now = Date.now();
    const elapsedSeconds = (now - lastTpsTime) / 1000;
    const ticksPassed = currentTick - lastTpsTick;

    if (elapsedSeconds > 0) {
        const calculatedTps = Math.min(20, ticksPassed / elapsedSeconds);
        cachedTps = calculatedTps.toFixed(1);
    }

    lastTpsTime = now;
    lastTpsTick = currentTick;
}

function clearSidebarObjective() {
    try {
        const scoreboard = mc.world.scoreboard;
        scoreboard.clearObjectiveAtDisplaySlot(mc.DisplaySlotId.Sidebar);
        const obj = scoreboard.getObjective(SIDEBAR_OBJECTIVE_ID);
        if (obj) {
            scoreboard.removeObjective(obj);
        }
    } catch (error) {
        debugLog(`Error clearing sidebar objective: ${String(error)}`);
    }
}

function updateSidebars(force = false) {
    const config = getSidebarConfig();

    if ((config.enabled as boolean | undefined) !== true) {
        clearSidebarObjective();
        return;
    }

    const players = getAllPlayersFromCache();

    const c = config as Record<string, unknown>;
    const globalInfo = (c.globalInfo as { enabled?: boolean; updateInterval?: number; title?: string; maxPlayers?: number; sidebarLines?: string[] }) || {};
    const hud = (c.hud as { enabled?: boolean; updateInterval?: number; actionBarLines?: string[] }) || {};

    const globalInfoEnabled = globalInfo.enabled ?? c.enabled ?? false;
    const hudEnabled = hud.enabled ?? c.actionBarEnabled ?? false;

    const globalInterval = Math.max(1, globalInfo.updateInterval ?? 20);
    const hudInterval = Math.max(1, hud.updateInterval ?? 20);

    const shouldUpdateGlobal = force || (globalInfoEnabled && currentTick % globalInterval === 0);
    const shouldUpdateHud = force || (hudEnabled && currentTick % hudInterval === 0);

    if (!globalInfoEnabled) {
        clearSidebarObjective();
    }

    // Process Scoreboard Sidebar (Global Info)
    if (shouldUpdateGlobal && globalInfoEnabled) {
        updateGlobalSidebarObjective(globalInfo, config);
    }

    // Process Action Bar HUD per player
    for (const player of players) {
        try {
            if (!player.isValid) {
                continue;
            }

            const pData = getPlayer(player.id);
            if (!isDefined(pData)) {
                continue;
            }

            const visible = getSidebarVisible(player.id);
            if (!visible) {
                continue;
            }

            if (shouldUpdateHud && hudEnabled) {
                // Check if action bar override is active
                const overrideExpiry = actionBarOverrides.get(player.id);
                if (overrideExpiry !== undefined && Date.now() < overrideExpiry) {
                    continue; // Skip updating action bar while override message is visible
                } else if (overrideExpiry !== undefined) {
                    actionBarOverrides.delete(player.id);
                }

                const sourceLines = hud.actionBarLines ?? ((config as { actionBarLines?: string[] }).actionBarLines ?? []);
                const processedLines = sourceLines.map((line) => resolveGlobalPlaceholders(line, player));
                player.onScreenDisplay.setActionBar(processedLines.join(' '));
            }
        } catch (error) {
            debugLog(`Error updating sidebar for ${player.name}: ${String(error)}`);
        }
    }
}

function updateGlobalSidebarObjective(globalInfo: { title?: string; maxPlayers?: number; sidebarLines?: string[] }, config: unknown) {
    try {
        const scoreboard = mc.world.scoreboard;
        let objective = scoreboard.getObjective(SIDEBAR_OBJECTIVE_ID);

        const rawTitle = globalInfo.title ?? (config as { title?: string }).title ?? '§l§6{server_name}';
        const title = resolveGlobalPlaceholders(rawTitle);

        if (!objective) {
            objective = scoreboard.addObjective(SIDEBAR_OBJECTIVE_ID, title);
        } else if (objective.displayName !== title) {
            // Re-create objective to update display name safely
            scoreboard.clearObjectiveAtDisplaySlot(mc.DisplaySlotId.Sidebar);
            scoreboard.removeObjective(objective);
            objective = scoreboard.addObjective(SIDEBAR_OBJECTIVE_ID, title);
        }

        // Clean existing participants to replace with updated lines
        const existingParticipants = objective.getParticipants();
        for (const participant of existingParticipants) {
            objective.removeParticipant(participant);
        }

        const sourceLines = globalInfo.sidebarLines ?? (config as { sidebarLines?: string[] }).sidebarLines ?? [];
        const lineCount = sourceLines.length;

        for (let i = 0; i < lineCount; i++) {
            const rawLine = sourceLines[i] ?? '';
            let lineText = resolveGlobalPlaceholders(rawLine);

            // Bedrock scoreboards ignore duplicate line strings.
            // Add unique trailing zero-width whitespace/section codes if line repeats.
            lineText = lineText + '§r'.repeat(i);

            // Scores are set in descending order (e.g., lineCount down to 1) to render top-to-bottom
            const score = lineCount - i;
            objective.setScore(lineText, score);
        }

        // Ensure display slot is set to Sidebar
        scoreboard.setObjectiveAtDisplaySlot(mc.DisplaySlotId.Sidebar, {
            objective: objective,
            sortOrder: mc.ObjectiveSortOrder.Descending
        });
    } catch (error) {
        debugLog(`Error updating global sidebar objective: ${String(error)}`);
    }
}

/**
 * Resolves global placeholders in a text string.
 * @param text The text containing placeholders.
 * @param player Optional player context for player-specific placeholders.
 * @returns The text with placeholders replaced.
 */
export function resolveGlobalPlaceholders(text: string, player?: mc.Player): string {
    const mainConfig = getConfig();
    const sidebarConfig = getSidebarConfig();
    const serverName = (mainConfig as { serverName?: string }).serverName || 'Minecraft Server';
    const maxPlayers = (sidebarConfig.globalInfo?.maxPlayers ?? 20).toString();
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('en-US', { hour12: false });
    const formattedDate = now.toISOString().split('T')[0] ?? '';

    let processed = text
        .replace('{server_name}', serverName)
        .replace('{online}', getPlayerCount().toString())
        .replace('{max_online}', maxPlayers)
        .replace('{tps}', cachedTps)
        .replace('{time}', formattedTime)
        .replace('{date}', formattedDate);

    // Leaderboard Placeholders
    if (processed.includes('{top_money_')) {
        const leaderboardService = serviceLocator.getService<EconomyLeaderboardService>('economy.leaderboard');
        const leaderboard = leaderboardService ? leaderboardService.getLeaderboard() : [];
        processed = processed.replaceAll(/\{top_money_(\d+)\}/g, (_match, indexStr) => {
            const i = Number.parseInt(indexStr, 10) - 1;
            if (isNumber(i) && i >= 0 && i < leaderboard.length) {
                const entry = leaderboard[i];
                return isDefined(entry) && isDefined(entry.name) ? `${entry.name}: ${formatCurrency(entry.balance)}` : '---';
            }
            return '---';
        });
    }

    if (player) {
        const pData = getPlayer(player.id);
        if (isDefined(pData)) {
            const rank = getPlayerRank(player, mainConfig);
            const teamManagerService = serviceLocator.getService<TeamManagerService>('team.manager');
            const team = teamManagerService ? teamManagerService.getTeamByPlayer(player.id) : undefined;
            const balance = pData.balance;
            const kills = pData.kills || 0;
            const deaths = pData.deaths || 0;
            const kdr = deaths === 0 ? kills.toFixed(2) : (kills / deaths).toFixed(2);
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

            processed = team ? processed.replace('{team}', team.name ?? 'None') : processed.replace('{team}', 'None');
        }
    }

    return processed;
}

/**
 * Sets a temporary override message on the action bar.
 * Useful for countdowns or critical alerts.
 */
export function setActionBarOverride(player: mc.Player, message: string, durationMs: number = 2000) {
    if (!player || !player.isValid) {return;}
    actionBarOverrides.set(player.id, Date.now() + durationMs);
    player.onScreenDisplay.setActionBar(message);
}
