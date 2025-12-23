import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

import { getTeamByPlayer } from '@features/teams/teamManager.js';

import { getConfig } from './configManager.js';
import { getSidebarConfig } from './configurations.js';
import { debugLog, errorLog } from './logger.js';
import { getOrCreatePlayer, getPlayTime, getSidebarVisible } from './playerDataManager.js';
import { getRankById } from './rankManager.js';
import { formatCurrency, formatDuration } from './utils.js';

let sidebarLoopId: number | undefined;
let hudLoopId: number | undefined;
let tpsLoopId: number | undefined;
let isUpdatingHUD = false;

let currentTPS = 20;
let lastTickTime = Date.now();
const tickCounts: number[] = [];

// Sidebar constants
const SIDEBAR_OBJECTIVE = 'exe:sidebar';
const MAGIC_STRING_BASE = '§~§s§b';

const actionBarOverrides = new Map<string, number>();

export function setActionBarOverride(player: mc.Player, text: string, durationMs = 1000) {
    try {
        player.onScreenDisplay.setActionBar(text);
    } catch {
        // Ignore
    }
    actionBarOverrides.set(player.id, Date.now() + durationMs);
}

export function initialize() {
    startTPSCounter();
    startLoops();
    debugLog('[SidebarManager] Initialized.');
}

export function getCurrentTPS() {
    return currentTPS;
}

export function cleanup() {
    stopLoops();
    stopTPSCounter();
    clearSidebarObjective();
    for (const player of mc.world.getAllPlayers()) {
        try {
            player.onScreenDisplay.setTitle('');
            player.onScreenDisplay.setActionBar('');
        } catch {
            /* ignore */
        }
    }
}

function startTPSCounter() {
    if (tpsLoopId !== undefined) return;

    tpsLoopId = mc.system.runInterval(() => {
        const now = Date.now();
        const duration = now - lastTickTime;
        lastTickTime = now;

        let tps = 20 / (duration / 1000);
        if (tps > 20) tps = 20;

        tickCounts.push(tps);
        if (tickCounts.length > 5) tickCounts.shift();

        const sum = tickCounts.reduce((a, b) => a + b, 0);
        currentTPS = Number.parseFloat((sum / tickCounts.length).toFixed(1));
    }, 20);
}

function stopTPSCounter() {
    if (tpsLoopId !== undefined) {
        mc.system.clearRun(tpsLoopId);
        tpsLoopId = undefined;
    }
}

function startLoops() {
    const config = getSidebarConfig();

    if (sidebarLoopId === undefined) {
        sidebarLoopId = mc.system.runInterval(
            () => {
                updateSidebar();
            },
            Math.max(1, config.updateInterval)
        );
    }

    if (hudLoopId === undefined && config.actionBarEnabled) {
        hudLoopId = mc.system.runInterval(
            () => {
                updatePersonalHUD();
            },
            Math.max(1, config.actionBarInterval)
        );
    }
}

function stopLoops() {
    if (sidebarLoopId !== undefined) {
        mc.system.clearRun(sidebarLoopId);
        sidebarLoopId = undefined;
    }
    if (hudLoopId !== undefined) {
        mc.system.clearRun(hudLoopId);
        hudLoopId = undefined;
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
            const title = resolveGlobalPlaceholders(config.title);
            objective = mc.world.scoreboard.addObjective(SIDEBAR_OBJECTIVE, title);
        } catch (error) {
            errorLog(`[SidebarManager] Failed to create objective: ${String(error)}`);
            return undefined;
        }
    }
    return objective;
}

export function resolveGlobalPlaceholders(text: string): string {
    const config = getSidebarConfig();
    const mainConfig = getConfig();
    const online = mc.world.getAllPlayers().length;

    const result = text
        .replaceAll('{server_name}', mainConfig?.serverName ?? 'Server')
        .replaceAll('{tps}', currentTPS.toString())
        .replaceAll('{online}', online.toString())
        .replaceAll('{max_players}', config.maxPlayers.toString())
        .replaceAll('{time}', new Date().toLocaleTimeString())
        .replaceAll('{date}', new Date().toLocaleDateString());

    return result;
}

function resolvePersonalPlaceholders(text: string, player: mc.Player, skipGlobal = false): string {
    let result = skipGlobal ? text : resolveGlobalPlaceholders(text);

    const pData = getOrCreatePlayer(player);
    if (!pData) return result;

    const rank = getRankById(pData.rankId);
    const team = getTeamByPlayer(player.id);
    const kdr = pData.deaths === 0 ? pData.kills : (pData.kills / pData.deaths).toFixed(2);
    const money = formatCurrency(pData.balance);
    const playTime = formatDuration(getPlayTime(player.id));

    // Position
    const { x, y, z } = player.location;

    // Dimension
    let dimName = 'Unknown';
    switch (player.dimension.id) {
        case MinecraftDimensionTypes.Overworld as string: {
            dimName = 'Overworld';
            break;
        }
        case MinecraftDimensionTypes.Nether as string: {
            dimName = 'Nether';
            break;
        }
        case MinecraftDimensionTypes.TheEnd as string: {
            dimName = 'The End';
            break;
        }
        default: {
            dimName = player.dimension.id.replace('minecraft:', '');
        }
    }

    result = result
        .replaceAll('{name}', player.name)
        .replaceAll('{money}', money)
        .replaceAll('{rank}', rank ? (rank.name ?? 'Unknown') : 'Unknown')
        .replaceAll('{kills}', (pData.kills || 0).toString())
        .replaceAll('{deaths}', (pData.deaths || 0).toString())
        .replaceAll('{streak}', (pData.killStreak || 0).toString())
        .replaceAll('{kdr}', kdr.toString())
        .replaceAll('{playtime}', playTime)
        .replaceAll('{team}', team ? team.name : 'None')
        .replaceAll('{ping}', 'N/A')
        .replaceAll('{x}', Math.floor(x).toString())
        .replaceAll('{y}', Math.floor(y).toString())
        .replaceAll('{z}', Math.floor(z).toString())
        .replaceAll('{dimension}', dimName);

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
        const resolvedTitle = resolveGlobalPlaceholders(config.title);
        if (objective.displayName !== resolvedTitle) {
            mc.world.scoreboard.removeObjective(SIDEBAR_OBJECTIVE);
            mc.world.scoreboard.addObjective(SIDEBAR_OBJECTIVE, resolvedTitle);
            return updateSidebar();
        }

        mc.world.scoreboard.setObjectiveAtDisplaySlot(mc.DisplaySlotId.Sidebar, {
            objective: objective,
            sortOrder: mc.ObjectiveSortOrder.Descending
        });

        const participants = objective.getParticipants();
        const newLines: string[] = [];
        for (const line of config.sidebarLines) {
            newLines.push(resolveGlobalPlaceholders(line));
        }

        let score = newLines.length;
        const desiredLinesSet = new Set(newLines);

        for (const p of participants) {
            if (!desiredLinesSet.has(p.displayName)) {
                objective.removeParticipant(p);
            }
        }

        const usedLines = new Set<string>();

        for (let lineText of newLines) {
            // Safety check for undefined if array has gaps
            if (lineText === undefined) continue;

            while (usedLines.has(lineText)) {
                lineText += ' ';
            }
            usedLines.add(lineText);
            objective.setScore(lineText, score);
            score--;
        }
    } catch (error) {
        errorLog(`[SidebarManager] Error updating sidebar: ${String(error)}`);
    }
}

function getMagicString(opacity: string): string {
    switch (opacity) {
        case 'high': {
            return MAGIC_STRING_BASE + '§1';
        }
        case 'medium': {
            return MAGIC_STRING_BASE + '§2';
        }
        case 'low': {
            return MAGIC_STRING_BASE + '§3';
        }
        case 'none': {
            return MAGIC_STRING_BASE + '§4';
        }
        default: {
            return MAGIC_STRING_BASE + '§2';
        }
    }
}

function updatePersonalHUD() {
    if (isUpdatingHUD) return;
    const config = getSidebarConfig();
    if (!config.actionBarEnabled || config.actionBarLines.length === 0) return;

    // Use runJob to spread processing across ticks
    mc.system.runJob(hudUpdateGenerator(config));
}

function* hudUpdateGenerator(config: ReturnType<typeof getSidebarConfig>) {
    isUpdatingHUD = true;
    try {
        const magicString = getMagicString(config.opacity || 'medium');
        const linesTemplate = config.actionBarLines.join('\n');
        const globalResolvedTemplate = resolveGlobalPlaceholders(linesTemplate);

        const players = mc.world.getAllPlayers();
        for (const player of players) {
            // Process one player per step to avoid lag
            try {
                const overrideExpiry = actionBarOverrides.get(player.id);
                if (overrideExpiry) {
                    if (Date.now() < overrideExpiry) continue;
                    actionBarOverrides.delete(player.id);
                }

                if (!getSidebarVisible(player.id)) {
                    continue;
                }

                const content = resolvePersonalPlaceholders(globalResolvedTemplate, player, true);
                const fullText = magicString + content;
                player.onScreenDisplay.setActionBar(fullText);
            } catch {
                // Ignore errors for disconnected players
            }
            yield;
        }
    } finally {
        isUpdatingHUD = false;
    }
}

export function forceUpdate() {
    stopLoops();
    startLoops();
    updateSidebar();
    updatePersonalHUD();
}
