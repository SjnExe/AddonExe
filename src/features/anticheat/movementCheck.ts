import { setTrackedInterval } from '@core/timerManager.js';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftDimensionTypes, MinecraftEffectTypes } from '@minecraft/vanilla-data';

import { errorLog } from '@core/logger.js';
import { getAllPlayersFromCache } from '@core/playerCache.js';
import { isDefined } from '@lib/guards.js';

import { AnticheatConfig, getAnticheatConfig } from '@features/anticheat/configLoader.js';
import { flag } from '@features/anticheat/flagManager.js';

interface PlayerMovementState {
    violationLevel: number; // Token bucket
}

const movementStates = new Map<string, PlayerMovementState>();
let isChecking = false;

// Slippery blocks that allow faster movement
const ICE_BLOCKS = new Set<string>([MinecraftBlockTypes.Ice, MinecraftBlockTypes.PackedIce, MinecraftBlockTypes.BlueIce, MinecraftBlockTypes.Slime, MinecraftBlockTypes.FrostedIce]);

export function startMovementCheckLoop() {
    // Check world border/roof/movement every few ticks
    // Using runJob to spread execution across ticks to prevent lag with many players.
    setTrackedInterval(() => {
        if (isChecking) return;
        try {
            const config = getAnticheatConfig();
            if (config.enabled !== true) return;

            mc.system.runJob(checkPlayersGenerator(config));
        } catch (error) {
            errorLog('Anticheat Movement Loop Error', error);
        }
    }, 5);
}

function* checkPlayersGenerator(config: AnticheatConfig) {
    isChecking = true;
    try {
        // Use cached players list to avoid expensive engine call
        const players = getAllPlayersFromCache();
        for (const player of players) {
            // Process one player per tick/slice

            if (player.isValid) {
                // Run checks
                if (config.movementCheck.enabled === true) {
                    checkMovement(player, config.movementCheck);
                }
                if (config.worldBorder.enabled === true) {
                    checkWorldBorder(player, config.worldBorder);
                }
                if (config.antiNetherRoof.enabled === true) {
                    checkNetherRoof(player, config.antiNetherRoof);
                }
            }
            yield;
        }
    } catch (error) {
        errorLog('Anticheat Job Error', error);
    } finally {
        isChecking = false;
    }
}

interface MovementCheckConfig {
    maxSpeed: number;
    maxSpeedIce: number;
    maxSpeedElytra: number;
}

function checkMovement(player: mc.Player, config: MovementCheckConfig) {
    if (player.getGameMode() === mc.GameMode.Creative || player.getGameMode() === mc.GameMode.Spectator) {
        movementStates.delete(player.id);
        return;
    }

    let state = movementStates.get(player.id);
    if (!isDefined(state)) {
        state = { violationLevel: 0 };
        movementStates.set(player.id, state);
    }

    // Use native velocity API for robust speed check
    const velocity = player.getVelocity();
    if (!isDefined(velocity)) return;

    // Convert blocks/tick to blocks/second (approximate)
    // We strictly check HORIZONTAL speed to avoid flagging falling players
    const hSpeed = Math.hypot(velocity.x, velocity.z) * 20;

    // Determine context-based limit
    let limit = config.maxSpeed;

    // Check for Gliding (Elytra)
    const isGliding = player.isGliding;
    // Check for Riptide (Trident) - hard to detect state directly, but usually involves high speed + wet/rain
    // We can check for 'Use Item' event but that's complex here.
    // For now, if they are using elytra, increase limit.
    if (isGliding) {
        limit = config.maxSpeedElytra;
    } else {
        // Check for Speed Effect
        const speedEffect = player.getEffect(MinecraftEffectTypes.Speed);
        if (isDefined(speedEffect)) {
            // Speed 1 = +20%, Speed 2 = +40%
            const amplifier = speedEffect.amplifier + 1;
            limit *= 1 + 0.2 * amplifier;
        }

        // Check for Ice/Slime below
        // We check the block directly below the player and slightly deeper
        try {
            const dimension = player.dimension;
            const currentPos = player.location;
            const blockBelow = dimension.getBlock({
                x: Math.floor(currentPos.x),
                y: Math.floor(currentPos.y - 0.5),
                z: Math.floor(currentPos.z)
            });
            const blockBelow2 = dimension.getBlock({
                x: Math.floor(currentPos.x),
                y: Math.floor(currentPos.y - 1.5),
                z: Math.floor(currentPos.z)
            });

            if ((isDefined(blockBelow) && ICE_BLOCKS.has(blockBelow.typeId)) || (isDefined(blockBelow2) && ICE_BLOCKS.has(blockBelow2.typeId))) {
                limit = config.maxSpeedIce;
            }
        } catch {
            // Ignore block read errors (unloaded chunks etc)
        }
    }

    // Token Bucket / Violation Accumulator
    // If speed > limit, accumulate violation
    // If speed < limit, decay violation
    if (hSpeed > limit) {
        // Add points proportional to excess speed
        const excess = hSpeed - limit;
        state.violationLevel += excess;
    } else {
        // Decay
        state.violationLevel = Math.max(0, state.violationLevel - 2); // Decay 2 points per check
    }

    // Threshold for flagging
    const FLAGGING_THRESHOLD = 20;

    if (state.violationLevel > FLAGGING_THRESHOLD) {
        flag(player, 'movementCheck', `Speed: ${hSpeed.toFixed(1)} bps (Limit: ${limit.toFixed(1)}, VL: ${state.violationLevel.toFixed(1)})`);
        // Clamp VL to prevent infinite buildup
        state.violationLevel = Math.min(state.violationLevel, 50);
    }
}

function checkWorldBorder(
    player: mc.Player,
    config: {
        enabled: boolean;
        overworldRadius: number;
        endRadius: number;
        netherRadiusRatio: number;
        center: { x: number; z: number } | undefined;
        knockbackAmount: number;
    }
) {
    if (player.getGameMode() === mc.GameMode.Spectator) return;

    const dimensionId = player.dimension.id;
    let radius = config.overworldRadius;
    let center = config.center;

    if (!isDefined(center)) {
        // Default to world spawn if not configured
        const spawn = mc.world.getDefaultSpawnLocation();
        center = { x: spawn.x, z: spawn.z };
    }

    if (dimensionId === (MinecraftDimensionTypes.Nether as string)) {
        radius = Math.floor(config.overworldRadius / config.netherRadiusRatio);
    } else if (dimensionId === (MinecraftDimensionTypes.TheEnd as string)) {
        radius = config.endRadius;
        // End usually centers on 0,0 regardless of overworld spawn
        center = { x: 0, z: 0 };
    }

    const dx = Math.abs(player.location.x - center.x);
    const dz = Math.abs(player.location.z - center.z);

    if (dx > radius || dz > radius) {
        // Player is outside border
        // Calculate pushback direction (towards center)
        // Simple teleport to the clamped position
        const clampedX = Math.max(center.x - radius, Math.min(center.x + radius, player.location.x));
        const clampedZ = Math.max(center.z - radius, Math.min(center.z + radius, player.location.z));

        // Push them back slightly inside
        // Determine vector from center to player
        const vecX = player.location.x - center.x;
        const vecZ = player.location.z - center.z;

        // Normalize and invert
        const len = Math.hypot(vecX, vecZ);
        const pushX = len > 0 ? (vecX / len) * -config.knockbackAmount : 0;
        const pushZ = len > 0 ? (vecZ / len) * -config.knockbackAmount : 0;

        try {
            player.teleport(
                {
                    x: clampedX + pushX,
                    y: player.location.y,
                    z: clampedZ + pushZ
                },
                { dimension: player.dimension }
            );
            player.sendMessage(`§cYou have reached the world border!`);
        } catch {
            // Teleport might fail if stuck
        }
    }
}

function checkNetherRoof(player: mc.Player, config: { maxHeight: number }) {
    if (player.dimension.id !== (MinecraftDimensionTypes.Nether as string)) return;
    if (player.getGameMode() === mc.GameMode.Spectator || player.getGameMode() === mc.GameMode.Creative) return; // Allow admins/spectators

    if (player.location.y > config.maxHeight) {
        // Teleport down or kick
        // Kick is safest to force reset
        try {
            // Check if there is space below, else just run command to kick/kill
            // We'll teleport them down 5 blocks as a soft fix, if that fails, maybe more drastic
            // User requested: "gets kicked"
            // We execute as the dimension (server context) to ensure it works even if the player is non-op.
            player.dimension.runCommand(`kick "${player.name}" Nether Roof Detected`);
        } catch {
            // If kick fails, TP down
            try {
                player.teleport({ x: player.location.x, y: 120, z: player.location.z }, { dimension: player.dimension });
            } catch {
                // Ignore
            }
        }
    }
}
