import * as mc from '@minecraft/server';

import { getSidebarConfig } from './configurations.js';
import { debugLog, errorLog } from './logger.js';
import { getPlayTime, getSidebarVisible, getPlayer } from './playerDataManager.js';
import { getRankById } from './rankManager.js';
import { getTeamByPlayer } from './teamManager.js';
import { formatCurrency, formatDuration } from './utils.js';

let sidebarLoopId: number | null = null;
let hudLoopId: number | null = null;
let tpsLoopId: number | null = null;

let currentTPS = 20;
let lastTickTime = Date.now();
const tickCounts: number[] = [];

// Sidebar constants
const SIDEBAR_OBJECTIVE = 'exe:sidebar';
const MAGIC_STRING_BASE = '§~§s§b';

export function initialize() {
    startTPSCounter();
    startLoops();
    debugLog('[SidebarManager] Initialized.');
}

export function cleanup() {
    stopLoops();
    stopTPSCounter();
    clearSidebarObjective();
    for (const player of mc.world.getAllPlayers()) {
        try {
            player.onScreenDisplay.setTitle('');
        } catch { /* ignore */ }
    }
}

function startTPSCounter() {
    if (tpsLoopId !== null) return;

    tpsLoopId = mc.system.runInterval(() => {
        const now = Date.now();
        const duration = now - lastTickTime;
        lastTickTime = now;

        let tps = 20 / (duration / 1000);
        if (tps > 20) tps = 20;

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

    if (hudLoopId === null && config.actionBarEnabled) {
        hudLoopId = mc.system.runInterval(() => {
            updateTitleSidebar();
        }, Math.max(1, config.actionBarInterval));
    }
}

function stopLoops() {
    if (sidebarLoopId !== null) {
        mc.system.clearRun(sidebarLoopId);
        sidebarLoopId = null;
    }
    if (hudLoopId !== null) {
        mc.system.clearRun(hudLoopId);
        hudLoopId = null;
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
        .replace(/{time}/g, new Date().toLocaleTimeString())
        .replace(/{date}/g, new Date().toLocaleDateString());

    return result;
}

function resolvePersonalPlaceholders(text: string, player: mc.Player): string {
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
        .replace(/{ping}/g, 'N/A');

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

    try {
        if (objective.displayName !== config.title) {
            mc.world.scoreboard.removeObjective(SIDEBAR_OBJECTIVE);
            mc.world.scoreboard.addObjective(SIDEBAR_OBJECTIVE, config.title);
            return updateSidebar();
        }

        mc.world.scoreboard.setObjectiveAtDisplaySlot(mc.DisplaySlotId.Sidebar, {
            objective: objective,
            sortOrder: mc.ObjectiveSortOrder.Descending
        });

        const participants = objective.getParticipants();
        const newLines: string[] = [];
        config.sidebarLines.forEach(line => {
            newLines.push(resolveGlobalPlaceholders(line));
        });

        let score = newLines.length;
        const desiredLinesSet = new Set(newLines);

        for (const p of participants) {
            if (!desiredLinesSet.has(p.displayName)) {
                objective.removeParticipant(p);
            }
        }

        const usedLines = new Set<string>();

        for (let i = 0; i < newLines.length; i++) {
            let lineText = newLines[i];
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

function getMagicString(opacity: string): string {
    switch (opacity) {
        case 'high': return MAGIC_STRING_BASE + '§1';
        case 'medium': return MAGIC_STRING_BASE + '§2';
        case 'low': return MAGIC_STRING_BASE + '§3';
        case 'none': return MAGIC_STRING_BASE + '§4';
        default: return MAGIC_STRING_BASE + '§2';
    }
}

function updateTitleSidebar() {
    const config = getSidebarConfig();
    if (!config.actionBarEnabled || config.actionBarLines.length === 0) return;

    const magicString = getMagicString(config.opacity || 'medium');
    const linesTemplate = config.actionBarLines.join('\n');

    for (const player of mc.world.getAllPlayers()) {
        if (!getSidebarVisible(player.id)) {
            continue;
        }
        const content = resolvePersonalPlaceholders(linesTemplate, player);
        const fullText = magicString + content;

        player.onScreenDisplay.setTitle(fullText, {
            fadeInDuration: 0,
            stayDuration: 60,
            fadeOutDuration: 0
        });
    }
}

export function forceUpdate() {
    stopLoops();
    startLoops();
    updateSidebar();
    updateTitleSidebar();
}
