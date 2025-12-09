import * as mc from '@minecraft/server';

import { errorLog } from '@core/logger.js';

import { getAnticheatConfig } from './anticheatConfigLoader.js';
import { flag } from './flagManager.js';

interface PlayerMovementState {
    violationLevel: number; // Token bucket
}

const movementStates = new Map<string, PlayerMovementState>();

// Slippery blocks that allow faster movement
const ICE_BLOCKS = new Set([
    'minecraft:ice',
    'minecraft:packed_ice',
    'minecraft:blue_ice',
    'minecraft:slime',
    'minecraft:frosted_ice'
]);

export function startMovementCheckLoop() {
    // Check world border/roof/movement every few ticks
    // Using runJob is better for performance if widely supported, but runInterval is safer for stability.
    // However, for smooth checks, runInterval with a small delay is good.
    // Let's use 5 ticks (0.25s) for checks.
    mc.system.runInterval(() => {
        try {
            const config = getAnticheatConfig();
            if (!config.enabled) return;

            const players = mc.world.getAllPlayers();
            for (const player of players) {
                if (!player.isValid) continue;

                // Run checks
                if (config.movementCheck.enabled) {
                    checkMovement(player, config.movementCheck);
                }
                if (config.worldBorder.enabled) {
                    checkWorldBorder(player, config.worldBorder);
                }
                if (config.antiNetherRoof.enabled) {
                    checkNetherRoof(player, config.antiNetherRoof);
                }
            }
        } catch (e) {
            errorLog('Anticheat Movement Loop Error', e);
        }
    }, 5);
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
    if (!state) {
        state = { violationLevel: 0 };
        movementStates.set(player.id, state);
    }

    // Use native velocity API for robust speed check
    const velocity = player.getVelocity();
    if (!velocity) return;

    // Convert blocks/tick to blocks/second (approximate)
    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2) * 20;

    // Determine context-based limit
    let limit = config.maxSpeed;

    // Check for Gliding (Elytra)
    const isGliding = player.isGliding;
    if (isGliding) {
        limit = config.maxSpeedElytra;
    } else {
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

            if (
                (blockBelow && ICE_BLOCKS.has(blockBelow.typeId)) ||
                (blockBelow2 && ICE_BLOCKS.has(blockBelow2.typeId))
            ) {
                limit = config.maxSpeedIce;
            }
        } catch {
            // Ignore block read errors (unloaded chunks etc)
        }
    }

    // Token Bucket / Violation Accumulator
    // If speed > limit, accumulate violation
    // If speed < limit, decay violation
    if (speed > limit) {
        // Add points proportional to excess speed
        const excess = speed - limit;
        state.violationLevel += excess;
    } else {
        // Decay
        state.violationLevel = Math.max(0, state.violationLevel - 2.0); // Decay 2 points per check
    }

    // Threshold for flagging
    const FLAGGING_THRESHOLD = 20;

    if (state.violationLevel > FLAGGING_THRESHOLD) {
        flag(
            player,
            'movementCheck',
            `Speed: ${speed.toFixed(1)} bps (Limit: ${limit}, VL: ${state.violationLevel.toFixed(1)})`
        );
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
        center: { x: number; z: number } | null;
        knockbackAmount: number;
    }
) {
    if (player.getGameMode() === mc.GameMode.Spectator) return;

    const dimensionId = player.dimension.id;
    let radius = config.overworldRadius;
    let center = config.center;

    if (!center) {
        // Default to world spawn if not configured
        const spawn = mc.world.getDefaultSpawnLocation();
        center = { x: spawn.x, z: spawn.z };
    }

    if (dimensionId === 'minecraft:nether') {
        radius = Math.floor(config.overworldRadius / config.netherRadiusRatio);
    } else if (dimensionId === 'minecraft:the_end') {
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
        const len = Math.sqrt(vecX * vecX + vecZ * vecZ);
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
    if (player.dimension.id !== 'minecraft:nether') return;
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
                player.teleport(
                    { x: player.location.x, y: 120, z: player.location.z },
                    { dimension: player.dimension }
                );
            } catch {
                // Ignore
            }
        }
    }
}
