import { getConfig } from '@core/config/configManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { errorLog } from '@core/utils/logger.js';
import { playSound } from '@core/utils/sound.js';
import { getCountdownColor } from '@core/utils/ui.js';
import { getRemainingCombatCooldown } from '@features/essentials/combat/manager.js';
import { setActionBarOverride } from '@features/sidebar/manager.js';
import { isDefined, isNumber } from '@lib/guards.js';
import { Vector3Utils } from '@minecraft/math';
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

const activePlayerWarmups = new Map<string, () => void>();

export function cancelActiveTeleportWarmup(playerId: string): void {
  const cancelExisting = activePlayerWarmups.get(playerId);
  if (isDefined(cancelExisting)) {
    activePlayerWarmups.delete(playerId);
    cancelExisting();
  }
}

export function startTeleportWarmup(
  player: mc.Player,
  durationSeconds: number,
  onWarmupComplete: () => void,
  teleportName = 'teleport',
  onCancel?: () => void,
): void {
  cancelActiveTeleportWarmup(player.id);

  try {
    const cfg = getConfig();
    if (cfg.combat?.enabled !== false && cfg.combat?.blockTeleportInCombat !== false) {
      const combatRem = getRemainingCombatCooldown(player.id);
      if (combatRem > 0 && !hasPermission(player, 'group.admin')) {
        player.sendMessage(`§cYou cannot teleport while in combat! (${combatRem}s remaining)`);
        if (isDefined(onCancel)) {
          onCancel();
        }
        return;
      }
    }
  } catch {
    // Proceed if config not loaded in unit test
  }

  if (durationSeconds <= 0) {
    onWarmupComplete();
    return;
  }

  let remainingSeconds = durationSeconds;
  const initialLocation = { x: player.location.x, y: player.location.y, z: player.location.z };
  const dimensionId = player.dimension.id;
  let intervalId: number | undefined = undefined;
  let hurtListener: ((event: mc.EntityHurtAfterEvent) => void) | undefined = undefined;

  const cleanup = () => {
    activePlayerWarmups.delete(player.id);
    if (isNumber(intervalId)) {
      mc.system.clearRun(intervalId);
      intervalId = undefined;
    }
    if (isDefined(hurtListener)) {
      try {
        if (
          isDefined(mc.world?.afterEvents?.entityHurt) &&
          typeof mc.world.afterEvents.entityHurt.unsubscribe === 'function'
        ) {
          mc.world.afterEvents.entityHurt.unsubscribe(hurtListener);
        }
      } catch {
        // Ignore cleanup errors
      }
      hurtListener = undefined;
    }
  };

  const cancel = () => {
    cleanup();
    if (isDefined(onCancel)) {
      onCancel();
    }
  };

  activePlayerWarmups.set(player.id, cancel);

  hurtListener = (event: mc.EntityHurtAfterEvent) => {
    if (event.hurtEntity.id === player.id) {
      setActionBarOverride(player, '§cTeleport canceled because you took damage.', 3000);
      playSound(player, 'note.bass', { volume: 1, pitch: 0.5 });
      cancel();
    }
  };

  mc.world.afterEvents.entityHurt.subscribe(hurtListener, { entityTypes: [MinecraftEntityTypes.Player] });

  player.sendMessage(`§aTeleporting to ${teleportName} in ${durationSeconds} seconds. Don't move or take damage!`);

  intervalId = mc.system.runInterval(() => {
    try {
      if (!player.isValid) {
        cancel();
        return;
      }
      const currentLocation = player.location;
      const distanceMoved = Vector3Utils.distance(currentLocation, initialLocation);

      if (distanceMoved > 2 || player.dimension.id !== dimensionId) {
        setActionBarOverride(player, '§cTeleport canceled because you moved.', 3000);
        playSound(player, 'note.bass', { volume: 1, pitch: 0.5 });
        cancel();
        return;
      }

      remainingSeconds--;

      if (remainingSeconds > 0) {
        const color = getCountdownColor(remainingSeconds);
        setActionBarOverride(player, `${color}Teleporting in ${remainingSeconds}...`, 1100);

        const pitch = 0.5 + 1.5 * (1 - remainingSeconds / durationSeconds);
        playSound(player, 'note.pling', { volume: 0.5, pitch });
      } else {
        setActionBarOverride(player, '§aTeleporting...', 2000);
        playSound(player, 'random.levelup', { volume: 0.5, pitch: 1 });
        cleanup();
        onWarmupComplete();
      }
    } catch (error: unknown) {
      errorLog(`[Warmup] Error during warmup interval for ${player.name}: ${String(error)}`);
      cancel();
    }
  }, 20);
}
