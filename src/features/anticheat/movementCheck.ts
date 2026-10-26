import type { AnticheatConfig } from '@core/config/configurations.js';
import * as configLoader from '@core/config/configurations.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { errorLog } from '@core/utils/logger.js';
import { escapeCommandArg } from '@core/utils/sanitization.js';
import * as flagManager from '@features/anticheat/flagManager.js';
import { isDefined } from '@lib/guards.js';
import { Vector3Utils } from '@minecraft/math';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftDimensionTypes, MinecraftEffectTypes } from '@minecraft/vanilla-data';

interface PlayerMovementState {
  violationLevel: number; // Token bucket
  airTicks: number;
}

const movementStates = new Map<string, PlayerMovementState>();
let isChecking = false;

export function _resetMovementCheckForTest() {
  movementStates.clear();
  isChecking = false;
}

// Slippery blocks that allow faster movement
const iceBlocks = new Set<string>([
  MinecraftBlockTypes.Ice,
  MinecraftBlockTypes.PackedIce,
  MinecraftBlockTypes.BlueIce,
  MinecraftBlockTypes.Slime,
  MinecraftBlockTypes.FrostedIce,
]);

export function startMovementCheckLoop() {
  // Check world border/roof/movement every few ticks
  // Using runJob to spread execution across ticks to prevent lag with many players.
  mc.system.runInterval(() => {
    if (isChecking) {
      return;
    }
    try {
      const config = configLoader.getAnticheatConfig();
      if (config.enabled !== true) {
        return;
      }

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

      if (player && player.isValid) {
        try {
          // Run checks
          if (config.movementCheck.enabled === true) {
            checkMovement(player, config.movementCheck);
          }
          if (config.antiNetherRoof.enabled === true) {
            checkNetherRoof(player, config.antiNetherRoof);
          }
        } catch (error) {
          errorLog('Anticheat Player Check Error', error);
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
  flightDetection?: boolean;
}

function checkMovement(player: mc.Player, config: MovementCheckConfig) {
  if (!player.dimension || !player.location) {
    return;
  }
  if (
    typeof player.getGameMode === 'function' &&
    (player.getGameMode() === mc.GameMode.Creative || player.getGameMode() === mc.GameMode.Spectator)
  ) {
    movementStates.delete(player.id);
    return;
  }

  let state = movementStates.get(player.id);
  if (!isDefined(state)) {
    state = { violationLevel: 0, airTicks: 0 };
    movementStates.set(player.id, state);
  }

  // Use native velocity API for robust speed check
  const velocity = typeof player.getVelocity === 'function' ? player.getVelocity() : undefined;
  if (!isDefined(velocity)) {
    return;
  }

  // Convert blocks/tick to blocks/second (approximate)
  // We strictly check HORIZONTAL speed to avoid flagging falling players
  const hSpeed = Vector3Utils.distance({ x: 0, y: 0, z: 0 }, { x: velocity.x, y: 0, z: velocity.z }) * 20;

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
    const speedEffect =
      typeof player.getEffect === 'function' ? player.getEffect(MinecraftEffectTypes.Speed) : undefined;
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
        z: Math.floor(currentPos.z),
      });
      const blockBelow2 = dimension.getBlock({
        x: Math.floor(currentPos.x),
        y: Math.floor(currentPos.y - 1.5),
        z: Math.floor(currentPos.z),
      });

      if (
        (isDefined(blockBelow) && iceBlocks.has(blockBelow.typeId)) ||
        (isDefined(blockBelow2) && iceBlocks.has(blockBelow2.typeId))
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
  if (hSpeed > limit) {
    // Add points proportional to excess speed
    const excess = hSpeed - limit;
    state.violationLevel += excess;
  } else {
    // Decay
    state.violationLevel = Math.max(0, state.violationLevel - 2); // Decay 2 points per check
  }

  // Flight / Hover Detection
  if (config.flightDetection === true && !isGliding) {
    const isOnGround = player.isOnGround === true;
    const isSwimming = player.isSwimming === true;
    const isClimbing = player.isClimbing === true;
    const hasLevitation =
      typeof player.getEffect === 'function' && isDefined(player.getEffect(MinecraftEffectTypes.Levitation));
    const hasSlowFalling =
      typeof player.getEffect === 'function' && isDefined(player.getEffect(MinecraftEffectTypes.SlowFalling));

    let nearGroundOrLiquid = false;
    try {
      const pos = player.location;
      const b0 = player.dimension.getBlock({ x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) });
      const b1 = player.dimension.getBlock({ x: Math.floor(pos.x), y: Math.floor(pos.y - 1), z: Math.floor(pos.z) });
      if ((isDefined(b0) && (!b0.isAir || b0.isLiquid)) || (isDefined(b1) && (!b1.isAir || b1.isLiquid))) {
        nearGroundOrLiquid = true;
      }
    } catch {
      nearGroundOrLiquid = true;
    }

    if (
      !isOnGround &&
      !isSwimming &&
      !isClimbing &&
      !hasLevitation &&
      !hasSlowFalling &&
      !nearGroundOrLiquid &&
      velocity.y >= -0.05
    ) {
      state.airTicks++;
      if (state.airTicks >= 12) {
        flagManager.flag(
          player,
          'movementCheck',
          `Flight/Hover detected (Air checks: ${state.airTicks}, vY: ${velocity.y.toFixed(2)})`,
        );
        state.airTicks = 8;
      }
    } else {
      state.airTicks = Math.max(0, state.airTicks - 2);
    }
  } else {
    state.airTicks = 0;
  }

  // Threshold for flagging
  const flaggingThreshold = 20;

  if (state.violationLevel > flaggingThreshold) {
    flagManager.flag(
      player,
      'movementCheck',
      `Speed: ${hSpeed.toFixed(1)} bps (Limit: ${limit.toFixed(1)}, VL: ${state.violationLevel.toFixed(1)})`,
    );
    // Clamp VL to prevent infinite buildup
    state.violationLevel = Math.min(state.violationLevel, 50);
  }
}

function checkNetherRoof(player: mc.Player, config: { maxHeight: number }) {
  if (!player.dimension || !player.location) {
    return;
  }
  if (player.dimension.id !== (MinecraftDimensionTypes.Nether as string)) {
    return;
  }
  if (
    typeof player.getGameMode === 'function' &&
    (player.getGameMode() === mc.GameMode.Spectator || player.getGameMode() === mc.GameMode.Creative)
  ) {
    return;
  } // Allow admins/spectators

  if (player.location.y > config.maxHeight) {
    // Teleport down or kick
    // Kick is safest to force reset
    try {
      // Attempt to kick the player for being above the nether roof.
      // We execute as the dimension (server context) to ensure it works even if the player is non-op.
      const safePlayerName = escapeCommandArg(player.name);
      player.dimension.runCommand(`kick "${safePlayerName}" Nether Roof Detected`);
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
