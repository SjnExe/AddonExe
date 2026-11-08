import { getConfig } from '@core/config/configManager.js';
import { deserializeItem } from '@core/data/itemSerializer.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { getOrCreatePlayer, type PlayerData, updatePlayerData } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { getPlayerRank, updatePlayerNameTag } from '@core/permissions/rankManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { diagnosticBotName, frozenTag, vanishedTag } from '@core/utils/constants.js';
import { formatCurrency, formatLocation, formatString } from '@core/utils/index.js';
import { debugLog, errorLog, infoLog } from '@core/utils/logger.js';
import { sendMessage } from '@core/utils/messaging.js';
import { getKit, giveKitItems } from '@features/economy/kit/manager.js';
import { handleCombatPlayerJoin } from '@features/essentials/combat/manager.js';
import { checkAndKickBannedPlayer } from '@features/moderation/punishmentManager.js';
import { isWatched } from '@features/moderation/watchManager.js';
import { getUnreadMailCount } from '@features/social/mail/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
import { MinecraftEffectTypes } from '@minecraft/vanilla-data';

/**
 * Handles core player joining lifecycle: synchronizes rank, applies pending offline actions, restores pending inventory
 * syncs, re-applies moderation freeze, and announces join messages.
 *
 * @param player Newly connected player.
 */
export function handlePlayerJoin(player: mc.Player) {
  if (player.isValid === false) {
    return;
  }
  let pData: PlayerData;
  try {
    pData = getOrCreatePlayer(player);
  } catch (err: unknown) {
    debugLog(`[PlayerJoin] Skipped player initialization: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  const config = getConfig();

  // Sync Rank from Manager to PlayerData
  // This ensures that if a player is Owner in config or has a rank tag,
  // their internal permission data is updated immediately.
  const calculatedRank = getPlayerRank(player, config);
  if (calculatedRank.id === 'owner') {
    mc.world.setDynamicProperty('exe:ownerId', player.id);
  } else if (mc.world.getDynamicProperty('exe:ownerId') === undefined) {
    sendMessage('§6[AddonExe] §eNo Server Owner is set yet! Run §a/function owner§e to claim Server Owner.', player);
  }
  if (pData.rankId !== calculatedRank.id) {
    infoLog(`[Add-on] Syncing rank for ${pData.name}: ${pData.rankId} -> ${calculatedRank.id}`);
    updatePlayerData(player.id, (d) => {
      d.rankId = calculatedRank.id;
    });
  }

  // Sync vanish state from tag
  if (player.hasTag(vanishedTag)) {
    updatePlayerData(player.id, (d) => {
      d.isVanished = true;
    });
    // Re-apply invisibility effect if player died or effect expired
    player.addEffect(MinecraftEffectTypes.Invisibility, 2_000_000, { amplifier: 1, showParticles: false });
  } else {
    if (pData.isVanished) {
      updatePlayerData(player.id, (d) => {
        d.isVanished = false;
      });
    }
  }

  debugLog(`[Add-on] Player ${pData.name} joined with rank ${pData.rankId}.`);

  if (checkAndKickBannedPlayer(player)) {
    return;
  }

  if (isWatched(player.id)) {
    for (const staff of getAllPlayersFromCache()) {
      if (staff.isValid && hasPermission(staff, 'group.mod')) {
        staff.sendMessage(`§6[Watchlist] §e${pData.name}§r §7joined the server.§r`);
      }
    }
  }

  handleCombatPlayerJoin(player);

  if (pData.pendingInventoryClear === true) {
    try {
      const inv = (player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)
        ?.container;
      inv?.clearAll();
      const eq = player.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;
      if (eq) {
        for (const s of [
          mc.EquipmentSlot.Head,
          mc.EquipmentSlot.Chest,
          mc.EquipmentSlot.Legs,
          mc.EquipmentSlot.Feet,
          mc.EquipmentSlot.Offhand,
        ]) {
          eq.setEquipment(s, undefined);
        }
      }
      updatePlayerData(player.id, (d) => {
        d.pendingInventoryClear = false;
        d.offlineInventory = {};
        d.offlineEquipment = {};
      });
      pData.pendingInventoryClear = false;
      sendMessage('§eYour inventory was cleared by an administrator while you were offline.', player);
    } catch {
      // Ignore
    }
  }

  if (pData.pendingEnderChestWipe === true) {
    try {
      const ec = (
        player.getComponent(EntityComponentTypes.EnderInventory) as mc.EntityEnderInventoryComponent | undefined
      )?.container;
      ec?.clearAll();
      updatePlayerData(player.id, (d) => {
        d.pendingEnderChestWipe = false;
        d.offlineEnderChest = {};
      });
      pData.pendingEnderChestWipe = false;
      sendMessage('§eYour Ender Chest was wiped by an administrator while you were offline.', player);
    } catch {
      // Ignore
    }
  }

  if (pData.pendingOfflineInventorySync === true) {
    try {
      let appliedAny = false;
      const hasSlotMods =
        isDefined(pData.pendingOfflineInventoryModifications) || isDefined(pData.pendingOfflineEquipmentModifications);
      const invComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
      const inv = invComp?.container;
      if (isDefined(inv)) {
        if (isDefined(pData.pendingOfflineInventoryModifications)) {
          for (const [slotStr, mod] of Object.entries(pData.pendingOfflineInventoryModifications)) {
            const slot = Number(slotStr);
            if (slot >= 0 && slot < inv.size) {
              if (mod === null) {
                inv.setItem(slot, undefined);
                delete pData.pendingOfflineInventoryModifications[slot];
                appliedAny = true;
              } else {
                const stack = deserializeItem(mod);
                if (isDefined(stack)) {
                  inv.setItem(slot, stack);
                  delete pData.pendingOfflineInventoryModifications[slot];
                  appliedAny = true;
                } else {
                  errorLog(`[OfflineSync] Failed to deserialize pending inventory modification for slot ${slotStr}.`);
                }
              }
            }
          }
        } else if (!hasSlotMods && isDefined(pData.offlineInventory)) {
          for (let i = 0; i < inv.size; i++) {
            const item = pData.offlineInventory[i];
            const stack = isDefined(item) ? deserializeItem(item) : undefined;
            inv.setItem(i, stack);
            appliedAny = true;
          }
        }
      }
      const eq = player.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;
      if (isDefined(eq)) {
        if (isDefined(pData.pendingOfflineEquipmentModifications)) {
          for (const [slotKey, mod] of Object.entries(pData.pendingOfflineEquipmentModifications)) {
            const eqSlot = slotKey as mc.EquipmentSlot;
            if (mod === null) {
              eq.setEquipment(eqSlot, undefined);
              delete pData.pendingOfflineEquipmentModifications[eqSlot];
              appliedAny = true;
            } else if (isDefined(mod)) {
              const stack = deserializeItem(mod);
              if (isDefined(stack)) {
                eq.setEquipment(eqSlot, stack);
                delete pData.pendingOfflineEquipmentModifications[eqSlot];
                appliedAny = true;
              } else {
                errorLog(`[OfflineSync] Failed to deserialize pending equipment modification for slot ${slotKey}.`);
              }
            }
          }
        } else if (!hasSlotMods && isDefined(pData.offlineEquipment)) {
          const eqSlots = [
            mc.EquipmentSlot.Head,
            mc.EquipmentSlot.Chest,
            mc.EquipmentSlot.Legs,
            mc.EquipmentSlot.Feet,
            mc.EquipmentSlot.Offhand,
          ];
          for (const slot of eqSlots) {
            const item = pData.offlineEquipment[slot];
            const stack = isDefined(item) ? deserializeItem(item) : undefined;
            eq.setEquipment(slot, stack);
            appliedAny = true;
          }
        }
      }
      updatePlayerData(player.id, (d) => {
        if (isDefined(pData.pendingOfflineInventoryModifications)) {
          if (Object.keys(pData.pendingOfflineInventoryModifications).length === 0) {
            delete d.pendingOfflineInventoryModifications;
          } else {
            d.pendingOfflineInventoryModifications = pData.pendingOfflineInventoryModifications;
          }
        }
        if (isDefined(pData.pendingOfflineEquipmentModifications)) {
          if (Object.keys(pData.pendingOfflineEquipmentModifications).length === 0) {
            delete d.pendingOfflineEquipmentModifications;
          } else {
            d.pendingOfflineEquipmentModifications = pData.pendingOfflineEquipmentModifications;
          }
        }
        if (!isDefined(d.pendingOfflineInventoryModifications) && !isDefined(d.pendingOfflineEquipmentModifications)) {
          d.pendingOfflineInventorySync = false;
        }
      });
      if (appliedAny) {
        sendMessage('§eYour inventory was updated by an administrator while you were offline.', player);
      }
    } catch {
      // Ignore
    }
  }

  if (pData.pendingOfflineEnderChestSync === true) {
    try {
      let appliedAny = false;
      const ecComp = player.getComponent(EntityComponentTypes.EnderInventory) as
        mc.EntityEnderInventoryComponent | undefined;
      const ec = ecComp?.container;
      if (isDefined(ec)) {
        if (isDefined(pData.pendingOfflineEnderChestModifications)) {
          for (const [slotStr, mod] of Object.entries(pData.pendingOfflineEnderChestModifications)) {
            const slot = Number(slotStr);
            if (slot >= 0 && slot < ec.size) {
              if (mod === null) {
                ec.setItem(slot, undefined);
                delete pData.pendingOfflineEnderChestModifications[slot];
                appliedAny = true;
              } else {
                const stack = deserializeItem(mod);
                if (isDefined(stack)) {
                  ec.setItem(slot, stack);
                  delete pData.pendingOfflineEnderChestModifications[slot];
                  appliedAny = true;
                } else {
                  errorLog(`[OfflineSync] Failed to deserialize pending Ender Chest modification for slot ${slotStr}.`);
                }
              }
            }
          }
        } else if (isDefined(pData.offlineEnderChest)) {
          for (let i = 0; i < ec.size; i++) {
            const item = pData.offlineEnderChest[i];
            const stack = isDefined(item) ? deserializeItem(item) : undefined;
            ec.setItem(i, stack);
            appliedAny = true;
          }
        }
      }
      updatePlayerData(player.id, (d) => {
        if (isDefined(pData.pendingOfflineEnderChestModifications)) {
          if (Object.keys(pData.pendingOfflineEnderChestModifications).length === 0) {
            delete d.pendingOfflineEnderChestModifications;
            d.pendingOfflineEnderChestSync = false;
          } else {
            d.pendingOfflineEnderChestModifications = pData.pendingOfflineEnderChestModifications;
          }
        } else {
          d.pendingOfflineEnderChestSync = false;
        }
      });
      if (appliedAny) {
        sendMessage('§eYour Ender Chest was updated by an administrator while you were offline.', player);
      }
    } catch {
      // Ignore
    }
  }

  // Re-apply freeze if needed
  if (player.hasTag(frozenTag)) {
    player.inputPermissions.setPermissionCategory(mc.InputPermissionCategory.Camera, false);
    player.inputPermissions.setPermissionCategory(mc.InputPermissionCategory.Movement, false);
    player.addEffect(MinecraftEffectTypes.Resistance, 20_000_000, { amplifier: 255, showParticles: false });
    player.addEffect(MinecraftEffectTypes.Weakness, 20_000_000, { amplifier: 255, showParticles: false });
    sendMessage('§cYou are currently frozen.', player);
  }

  // Core Custom Join Message (RP hides vanilla join/leave across locales)
  let playerName = '';
  try {
    playerName = player.name;
  } catch {
    // Player invalidated concurrently
  }
  const joinLeaveConfig = config.playerInfo.customJoinLeave;
  if (
    playerName &&
    playerName !== diagnosticBotName &&
    !player.hasTag(vanishedTag) &&
    isNonEmptyString(joinLeaveConfig?.joinMessage)
  ) {
    const msg = formatString(joinLeaveConfig.joinMessage, { playerName });
    mc.world.sendMessage(msg);
  }
  if (
    playerName &&
    playerName !== diagnosticBotName &&
    config.playerInfo.enableWelcomer &&
    config.playerInfo.welcomeMessage
  ) {
    const welcomeMsg = formatString(config.playerInfo.welcomeMessage, {
      playerName,
      serverName: config.serverName || 'Server',
      discordLink: config.serverInfo.discordLink || '',
      websiteLink: config.serverInfo.websiteLink || '',
    });

    sendMessage(welcomeMsg, player);
  }

  if (config.mail?.enabled) {
    const unreadMail = getUnreadMailCount(player.id);
    if (unreadMail > 0) {
      sendMessage(
        `§6[Mail] §eYou have §a${unreadMail}§e unread mail message(s)! Type §a/mail read§e to view them.§r`,
        player,
      );
    }
  }

  if (pData.mailbox && pData.mailbox.length > 0) {
    sendMessage(
      `§e[Auction House] You have §a${pData.mailbox.length}§e unclaimed item stack(s) in your Collection Bin! Use §a/ah collect§e to claim them.`,
      player,
    );
  }

  if (pData.lastDeathLocation && !pData.deathNotificationSent) {
    if (config.playerInfo.enableDeathCoords) {
      const formattedCoords = formatLocation(pData.lastDeathLocation);
      sendMessage(`§7You died at ${formattedCoords}. Use §e/deathcoords§7 to see it again.§r`, player);
    }
    pData.deathNotificationSent = true;
  }

  // Starter Kit Logic
  if (config.kits.starterKit.enabled && !pData.starterKitClaimed) {
    // Only give to strictly new players (joined within last minute)
    // If older, we mark as claimed to prevent future issues.
    if (pData.totalPlayTime < 60_000) {
      const kitName = config.kits.starterKit.kitName;
      const kit = getKit(kitName);
      if (kit) {
        try {
          giveKitItems(player, kit.items);
          player.sendMessage(`§aWelcome! You have received the '${kitName}' starter kit.`);
        } catch {
          // Ignore errors (e.g. invalid items)
        }
      }
    }
    // Mark as claimed for everyone so this logic only runs once per player
    updatePlayerData(player.id, (d) => {
      d.starterKitClaimed = true;
    });
  }

  mc.system.runTimeout(() => {
    try {
      if (player.isValid !== false) {
        updatePlayerNameTag(player, getConfig());
      }
    } catch {
      // This can sometimes fail if the player object isn't fully ready.
    }
  }, 1);
}

/**
 * Handles player spawn events, differentiating initial session joins from subsequent respawns, restoring nametags, and
 * dispatching death coordinate notifications.
 *
 * @param event Player spawn event data from Minecraft Bedrock.
 */
export function handlePlayerSpawn(event: mc.PlayerSpawnAfterEvent) {
  const { player, initialSpawn } = event;

  if (player.isValid === false) {
    return;
  }

  if (initialSpawn) {
    handlePlayerJoin(player);
    return;
  }

  const config = getConfig();
  let pData: PlayerData;
  try {
    pData = getOrCreatePlayer(player);
  } catch {
    return;
  }

  mc.system.runTimeout(() => {
    try {
      if (player.isValid !== false) {
        updatePlayerNameTag(player, config);
      }
    } catch {
      // Ignore
    }
  }, 1);

  if (pData.lastDeathLocation && !pData.deathNotificationSent) {
    if (config.playerInfo.enableDeathCoords) {
      const formattedCoords = formatLocation(pData.lastDeathLocation);
      sendMessage(`§7You died at ${formattedCoords}. Use §e/deathcoords§7 to see it again.§r`, player);
    }
    updatePlayerData(player.id, (d) => {
      d.deathNotificationSent = true;
    });
  }

  if (config.back?.enabled && config.back?.saveOnDeath && pData.lastLocation) {
    const cost = Number(config.back.cost ?? 0);
    const hasCost = isFeatureActive('eco') && cost > 0;
    const costSuffix = hasCost ? ` §6(Cost: ${formatCurrency(cost)})§7` : '';
    sendMessage(`§7Use §e/back§7 to return to your death location${costSuffix}.`, player);
  }
}
