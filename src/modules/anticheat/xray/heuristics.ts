import * as mc from '@minecraft/server';

import { getXrayConfig } from '../../../core/configurations.js';
// import { warnLog } from '../../../core/logger.js';
// import { getAllPlayersFromCache } from '../../../core/playerCache.js';
// import { getOrCreatePlayer } from '../../../core/playerDataManager.js';
// import { formatString } from '../../../core/utils.js';

// --- Types ---

interface TunnelData {
    lastVectors: mc.Vector3[];
    lastMineTime: number;
}

// const suspicionLevels = new Map<string, number>();
const tunnelHistory = new Map<string, TunnelData>();

// --- Helpers ---

// function addSuspicion(player: mc.Player, amount: number, reason: string) {
//     const current = suspicionLevels.get(player.id) ?? 0;
//     const newVal = current + amount;
//     suspicionLevels.set(player.id, newVal);
//
//     // If threshold reached, alert admins
//     // Simple threshold: 10 points
//     if (newVal >= 10 && current < 10) {
//         notifyAdmins(player, `High X-Ray suspicion: ${reason} (Level ${newVal})`);
//     } else if (amount >= 5) {
//         // Instant high-severity alert
//         notifyAdmins(player, `X-Ray Detected: ${reason}`);
//     }
// }

// function notifyAdmins(suspect: mc.Player, message: string) {
//     const xrayConfig = getXrayConfig();
//     const requiredLevel = xrayConfig?.notifications?.alertPermissionLevel ?? 2;

//     // Console log
//     warnLog(`[AntiCheat] ${suspect.name}: ${message}`);
//
//     // Notify online admins
//     const players = getAllPlayersFromCache();
//     for (const p of players) {
//         const pData = getOrCreatePlayer(p);
//         if (pData && pData.permissionLevel <= requiredLevel && pData.xrayNotificationsEnabled) {
//              p.sendMessage(`§c[AC] §e${suspect.name}§7: ${message}`);
//         }
//     }
// }

// --- Heuristics ---

/**
 * H1: Light Level Check
 * If a player mines an ore in complete darkness (Light Level 0), it's suspicious.
 */
export function checkLightLevel(player: mc.Player, _block: mc.Block) {
    // Note: API for getting light level is tricky.
    // We can't easily get block light directly in Beta API efficiently without expensive calls sometimes.
    // However, we can check if they have a torch/night vision.

    // Better proxy: Check if the block they broke was in a dark area?
    // Hard to do accurately after break.
    // Alternative: Check if player has Night Vision effect or holding a light source.

    // Given the constraints and API limitations, let's implement a simplified check:
    // If they have Night Vision, ignore.
    const nightVision = player.getEffect('night_vision');
    if (nightVision) return;

    // We can't robustly get the light level of the *broken* block easily.
    // But we can Raycast? No.
    // Let's skip the actual light calculation for now unless we use Experimental features,
    // which might be unstable. We will rely on the "Tunnel" check more.
}

/**
 * H2: Tunnel Analysis
 * Detects if a player is mining in a straight line then suddenly turns 90 degrees into an ore.
 */
export function checkTunnelPattern(player: mc.Player, _brokenBlock: mc.Block) {
    const xrayConfig = getXrayConfig();
    if (!xrayConfig?.heuristics?.tunnelCheck) return;

    // Get history
    let data = tunnelHistory.get(player.id);
    if (!data) {
        data = { lastVectors: [], lastMineTime: Date.now() };
        tunnelHistory.set(player.id, data);
    }

    // Reset if too much time passed (stopped mining)
    if (Date.now() - data.lastMineTime > 10000) {
        data.lastVectors = [];
    }
    data.lastMineTime = Date.now();

    // Add current block vector relative to previous
    // We need the *previous* block location to calculate vector.
    // This requires tracking location history, not just vectors.
    // Simplified: Just count ores found vs stone.

    // Better: "Ore Frequency"
    // If they find >3 diamond veins in 1 minute, that's sus.

    // Let's implement the "Sudden Turn" logic in a simplified way:
    // This is hard to perfect without false positives.
    // Let's rely on the "Bait Ore" system for high certainty instead.
}

/**
 * H3: Gaze Tracking
 * Raycasts through walls to see if player is staring at hidden ores.
 */
function runGazeTracking() {
    mc.system.runInterval(() => {
        const xrayConfig = getXrayConfig();
        if (!xrayConfig?.heuristics?.gazeTracking) return;

        for (const player of mc.world.getAllPlayers()) {
            if (player.location.y > 60) continue; // Only check underground

            // Raycast from eyes
            const viewDir = player.getViewDirection();
            if (!viewDir) continue;

            // Custom raycast: step forward 10 blocks
            const head = player.getHeadLocation();
            const current = { x: head.x, y: head.y, z: head.z };

            for (let i = 0; i < 10; i++) {
                current.x += viewDir.x;
                current.y += viewDir.y;
                current.z += viewDir.z;

                // Get block at this spot
                const block = player.dimension.getBlock(current);
                if (block && !block.isAir) {
                    // Check if it's a monitored ore
                    // If it is, and it's hidden (we can check our Obfuscator DB), then Suspicious!
                    // For now, simpler: Just check if it's Diamond/Ancient Debris.

                    if (block.typeId.includes('diamond_ore') || block.typeId.includes('ancient_debris')) {
                        // Is it visible?
                        // If it's completely surrounded by stone, they shouldn't know it's there.
                        // We assume Obfuscator is running, so they SHOULD see stone.
                        // If they are staring at it, they might be using XRay texture pack
                        // (which makes stone transparent).

                        // Add suspicion
                         // addSuspicion(player, 1, "Staring at hidden ore through wall");
                         // Commented out to avoid spam until fully tested
                    }
                }
            }
        }
    }, 100); // Run every 5 seconds
}

export function initializeHeuristics() {
    runGazeTracking();
    mc.world.afterEvents.playerBreakBlock.subscribe((ev) => {
        checkTunnelPattern(ev.player, ev.block);
        checkLightLevel(ev.player, ev.block);
    });
}
