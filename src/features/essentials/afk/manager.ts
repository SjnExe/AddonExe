import { getConfig } from '@core/config/configManager.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import { updatePlayerNameTag } from '@core/permissions/rankManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export interface AfkState {
  since: number;
  reason?: string;
}

const afkPlayers = new Map<string, AfkState>();

export function isPlayerAfk(playerId: string): boolean {
  return afkPlayers.has(playerId);
}

export function getPlayerAfkState(playerId: string): AfkState | undefined {
  return afkPlayers.get(playerId);
}

export function setPlayerAfk(player: mc.Player, enabled: boolean, reason?: string, silent = false): boolean {
  const cfg = getConfig();
  if (!enabled) {
    if (!afkPlayers.has(player.id)) {
      return false;
    }
    afkPlayers.delete(player.id);
    try {
      updatePlayerNameTag(player, cfg);
    } catch {
      // Ignore nametag update error in isolated tests
    }
    if (!silent) {
      if (cfg.afk?.broadcastAfk !== false) {
        mc.world.sendMessage(`§7* ${player.name} is no longer AFK.`);
      } else {
        player.sendMessage('§aYou are no longer marked as AFK.');
      }
    }
    return false;
  }

  if (afkPlayers.has(player.id)) {
    return true;
  }

  const cleanReason = isNonEmptyString(reason?.trim()) ? reason!.trim() : undefined;
  afkPlayers.set(player.id, {
    since: Date.now(),
    ...(isDefined(cleanReason) ? { reason: cleanReason } : {}),
  });

  try {
    updatePlayerNameTag(player, cfg);
  } catch {
    // Ignore nametag update error in isolated tests
  }

  if (!silent) {
    const reasonSuffix = isDefined(cleanReason) ? ` §8(${cleanReason})` : '';
    if (cfg.afk?.broadcastAfk !== false) {
      mc.world.sendMessage(`§7* ${player.name} is now AFK.${reasonSuffix}`);
    } else {
      player.sendMessage(`§eYou are now marked as AFK.${reasonSuffix}`);
    }
  }
  return true;
}

export function togglePlayerAfk(player: mc.Player, reason?: string): boolean {
  const next = !isPlayerAfk(player.id);
  return setPlayerAfk(player, next, reason);
}

export function clearPlayerAfkState(playerId: string): void {
  const existing = afkPlayers.get(playerId);
  if (!isDefined(existing)) {
    return;
  }
  afkPlayers.delete(playerId);
  const player = getPlayerFromCache(playerId);
  if (isDefined(player) && player.isValid) {
    try {
      updatePlayerNameTag(player, getConfig());
    } catch {
      // Ignore
    }
  }
}

export function _clearAfkForTest(): void {
  afkPlayers.clear();
}
