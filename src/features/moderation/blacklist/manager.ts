import { getItemBlacklistConfig } from '@core/config/configurations.js';
import { registerDataSaver } from '@core/data/dataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { getPlayerRank } from '@core/permissions/rankManager.js';
import { normalizeNamespace } from '@core/utils/index.js';
import { warnLog } from '@core/utils/logger.js';
import { setTrackedInterval } from '@core/utils/timerManager.js';
import { isDefined } from '@lib/guards.js';
import { EntityComponentTypes, world } from '@minecraft/server';
import * as mc from '@minecraft/server';

import { BlacklistAuditEntry } from './types.js';

const storage = new StorageManager('exe:logs:blacklist');
const maxAuditLogs = 100;
let auditLogs: BlacklistAuditEntry[] = [];
let isInitialized = false;

let cachedItemsRef: string[] | undefined;
let cachedNormalizedSet = new Set<string>();

let isAuditDirty = false;
let isAuditSaveScheduled = false;

const equipmentSlots = [
  mc.EquipmentSlot.Head,
  mc.EquipmentSlot.Chest,
  mc.EquipmentSlot.Legs,
  mc.EquipmentSlot.Feet,
  mc.EquipmentSlot.Offhand,
] as const;

/**
 * Normalizes an item identifier to ensure it includes the vanilla namespace prefix.
 *
 * @param id Raw item identifier.
 * @returns Fully qualified item type identifier.
 */
function normalizeId(id: string): string {
  return normalizeNamespace(id);
}

/**
 * Returns a cached set of normalized prohibited item identifiers.
 *
 * @param items Array of configured prohibited item identifiers.
 * @returns Set of normalized identifiers for O(1) membership lookups.
 */
function getNormalizedBlacklistSet(items: string[]): Set<string> {
  if (items !== cachedItemsRef) {
    cachedItemsRef = items;
    cachedNormalizedSet = new Set(items.map(normalizeId));
  }
  return cachedNormalizedSet;
}

/** Loads persisted blacklist audit log entries from storage into memory. */
function loadAuditLogs(): void {
  const loaded = storage.load<BlacklistAuditEntry[]>();
  auditLogs = Array.isArray(loaded) ? loaded : [];
}

/** Persists current audit log entries to dynamic property storage. */
function saveAuditLogs(): void {
  try {
    storage.save(auditLogs);
  } catch {
    // Ignore storage save failure in mock or early execution
  }
}

/** Schedules a debounced dynamic property write for audit logs. */
function scheduleAuditSave(): void {
  isAuditDirty = true;
  if (isAuditSaveScheduled) {
    return;
  }
  isAuditSaveScheduled = true;
  mc.system.runTimeout(() => {
    isAuditSaveScheduled = false;
    if (isAuditDirty) {
      isAuditDirty = false;
      saveAuditLogs();
    }
  }, 20);
}

/**
 * Returns a copy of recent prohibited item audit log records.
 *
 * @returns Array of audit log entries.
 */
export function getBlacklistAuditLogs(): BlacklistAuditEntry[] {
  return [...auditLogs];
}

/** Clears stored prohibited item audit logs. */
export function clearBlacklistAuditLogs(): void {
  auditLogs = [];
  isAuditDirty = false;
  saveAuditLogs();
}

/**
 * Evaluates whether an item type identifier matches any prohibited entry on the server blacklist.
 *
 * @param typeId Minecraft item type identifier (e.g. 'minecraft:bedrock').
 * @returns True if the item is blacklisted and the system is enabled.
 */
export function isItemBlacklisted(typeId: string): boolean {
  const config = getItemBlacklistConfig();
  if (!config.enabled) {
    return false;
  }
  const cleanId = normalizeId(typeId);
  return getNormalizedBlacklistSet(config.blacklistedItems).has(cleanId);
}

/**
 * Determines whether a player is authorized to possess or utilize blacklisted items.
 *
 * @param player Target player to check.
 * @returns True if the player has bypass permission or an exempt rank.
 */
export function canBypassItemBlacklist(player: mc.Player): boolean {
  if (hasPermission(player, 'cmd.blacklist.bypass') || hasPermission(player, 'ui.panel.owner')) {
    return true;
  }
  const config = getItemBlacklistConfig();
  const rank = getPlayerRank(player);
  if (isDefined(rank) && config.exemptRanks.includes(rank.id)) {
    return true;
  }
  return false;
}

/**
 * Enforces server policy against an unauthorized player possessing or using a blacklisted item. Implements a 3-tier
 * logging architecture (Staff in-game broadcast, persistent storage, console warning).
 *
 * @param player Offending player.
 * @param item ItemStack that triggered the infraction.
 * @param trigger Context description of the event ('use', 'place', 'held', 'interact').
 * @param slot Optional inventory slot index containing the prohibited item.
 */
export function handleProhibitedItem(player: mc.Player, item: mc.ItemStack, trigger: string, slot?: number): void {
  if (!player.isValid) {
    return;
  }

  const config = getItemBlacklistConfig();
  const typeId = item.typeId;

  // 1. Staff Broadcast Alert
  if (config.broadcastToStaff) {
    for (const onlinePlayer of world.getAllPlayers()) {
      if (
        onlinePlayer.isValid &&
        onlinePlayer.id !== player.id &&
        (hasPermission(onlinePlayer, 'cmd.notify') || hasPermission(onlinePlayer, 'ui.panel.admin'))
      ) {
        onlinePlayer.sendMessage(
          `§c[Blacklist Alert] §e${player.name} §7attempted to use prohibited item §c${typeId} §7(${trigger}).`,
        );
      }
    }
  }

  // 2. Persistent Storage Log
  if (config.persistToLog) {
    const entry: BlacklistAuditEntry = {
      timestamp: Date.now(),
      playerName: player.name,
      playerId: player.id,
      itemTypeId: typeId,
      trigger,
      action: config.action,
    };
    auditLogs.unshift(entry);
    if (auditLogs.length > maxAuditLogs) {
      auditLogs = auditLogs.slice(0, maxAuditLogs);
    }
    scheduleAuditSave();
  }

  // 3. Console Warning Log
  if (config.logToConsole) {
    warnLog(
      `[ItemBlacklist] Infraction by ${player.name} (${player.id}) using ${typeId} [Trigger: ${trigger}, Action: ${config.action}]`,
    );
  }

  // Policy Enforcement Action
  if (config.action === 'confiscate') {
    const invComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    const container = invComp?.container;
    if (isDefined(container)) {
      if (slot !== undefined && slot >= 0 && slot < container.size) {
        container.setItem(slot, undefined);
      } else {
        // Scan and confiscate matching items
        for (let i = 0; i < container.size; i++) {
          const slotItem = container.getItem(i);
          if (isDefined(slotItem) && isItemBlacklisted(slotItem.typeId)) {
            container.setItem(i, undefined);
          }
        }
      }
    }
    player.sendMessage(`§c[Blacklist] The prohibited item §4${typeId}§c was confiscated.`);
  } else {
    player.sendMessage(`§c[Blacklist] You are not permitted to use §4${typeId}§c.`);
  }
}

/**
 * Scans a player's inventory and equipped gear for prohibited items and enforces confiscation if active.
 *
 * @param player Target player to scan.
 */
export function scanPlayerInventory(player: mc.Player): void {
  if (!player.isValid) {
    return;
  }

  const config = getItemBlacklistConfig();
  // Return immediately if action is not confiscate, avoiding repeated spam in cancel mode
  if (config.action !== 'confiscate') {
    return;
  }

  const invComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
  const container = invComp?.container;
  const equipComp = player.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;

  let hasProhibited = false;
  if (isDefined(container)) {
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (isDefined(item) && isItemBlacklisted(item.typeId)) {
        hasProhibited = true;
        break;
      }
    }
  }

  if (!hasProhibited && isDefined(equipComp)) {
    for (const slot of equipmentSlots) {
      const eqItem = equipComp.getEquipment(slot);
      if (isDefined(eqItem) && isItemBlacklisted(eqItem.typeId)) {
        hasProhibited = true;
        break;
      }
    }
  }

  if (!hasProhibited) {
    return;
  }

  // Found prohibited item, verify bypass permission before taking action
  if (canBypassItemBlacklist(player)) {
    return;
  }

  const confiscatedMatches: { item: mc.ItemStack; trigger: string }[] = [];

  if (isDefined(container)) {
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (isDefined(item) && isItemBlacklisted(item.typeId)) {
        container.setItem(i, undefined);
        confiscatedMatches.push({ item, trigger: 'held' });
      }
    }
  }

  if (isDefined(equipComp)) {
    for (const slot of equipmentSlots) {
      const eqItem = equipComp.getEquipment(slot);
      if (isDefined(eqItem) && isItemBlacklisted(eqItem.typeId)) {
        equipComp.setEquipment(slot, undefined);
        confiscatedMatches.push({ item: eqItem, trigger: 'equipped' });
      }
    }
  }

  if (confiscatedMatches.length === 0) {
    return;
  }

  // 1. Staff Broadcast Alert (single batched message)
  if (config.broadcastToStaff) {
    const itemNames = Array.from(new Set(confiscatedMatches.map((m) => m.item.typeId))).join(', ');
    const totalCount = confiscatedMatches.reduce((acc, m) => acc + m.item.amount, 0);
    for (const onlinePlayer of world.getAllPlayers()) {
      if (
        onlinePlayer.isValid &&
        onlinePlayer.id !== player.id &&
        (hasPermission(onlinePlayer, 'cmd.notify') || hasPermission(onlinePlayer, 'ui.panel.admin'))
      ) {
        onlinePlayer.sendMessage(
          `§c[Blacklist Alert] §e${player.name} §7had §c${totalCount}x prohibited item(s) (${itemNames}) §7confiscated.`,
        );
      }
    }
  }

  // 2. Persistent Storage Log (every item preserved)
  if (config.persistToLog) {
    for (const match of confiscatedMatches) {
      auditLogs.unshift({
        timestamp: Date.now(),
        playerName: player.name,
        playerId: player.id,
        itemTypeId: match.item.typeId,
        trigger: match.trigger,
        action: config.action,
      });
    }
    if (auditLogs.length > maxAuditLogs) {
      auditLogs = auditLogs.slice(0, maxAuditLogs);
    }
    scheduleAuditSave();
  }

  // 3. Console Warning Log
  if (config.logToConsole) {
    for (const match of confiscatedMatches) {
      warnLog(
        `[ItemBlacklist] Infraction by ${player.name} (${player.id}) using ${match.item.typeId} [Trigger: ${match.trigger}, Action: ${config.action}]`,
      );
    }
  }

  // Player notification
  const uniqueNames = Array.from(new Set(confiscatedMatches.map((m) => m.item.typeId))).join(', ');
  player.sendMessage(`§c[Blacklist] The prohibited item(s) §4${uniqueNames}§c were confiscated.`);
}

let isScanJobRunning = false;

/**
 * Generator that scans each online player's inventory and yields between players to spread native calls across server
 * ticks.
 */
function* scanAllPlayersJob(): Generator<void, void, void> {
  try {
    for (const player of world.getAllPlayers()) {
      if (player.isValid) {
        scanPlayerInventory(player);
      }
      yield;
    }
  } finally {
    isScanJobRunning = false;
  }
}

/** Initializes the item blacklist enforcement listeners and background scanner task. */
export function initializeItemBlacklist(): void {
  if (isInitialized) {
    return;
  }
  isInitialized = true;
  loadAuditLogs();

  registerDataSaver(() => {
    if (isAuditDirty) {
      isAuditDirty = false;
      saveAuditLogs();
    }
  });

  // Intercept item activation
  world.beforeEvents.itemUse.subscribe((event) => {
    const { source, itemStack } = event;
    if (isDefined(source) && isDefined(itemStack) && source.isValid && isItemBlacklisted(itemStack.typeId)) {
      if (!canBypassItemBlacklist(source)) {
        event.cancel = true;
        mc.system.run(() => {
          if (source.isValid) {
            handleProhibitedItem(source, itemStack, 'itemUse');
          }
        });
      }
    }
  });

  // Intercept block interactions using prohibited items
  world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { player, itemStack } = event;
    if (isDefined(player) && isDefined(itemStack) && player.isValid && isItemBlacklisted(itemStack.typeId)) {
      if (!canBypassItemBlacklist(player)) {
        event.cancel = true;
        mc.system.run(() => {
          if (player.isValid) {
            handleProhibitedItem(player, itemStack, 'playerInteractWithBlock');
          }
        });
      }
    }
  });

  // Periodic passive inventory scan across online players (every 60 ticks = 3s)
  setTrackedInterval(() => {
    const config = getItemBlacklistConfig();
    if (!config.enabled || config.action !== 'confiscate' || isScanJobRunning) {
      return;
    }
    isScanJobRunning = true;
    mc.system.runJob(scanAllPlayersJob());
  }, 60);
}

/** Resets the module initialization state for isolated test execution. */
export function _resetBlacklistInitializationForTest(): void {
  isInitialized = false;
}
