import * as mc from '@minecraft/server';

import { getSidebarConfig } from './configurations.js';
import { debugLog, errorLog } from './logger.js';
import { getPlayTime, getSidebarVisible, getPlayer } from './playerDataManager.js';
import { getRankById } from './rankManager.js';
import { getTeamByPlayer } from './teamManager.js';
import { formatCurrency, formatDuration } from './utils.js';

let sidebarLoopId: number | null = null;
let actionBarLoopId: number | null = null;
let tpsLoopId: number | null = null;

let currentTPS = 20;
let lastTickTime = Date.now();
const tickCounts: number[] = [];

let actionBarIndex = 0;

// Sidebar constants
const SIDEBAR_OBJECTIVE = 'exe:sidebar';

export function initialize() {
    startTPSCounter();
    startLoops();
    debugLog('[SidebarManager] Initialized.');
}

export function cleanup() {
    stopLoops();
    stopTPSCounter();
    clearSidebarObjective();
}

function startTPSCounter() {
    if (tpsLoopId !== null) return;

    // We count ticks every second
    tpsLoopId = mc.system.runInterval(() => {
        const now = Date.now();
        // Calculate TPS based on how many ticks happened (always 20 in runInterval relative to game, but time varies)
        // Wait, runInterval(20) runs every 20 ticks.
        // If server is lagging, it takes > 1000ms.
        // TPS = 20 / (duration / 1000)
        const duration = now - lastTickTime;
        lastTickTime = now;

        let tps = 20 / (duration / 1000);
        if (tps > 20) tps = 20; // Clamp

        // Smoothing
        tickCounts.push(tps);
        if (tickCounts.length > 5) tickCounts.shift();

        const sum = tickCounts.reduce((a, b) => a + b, 0);
        currentTPS = parseFloat((sum / tickCounts.length).toFixed(1));
    }, 20);
}

function stopTPSCounter() {
    if (tpsLoopId !== null) {
        mc.system.clearRun(tpsLoopId);
        tpsLoopId = null;
    }
}

function startLoops() {
    const config = getSidebarConfig();

    if (sidebarLoopId === null) {
        sidebarLoopId = mc.system.runInterval(() => {
            updateSidebar();
        }, Math.max(1, config.updateInterval));
    }

    if (actionBarLoopId === null && config.actionBarEnabled) {
        actionBarLoopId = mc.system.runInterval(() => {
            updateActionBar();
        }, Math.max(1, config.actionBarInterval));
    }
}

function stopLoops() {
    if (sidebarLoopId !== null) {
        mc.system.clearRun(sidebarLoopId);
        sidebarLoopId = null;
    }
    if (actionBarLoopId !== null) {
        mc.system.clearRun(actionBarLoopId);
        actionBarLoopId = null;
    }
}

function clearSidebarObjective() {
    try {
        const objective = mc.world.scoreboard.getObjective(SIDEBAR_OBJECTIVE);
        if (objective) {
            mc.world.scoreboard.removeObjective(SIDEBAR_OBJECTIVE);
        }
    } catch {
        // Ignore
    }
}

function getOrCreateSidebarObjective(): mc.ScoreboardObjective | undefined {
    let objective = mc.world.scoreboard.getObjective(SIDEBAR_OBJECTIVE);
    if (!objective) {
        try {
            const config = getSidebarConfig();
            objective = mc.world.scoreboard.addObjective(SIDEBAR_OBJECTIVE, config.title);
        } catch (e) {
            errorLog(`[SidebarManager] Failed to create objective: ${e}`);
            return undefined;
        }
    }
    return objective;
}

function resolveGlobalPlaceholders(text: string): string {
    const config = getSidebarConfig();
    const online = mc.world.getAllPlayers().length;

    const result = text
        .replace(/{tps}/g, currentTPS.toString())
        .replace(/{online}/g, online.toString())
        .replace(/{max_players}/g, config.maxPlayers.toString())
        // Date/Time
        .replace(/{time}/g, new Date().toLocaleTimeString())
        .replace(/{date}/g, new Date().toLocaleDateString());

    return result;
}

function resolvePersonalPlaceholders(text: string, player: mc.Player): string {
    // Resolve global first
    let result = resolveGlobalPlaceholders(text);

    const pData = getPlayer(player.id);
    if (!pData) return result;

    const rank = getRankById(pData.rankId);
    const team = getTeamByPlayer(player.id);
    const kdr = pData.deaths === 0 ? pData.kills : (pData.kills / pData.deaths).toFixed(2);
    const money = formatCurrency(pData.balance);
    const playTime = formatDuration(getPlayTime(player.id));

    result = result
        .replace(/{name}/g, player.name)
        .replace(/{money}/g, money)
        .replace(/{rank}/g, rank ? (rank.name ?? 'Unknown') : 'Unknown')
        .replace(/{kills}/g, (pData.kills || 0).toString())
        .replace(/{deaths}/g, (pData.deaths || 0).toString())
        .replace(/{streak}/g, (pData.killStreak || 0).toString())
        .replace(/{kdr}/g, kdr.toString())
        .replace(/{playtime}/g, playTime)
        .replace(/{team}/g, team ? team.name : 'None')
        .replace(/{ping}/g, 'N/A'); // Ping not supported

    return result;
}

function updateSidebar() {
    const config = getSidebarConfig();
    if (!config.enabled) {
        clearSidebarObjective();
        return;
    }

    const objective = getOrCreateSidebarObjective();
    if (!objective) return;

    // Vanilla Scoreboard Logic:
    // To update lines, we must match the participant names.
    // Score dictates order. Line 1 = Highest Score.
    // We'll use scores starting from 15 down to 1.

    try {
        // Update Title if changed
        if (objective.displayName !== config.title) {
            // Need to recreate to change title? No, displayName property is read-only in some versions?
            // Checking types... ScoreboardObjective.displayName is readonly.
            // So we must recreate.
            mc.world.scoreboard.removeObjective(SIDEBAR_OBJECTIVE);
            mc.world.scoreboard.addObjective(SIDEBAR_OBJECTIVE, config.title);
            // Re-fetch
            return updateSidebar();
        }

        mc.world.scoreboard.setObjectiveAtDisplaySlot(mc.DisplaySlotId.Sidebar, {
            objective: objective,
            sortOrder: mc.ObjectiveSortOrder.Descending
        });

        // Current participants (lines)
        const participants = objective.getParticipants();
        const currentLines = new Set<string>();
        participants.forEach(p => currentLines.add(p.displayName));

        // Desired lines
        // We only support Global Placeholders here because it's shared.
        const newLines: string[] = [];
        config.sidebarLines.forEach(line => {
            newLines.push(resolveGlobalPlaceholders(line));
        });

        // Set scores
        // We go from length down to 1.
        let score = newLines.length;

        // We need to remove lines that are no longer present OR are in wrong position?
        // Actually, if we just setScore, it adds.
        // We must remove participants that are NOT in the new list.

        // Optimisation: Calculate lines to add/remove
        const desiredLinesSet = new Set(newLines);

        for (const p of participants) {
            if (!desiredLinesSet.has(p.displayName)) {
                objective.removeParticipant(p);
            }
        }

        // Add/Update lines
        const usedLines = new Set<string>();

        for (let i = 0; i < newLines.length; i++) {
            let lineText = newLines[i];

            // Ensure uniqueness by appending spaces if duplicate found
            while (usedLines.has(lineText)) {
                lineText += ' ';
            }
            usedLines.add(lineText);

            objective.setScore(lineText, score);
            score--;
        }

    } catch (e) {
        errorLog(`[SidebarManager] Error updating sidebar: ${e}`);
    }
}

function updateActionBar() {
    const config = getSidebarConfig();
    if (!config.actionBarEnabled || config.actionBarLines.length === 0) return;

    const linesTemplate = config.actionBarLines.join('\n');

    for (const player of mc.world.getAllPlayers()) {
        if (!getSidebarVisible(player.id)) { // Re-using sidebar toggle for HUD
            continue;
        }
        const text = resolvePersonalPlaceholders(linesTemplate, player);
        player.onScreenDisplay.setActionBar(text);
    }
}

export function forceUpdate() {
    stopLoops();
    startLoops();
    updateSidebar();
    updateActionBar();
}
