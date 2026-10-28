import { getConfig } from '@core/config/configManager.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { getOrCreatePlayer, updatePlayerData } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { getPlayerRank, updatePlayerNameTag } from '@core/permissions/rankManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { frozenTag, vanishedTag } from '@core/utils/constants.js';
import { formatCurrency, formatLocation, formatString } from '@core/utils/index.js';
import { debugLog, infoLog } from '@core/utils/logger.js';
import { sendMessage } from '@core/utils/messaging.js';
import { getKit, giveKitItems } from '@features/economy/kit/manager.js';
import { handleCombatPlayerJoin } from '@features/essentials/combat/manager.js';
import { checkAndKickBannedPlayer } from '@features/moderation/punishmentManager.js';
import { isWatched } from '@features/moderation/watchManager.js';
import { getUnreadMailCount } from '@features/social/mail/manager.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
import { MinecraftEffectTypes } from '@minecraft/vanilla-data';

export function handlePlayerJoin(player: mc.Player) {
  const pData = getOrCreatePlayer(player);
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
    infoLog(`[Add-on] Syncing rank for ${player.name}: ${pData.rankId} -> ${calculatedRank.id}`);
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

  debugLog(`[Add-on] Player ${player.name} joined with rank ${pData.rankId}.`);

  if (checkAndKickBannedPlayer(player)) {
    return;
  }

  if (isWatched(player.id)) {
    for (const staff of getAllPlayersFromCache()) {
      if (staff.isValid && hasPermission(staff, 'group.mod')) {
        staff.sendMessage(`§6[Watchlist] §e${player.name} §7joined the server.`);
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
      sendMessage('§eYour Ender Chest was wiped by an administrator while you were offline.', player);
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

  // Custom Join Message (since RP hides vanilla)
  const joinLeaveConfig = config.playerInfo.customJoinLeave;
  if (joinLeaveConfig.enabled && !player.hasTag(vanishedTag)) {
    const msg = formatString(joinLeaveConfig.joinMessage, { playerName: player.name });
    mc.world.sendMessage(msg);
  }
  if (config.playerInfo.enableWelcomer && config.playerInfo.welcomeMessage) {
    const welcomeMsg = formatString(config.playerInfo.welcomeMessage, {
      playerName: player.name,
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
        `§6[Mail] §eYou have §a${unreadMail}§e unread mail message(s)! Type §a/mail read§e to view them.`,
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
      sendMessage(`§7You died at ${formattedCoords}. Use §e/deathcoords§7 to see it again.`, player);
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
      updatePlayerNameTag(player, getConfig());
    } catch {
      // This can sometimes fail if the player object isn't fully ready.
    }
  }, 1);
}

export function handlePlayerSpawn(event: mc.PlayerSpawnAfterEvent) {
  const { player, initialSpawn } = event;

  if (initialSpawn) {
    handlePlayerJoin(player);
    return;
  }

  const config = getConfig();
  const pData = getOrCreatePlayer(player);

  if (pData.lastDeathLocation && !pData.deathNotificationSent) {
    if (config.playerInfo.enableDeathCoords) {
      const formattedCoords = formatLocation(pData.lastDeathLocation);
      sendMessage(`§7You died at ${formattedCoords}. Use §e/deathcoords§7 to see it again.`, player);
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
