import type { AnticheatConfig } from '@core/config/configurations.js';
import * as configLoader from '@core/config/configurations.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { errorLog } from '@core/utils/logger.js';
import { kickPlayer } from '@core/utils/player.js';
import { clearTrackedInterval, setTrackedInterval, setTrackedJob } from '@core/utils/timerManager.js';
import * as flagManager from '@features/anticheat/flagManager.js';
import { isDefined } from '@lib/guards.js';
import { EntityComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import {
  MinecraftBlockTypes,
  MinecraftDimensionTypes,
  MinecraftEffectTypes,
  MinecraftItemTypes,
} from '@minecraft/vanilla-data';

interface PlayerMovementState {
  violationLevel: number; // Token bucket
  airTicks: number;
  lastDamageTimestamp?: number;
}

const movementStates = new Map<string, PlayerMovementState>();
let isChecking = false;
let movementIntervalId: number | undefined;

export function recordMovementDamage(playerId: string): void {
  let state = movementStates.get(playerId);
  if (!isDefined(state)) {
    state = { violationLevel: 0, airTicks: 0, lastDamageTimestamp: Date.now() };
    movementStates.set(playerId, state);
  } else {
    state.lastDamageTimestamp = Date.now();
    state.violationLevel = Math.max(0, state.violationLevel - 5);
  }
}

export function clearPlayerMovementState(playerId: string): void {
  movementStates.delete(playerId);
}

export function _resetMovementCheckForTest() {
  movementStates.clear();
  isChecking = false;
  if (isDefined(movementIntervalId)) {
    clearTrackedInterval(movementIntervalId);
    movementIntervalId = undefined;
  }
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
  if (isDefined(movementIntervalId)) {
    clearTrackedInterval(movementIntervalId);
  }
  movementIntervalId = setTrackedInterval(() => {
    if (isChecking) {
      return;
    }
    try {
      const config = configLoader.getAnticheatConfig();
      if (config.enabled !== true) {
        return;
      }

      setTrackedJob(checkPlayersGenerator(config));
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
  invalidSprint?: boolean;
}

function isSupportedBlock(block: mc.Block | undefined): boolean {
  if (!isDefined(block)) {
    return true;
  }
  if (!block.isAir || block.isLiquid) {
    return true;
  }
  const typeId = block.typeId;
  return (
    typeId.includes('slab') ||
    typeId.includes('stairs') ||
    typeId.includes('wall') ||
    typeId.includes('fence') ||
    typeId.includes('carpet') ||
    typeId.includes('scaffolding') ||
    typeId.includes('ladder') ||
    typeId.includes('web') ||
    typeId.includes('bubble_column')
  );
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

  // 1. InvalidSprint Check: impossible sprint states (Blindness, Sneaking)
  if (config.invalidSprint !== false && player.isSprinting) {
    const hasBlindness =
      typeof player.getEffect === 'function' && isDefined(player.getEffect(MinecraftEffectTypes.Blindness));
    if (hasBlindness) {
      flagManager.flag(player, 'movementCheck', 'InvalidSprint: Sprinting while blinded');
    } else if (player.isSneaking) {
      flagManager.flag(player, 'movementCheck', 'InvalidSprint: Sprinting while sneaking');
    }
  }

  // 2. Mount Exemption: players riding horses, minecarts, boats inherit mount velocity
  const isRiding = isDefined(player.getComponent(EntityComponentTypes.Riding));
  if (isRiding) {
    state.violationLevel = Math.max(0, state.violationLevel - 5);
    state.airTicks = 0;
    return;
  }

  // Use native velocity API for robust speed check
  const velocity = typeof player.getVelocity === 'function' ? player.getVelocity() : undefined;
  if (!isDefined(velocity)) {
    return;
  }

  // Convert blocks/tick to blocks/second (approximate)
  // Strictly check HORIZONTAL speed to avoid flagging falling players
  const hSpeed = Math.hypot(velocity.x, velocity.z) * 20;

  // Determine context-based limit
  let limit = config.maxSpeed;

  // Check for Gliding (Elytra)
  const isGliding = player.isGliding;

  if (isGliding) {
    limit = config.maxSpeedElytra;
  } else {
    // Check if player has a trident equipped for Riptide boost
    const equippable = player.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;
    const mainHandItem = equippable?.getEquipment(mc.EquipmentSlot.Mainhand);
    if (mainHandItem?.typeId === MinecraftItemTypes.Trident) {
      limit = Math.max(limit, 55); // Riptide III boost threshold
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
  }

  // Token Bucket / Violation Accumulator
  // Knockback / explosion / wind charge grace window: 2.5 seconds
  const isUnderKnockback = isDefined(state.lastDamageTimestamp) && Date.now() - state.lastDamageTimestamp < 2500;
  const effectiveLimit = isUnderKnockback ? Math.max(limit * 2.5, 35) : limit;

  // If speed > limit, accumulate violation
  if (hSpeed > effectiveLimit) {
    const excess = hSpeed - effectiveLimit;
    state.violationLevel += excess;
  } else {
    // Decay
    state.violationLevel = Math.max(0, state.violationLevel - 2);
  }

  // Flight / Hover Detection
  if (
    config.flightDetection === true &&
    !isGliding &&
    !player.isFlying &&
    !player.isSleeping &&
    !isRiding &&
    !isUnderKnockback
  ) {
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
      if (isSupportedBlock(b0) || isSupportedBlock(b1)) {
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
    const kicked = kickPlayer(player.name, 'Nether Roof Detected');
    if (!kicked) {
      try {
        player.teleport({ x: player.location.x, y: 120, z: player.location.z }, { dimension: player.dimension });
      } catch {
        // Ignore
      }
    }
  }
}
