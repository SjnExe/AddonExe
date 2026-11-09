import type { AnticheatConfig } from '@core/config/configurations.js';
import * as configLoader from '@core/config/configurations.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { errorLog } from '@core/utils/logger.js';
import { kickPlayer } from '@core/utils/player.js';
import { clearTrackedInterval, setTrackedInterval, setTrackedJob } from '@core/utils/timerManager.js';
import { AntiCheatCheck } from '@features/anticheat/core/check.js';
import { checkRegistry } from '@features/anticheat/core/checkRegistry.js';
import {
  addGrace,
  hasGrace,
  recordPlayerBounceGrace,
  recordPlayerDamageGrace,
} from '@features/anticheat/core/graceManager.js';
import * as flagManager from '@features/anticheat/flagManager.js';
import { isDefined } from '@lib/guards.js';
import { EntityComponentTypes, ItemComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import {
  MinecraftBlockTypes,
  MinecraftDimensionTypes,
  MinecraftEffectTypes,
  MinecraftEnchantmentTypes,
  MinecraftItemTypes,
} from '@minecraft/vanilla-data';

interface PlayerMovementState {
  violationLevel: number; // Token bucket
  airTicks: number;
  lastDamageTimestamp?: number;
  lastIceTimestamp?: number;
}

const movementStates = new Map<string, PlayerMovementState>();
let isChecking = false;
let movementIntervalId: number | undefined;

const movementGraceReasons = ['teleport', 'respawn', 'damage', 'knockback', 'vehicle', 'bounce'] as const;
const flightGraceReasons = ['bounce', 'riptide'] as const;

/**
 * Records that a player took damage or knockback, granting movement grace and reducing violation levels.
 *
 * @param playerId The damaged player's unique identifier.
 */
export function recordMovementDamage(playerId: string): void {
  recordPlayerDamageGrace(playerId, 2500);
  let state = movementStates.get(playerId);
  if (!isDefined(state)) {
    state = { violationLevel: 0, airTicks: 0, lastDamageTimestamp: Date.now() };
    movementStates.set(playerId, state);
  } else {
    state.lastDamageTimestamp = Date.now();
    state.violationLevel = Math.max(0, state.violationLevel - 5);
  }
}

/**
 * Clears cached movement tracking state for a player upon leaving.
 *
 * @param playerId The leaving player's unique identifier.
 */
export function clearPlayerMovementState(playerId: string): void {
  movementStates.delete(playerId);
}

/** Resets movement check states and clears active interval timers for test isolation. */
export function _resetMovementCheckForTest(): void {
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
  MinecraftBlockTypes.FrostedIce,
]);

const bounceBlocks = new Set<string>([MinecraftBlockTypes.Slime]);

/** Starts the periodic movement inspection loop. */
export function startMovementCheckLoop(): void {
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

/**
 * Generator job iterating through active players to execute movement checks slice-by-slice.
 *
 * @param config Active anti-cheat master configuration.
 */
export function* checkPlayersGenerator(config: AnticheatConfig) {
  isChecking = true;
  try {
    const players = getAllPlayersFromCache();
    for (const player of players) {
      if (player && player.isValid) {
        try {
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
  iceFrictionGraceMs?: number;
  slimeBounceGraceMs?: number;
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
    typeId.includes('vine') ||
    typeId.includes('web') ||
    typeId.includes('powder_snow') ||
    typeId.includes('sweet_berry_bush') ||
    typeId.includes('bubble_column')
  );
}

/**
 * Checks whether an item stack is a trident enchanted with Riptide.
 *
 * @param item The item stack to inspect.
 * @returns True if the item is a Riptide-enchanted trident.
 */
function isRiptideTrident(item: mc.ItemStack | undefined): boolean {
  if (item?.typeId !== MinecraftItemTypes.Trident) {
    return false;
  }
  const enchantable = item.getComponent(ItemComponentTypes.Enchantable) as mc.ItemEnchantableComponent | undefined;
  return isDefined(enchantable) && enchantable.hasEnchantment(MinecraftEnchantmentTypes.Riptide);
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

  // 3. Centralized Grace Exemption (teleport, respawn, knockback, vehicle dismount)
  const isGraceActive = hasGrace(player.id, movementGraceReasons);
  const isUnderKnockback =
    isGraceActive || (isDefined(state.lastDamageTimestamp) && Date.now() - state.lastDamageTimestamp < 2500);

  // Use native velocity API for robust speed check
  const velocity = typeof player.getVelocity === 'function' ? player.getVelocity() : undefined;
  if (!isDefined(velocity)) {
    return;
  }

  // Strictly check HORIZONTAL speed to avoid flagging falling players
  const hSpeed = Math.hypot(velocity.x, velocity.z) * 20;

  // Determine context-based limit
  let limit = config.maxSpeed;

  // Check for Gliding (Elytra)
  const isGliding = player.isGliding;

  if (isGliding) {
    limit = config.maxSpeedElytra;
  } else {
    const now = Date.now();
    const iceGraceMs = config.iceFrictionGraceMs ?? 1500;
    const isIceGraceActive = isDefined(state.lastIceTimestamp) && now - state.lastIceTimestamp < iceGraceMs;

    // Fast path: if player velocity is within normal speed limit and no ice inertia is active,
    // skip native component, equipment, and block queries.
    const hasRiptideGrace = hasGrace(player.id, 'riptide');
    const hasBounceGrace = hasGrace(player.id, 'bounce');
    const isPotentialBounce = player.isOnGround !== true && velocity.y > 0.45 && !hasBounceGrace;

    if (hSpeed > limit || isIceGraceActive || hasRiptideGrace || hasBounceGrace || isPotentialBounce) {
      if (hasRiptideGrace) {
        limit = Math.max(limit, 55);
      } else if (hasBounceGrace) {
        limit = config.maxSpeedIce;
      } else {
        const equippable = player.getComponent(EntityComponentTypes.Equippable) as
          mc.EntityEquippableComponent | undefined;
        const mainHandItem = equippable?.getEquipment(mc.EquipmentSlot.Mainhand);
        const offhandItem = equippable?.getEquipment(mc.EquipmentSlot.Offhand);
        const hasTrident = isRiptideTrident(mainHandItem) || isRiptideTrident(offhandItem);

        if (hasTrident) {
          if (hSpeed > 15) {
            addGrace(player.id, 'riptide', 3000);
          }
          limit = Math.max(limit, 55); // Riptide III boost threshold
        } else {
          // Check for Speed Effect
          const speedEffect =
            typeof player.getEffect === 'function' ? player.getEffect(MinecraftEffectTypes.Speed) : undefined;
          if (isDefined(speedEffect)) {
            const amplifier = speedEffect.amplifier + 1;
            limit *= 1 + 0.2 * amplifier;
          }

          // Check slippery / bounce blocks below
          const slimeGraceMs = config.slimeBounceGraceMs ?? 2500;

          // Inspect block below if speed is elevated, checking ice inertia, or potential bounce
          if (hSpeed > limit || isIceGraceActive || isPotentialBounce) {
            try {
              const dimension = player.dimension;
              const currentPos = player.location;
              const bBelow = dimension.getBlock({
                x: Math.floor(currentPos.x),
                y: Math.floor(currentPos.y - 0.5),
                z: Math.floor(currentPos.z),
              });
              const bBelow2 = dimension.getBlock({
                x: Math.floor(currentPos.x),
                y: Math.floor(currentPos.y - 1.5),
                z: Math.floor(currentPos.z),
              });

              const type1 = bBelow?.typeId;
              const type2 = bBelow2?.typeId;

              if ((isDefined(type1) && iceBlocks.has(type1)) || (isDefined(type2) && iceBlocks.has(type2))) {
                state.lastIceTimestamp = now;
                limit = config.maxSpeedIce;
              } else if (
                isPotentialBounce &&
                ((isDefined(type1) && bounceBlocks.has(type1)) || (isDefined(type2) && bounceBlocks.has(type2)))
              ) {
                recordPlayerBounceGrace(player.id, slimeGraceMs);
                limit = config.maxSpeedIce;
              } else if (isIceGraceActive) {
                // Apply ice inertia buffer for jumping off ice
                limit = config.maxSpeedIce;
              }

              // Check Soul Speed boots on soul sand/soil
              const boots = equippable?.getEquipment(mc.EquipmentSlot.Feet);
              if (isDefined(boots)) {
                const enchantable = boots.getComponent(ItemComponentTypes.Enchantable) as
                  mc.ItemEnchantableComponent | undefined;
                if (
                  isDefined(enchantable) &&
                  'hasEnchantment' in enchantable &&
                  enchantable.hasEnchantment(MinecraftEnchantmentTypes.SoulSpeed)
                ) {
                  if (
                    type1 === MinecraftBlockTypes.SoulSand ||
                    type1 === MinecraftBlockTypes.SoulSoil ||
                    type2 === MinecraftBlockTypes.SoulSand ||
                    type2 === MinecraftBlockTypes.SoulSoil
                  ) {
                    limit *= 1.45;
                  }
                }
              }
            } catch {
              // Ignore block read errors (unloaded chunks etc)
            }
          }
        }
      }
    }
  }

  // Token Bucket / Violation Accumulator
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
    !isUnderKnockback &&
    !hasGrace(player.id, flightGraceReasons)
  ) {
    const isOnGround = player.isOnGround === true;
    const isSwimming = player.isSwimming === true;
    const isClimbing = player.isClimbing === true;
    const hasLevitation =
      typeof player.getEffect === 'function' && isDefined(player.getEffect(MinecraftEffectTypes.Levitation));
    const hasSlowFalling =
      typeof player.getEffect === 'function' && isDefined(player.getEffect(MinecraftEffectTypes.SlowFalling));

    let nearGroundOrLiquid = false;
    if (isOnGround || isSwimming || isClimbing || hasLevitation || hasSlowFalling) {
      nearGroundOrLiquid = true;
    } else {
      try {
        const pos = player.location;
        const blockX = Math.floor(pos.x);
        const blockY = Math.floor(pos.y);
        const blockZ = Math.floor(pos.z);
        const dim = player.dimension;

        const b0 = dim.getBlock({ x: blockX, y: blockY, z: blockZ });
        const b1 = dim.getBlock({ x: blockX, y: blockY - 1, z: blockZ });

        if (isSupportedBlock(b0) || isSupportedBlock(b1)) {
          nearGroundOrLiquid = true;
        } else {
          const fracX = pos.x - blockX;
          const fracZ = pos.z - blockZ;
          const offsetX = fracX < 0.3 ? -1 : fracX > 0.7 ? 1 : 0;
          const offsetZ = fracZ < 0.3 ? -1 : fracZ > 0.7 ? 1 : 0;

          if (offsetX !== 0 || offsetZ !== 0) {
            const bEdge = dim.getBlock({ x: blockX + offsetX, y: blockY - 1, z: blockZ + offsetZ });
            if (isSupportedBlock(bEdge)) {
              nearGroundOrLiquid = true;
            }
          }
        }
      } catch {
        nearGroundOrLiquid = true;
      }
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
      if (state.airTicks >= 16) {
        flagManager.flag(
          player,
          'movementCheck',
          `Flight/Hover detected (Air checks: ${state.airTicks}, vY: ${velocity.y.toFixed(2)})`,
        );
        state.airTicks = 10;
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
  }

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

/** Modular movement check registration. */
export const movementCheck: AntiCheatCheck = {
  id: 'movementCheck',
  name: 'Movement & Speed Check',
  category: 'movement',
  description: 'Verifies horizontal speed, flight/hover physics, and invalid sprint states.',
  start: () => startMovementCheckLoop(),
  stop: () => {
    if (isDefined(movementIntervalId)) {
      clearTrackedInterval(movementIntervalId);
      movementIntervalId = undefined;
    }
  },
  clearPlayer: (playerId: string) => clearPlayerMovementState(playerId),
  reset: () => _resetMovementCheckForTest(),
};

checkRegistry.registerCheck(movementCheck);
