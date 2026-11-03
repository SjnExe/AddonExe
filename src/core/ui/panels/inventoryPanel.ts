import { deserializeItem, serializeItem } from '@core/data/itemSerializer.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import { getPlayerNameById, loadPlayerData, updatePlayerData } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { canTarget } from '@core/permissions/rankManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import { resolveTradeItemDisplayName, resolveTradeItemIcon } from '@features/economy/tradeUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

function canModifyTargetInventory(staff: mc.Player, targetPlayerId: string): boolean {
  if (!hasPermission(staff, 'ui.panel.admin') && !hasPermission(staff, 'cmd.clear.admin')) {
    return false;
  }
  if (staff.id === targetPlayerId) {
    return true;
  }
  return canTarget(staff, targetPlayerId);
}

async function showSlotActionPanel(
  staff: mc.Player,
  targetPlayerId: string,
  mode: 'inventory' | 'enderchest' | 'equipment',
  slotKey: number | mc.EquipmentSlot,
  returnPage: number = 1,
): Promise<void> {
  const targetName = getPlayerNameById(targetPlayerId) || targetPlayerId;
  const targetPlayer = getPlayerFromCache(targetPlayerId);

  const reopenParent = async () => {
    if (mode === 'enderchest') {
      await showEnderChestPanel(staff, targetPlayerId);
    } else {
      await showInventoryPanel(staff, targetPlayerId, returnPage);
    }
  };

  if (!isDefined(targetPlayer) || !targetPlayer.isValid) {
    staff.sendMessage(`§cPlayer ${targetName} is no longer online.`);
    await reopenParent();
    return;
  }

  let currentItem: mc.ItemStack | undefined;
  let setSlotItem: (newItem?: mc.ItemStack) => void = () => {};
  let readSlotItem: () => mc.ItemStack | undefined = () => undefined;

  if (mode === 'equipment') {
    const equipComp = targetPlayer.getComponent(EntityComponentTypes.Equippable) as
      mc.EntityEquippableComponent | undefined;
    const eqSlot = slotKey as mc.EquipmentSlot;
    currentItem = equipComp?.getEquipment(eqSlot);
    setSlotItem = (newItem) => equipComp?.setEquipment(eqSlot, newItem);
    readSlotItem = () => equipComp?.getEquipment(eqSlot);
  } else {
    const compId = mode === 'enderchest' ? EntityComponentTypes.EnderInventory : EntityComponentTypes.Inventory;
    const container = (
      targetPlayer.getComponent(compId) as mc.EntityInventoryComponent | mc.EntityEnderInventoryComponent | undefined
    )?.container;
    const idx = slotKey as number;
    currentItem = container?.getItem(idx);
    setSlotItem = (newItem) => container?.setItem(idx, newItem);
    readSlotItem = () => container?.getItem(idx);
  }

  if (!isDefined(currentItem)) {
    staff.sendMessage('§eThat slot is now empty.');
    await reopenParent();
    return;
  }

  const displayName = isNonEmptyString(currentItem.nameTag)
    ? currentItem.nameTag
    : resolveTradeItemDisplayName(currentItem.typeId);
  const lore = currentItem.getLore();
  const canEdit = canModifyTargetInventory(staff, targetPlayerId);

  const details: string[] = [
    `§7Target: §f${targetName}`,
    `§7Slot: §e${String(slotKey)} (${mode})`,
    `§7Item: §b${displayName} §7(${currentItem.typeId})`,
    `§7Amount: §ex${currentItem.amount} §8/ ${currentItem.maxAmount}`,
  ];
  if (lore.length > 0) {
    details.push(`§7Lore: §d${lore.join(' | ')}`);
  }

  const form = new ActionFormBuilder()
    .title(`Slot ${String(slotKey)}: ${displayName}`)
    .body(details.join('\n'))
    .button('§bClone Copy to My Inventory', 'textures/ui/copy', async () => {
      const myInv = (staff.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)
        ?.container;
      if (isDefined(myInv) && isDefined(currentItem)) {
        const leftover = myInv.addItem(currentItem.clone());
        if (isDefined(leftover)) {
          staff.sendMessage('§cYour inventory is full.');
        } else {
          staff.sendMessage(`§aCloned ${displayName} x${currentItem.amount} to your inventory.`);
        }
      }
      await reopenParent();
    });

  if (canEdit) {
    form.button('§6Confiscate (Move to My Inventory)', 'textures/ui/icon_recipe_equipment', async () => {
      const myInv = (staff.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)
        ?.container;
      if (!isDefined(myInv) || myInv.emptySlotsCount === 0) {
        staff.sendMessage('§cYou need at least 1 empty slot in your inventory to confiscate this item.');
        await reopenParent();
        return;
      }
      const liveItem = readSlotItem();
      if (!isDefined(liveItem) || liveItem.typeId !== currentItem.typeId || liveItem.amount !== currentItem.amount) {
        staff.sendMessage('§eThat slot changed. Reopening the panel.');
        await reopenParent();
        return;
      }
      const cloned = liveItem.clone();
      setSlotItem(undefined);
      myInv.addItem(cloned);
      staff.sendMessage(`§aConfiscated ${displayName} x${cloned.amount} from ${targetName}.`);
      await reopenParent();
    });

    if (currentItem.maxAmount > 1) {
      form.button('§eEdit Stack Quantity', 'textures/ui/book_edit_default', async () => {
        const modal = new CustomFormBuilder<{ qty: string }>(`Edit Quantity: ${displayName}`)
          .textField(
            'qty',
            `New Amount (1 - ${currentItem.maxAmount}, or 0 to delete)`,
            String(currentItem.amount),
            String(currentItem.amount),
          )
          .submitButton('Save Quantity');
        const res = await modal.show(staff);
        if (res) {
          const liveItem = readSlotItem();
          if (!isDefined(liveItem) || liveItem.typeId !== currentItem.typeId) {
            staff.sendMessage('§eThat slot changed. Reopening the panel.');
            await reopenParent();
            return;
          }
          const parsed = Number.parseInt(res.qty, 10);
          if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= currentItem.maxAmount) {
            if (parsed === 0) {
              setSlotItem(undefined);
              staff.sendMessage(`§aRemoved ${displayName} from ${targetName}.`);
            } else {
              const updated = liveItem.clone();
              updated.amount = parsed;
              setSlotItem(updated);
              staff.sendMessage(`§aUpdated ${displayName} quantity to ${parsed}.`);
            }
          } else {
            staff.sendMessage('§cInvalid stack amount.');
          }
        }
        await reopenParent();
      });
    }

    form.button('§4Delete Item From Slot', 'textures/ui/trash', async () => {
      const liveItem = readSlotItem();
      if (!isDefined(liveItem) || liveItem.typeId !== currentItem.typeId) {
        staff.sendMessage('§eThat slot changed. Reopening the panel.');
        await reopenParent();
        return;
      }
      setSlotItem(undefined);
      staff.sendMessage(`§aDeleted ${displayName} from ${targetName}'s ${mode}.`);
      await reopenParent();
    });
  }

  form.addBackButton(reopenParent);
  await form.show(staff);
}

/**
 * Displays an action panel for a specific item slot in an offline player's saved container snapshot.
 *
 * @param staff Staff member inspecting the item.
 * @param targetPlayerId Unique identifier of the offline target.
 * @param mode Target container category ('inventory' | 'equipment' | 'enderchest').
 * @param slotKey Slot index or equipment slot key.
 * @param returnPage Page number to return to when navigating back.
 */
async function showOfflineSlotActionPanel(
  staff: mc.Player,
  targetPlayerId: string,
  mode: 'inventory' | 'equipment' | 'enderchest',
  slotKey: number | string,
  returnPage: number = 1,
): Promise<void> {
  const targetName = getPlayerNameById(targetPlayerId) || targetPlayerId;
  const offlineData = loadPlayerData(targetPlayerId);

  const reopenParent = async () => {
    if (mode === 'enderchest') {
      await showEnderChestPanel(staff, targetPlayerId);
    } else {
      await showInventoryPanel(staff, targetPlayerId, returnPage);
    }
  };

  if (!isDefined(offlineData)) {
    staff.sendMessage(`§cCould not load offline data for ${targetName}.`);
    await reopenParent();
    return;
  }

  let currentItem: ReturnType<typeof deserializeItem> | undefined;
  const rawItem =
    mode === 'equipment'
      ? offlineData.offlineEquipment?.[slotKey as mc.EquipmentSlot]
      : mode === 'enderchest'
        ? offlineData.offlineEnderChest?.[slotKey as number]
        : offlineData.offlineInventory?.[slotKey as number];

  if (isDefined(rawItem)) {
    currentItem = deserializeItem(rawItem);
  }

  if (!isDefined(currentItem) || !isDefined(rawItem)) {
    staff.sendMessage('§eThat slot is empty.');
    await reopenParent();
    return;
  }

  const displayName = isNonEmptyString(currentItem.nameTag)
    ? currentItem.nameTag
    : resolveTradeItemDisplayName(currentItem.typeId);
  const canEdit = canModifyTargetInventory(staff, targetPlayerId);

  const details: string[] = [
    `§7Target: §f${targetName} §7(Offline)`,
    `§7Slot: §e${String(slotKey)} (${mode})`,
    `§7Item: §b${displayName} §7(${currentItem.typeId})`,
    `§7Amount: §ex${currentItem.amount} §8/ ${currentItem.maxAmount}`,
  ];

  const form = new ActionFormBuilder()
    .title(`Offline Slot ${String(slotKey)}: ${displayName}`)
    .body(details.join('\n'))
    .button('§bClone Copy to My Inventory', 'textures/ui/copy', async () => {
      const myInv = (staff.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)
        ?.container;
      if (isDefined(myInv) && isDefined(currentItem)) {
        const leftover = myInv.addItem(currentItem.clone());
        if (isDefined(leftover)) {
          staff.sendMessage('§cYour inventory is full.');
        } else {
          staff.sendMessage(`§aCloned ${displayName} x${currentItem.amount} to your inventory.`);
        }
      }
      await reopenParent();
    });

  if (canEdit) {
    form.button('§6Confiscate (Move to My Inventory)', 'textures/ui/icon_recipe_equipment', async () => {
      const myInv = (staff.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)
        ?.container;
      if (!isDefined(myInv) || myInv.emptySlotsCount === 0) {
        staff.sendMessage('§cYou need at least 1 empty slot in your inventory to confiscate this item.');
        await reopenParent();
        return;
      }

      // Check if target player re-joined while modal was open
      const liveTarget = getPlayerFromCache(targetPlayerId);
      if (isDefined(liveTarget) && liveTarget.isValid) {
        staff.sendMessage(`§e${targetName} is now online. Reopening the live inventory view.`);
        await reopenParent();
        return;
      }

      // Re-verify offline state to prevent duplicate confiscation
      const latestData = loadPlayerData(targetPlayerId);
      const existingSnap =
        mode === 'equipment'
          ? latestData?.offlineEquipment?.[slotKey as mc.EquipmentSlot]
          : mode === 'enderchest'
            ? latestData?.offlineEnderChest?.[slotKey as number]
            : latestData?.offlineInventory?.[slotKey as number];

      if (!isDefined(existingSnap) || JSON.stringify(existingSnap) !== JSON.stringify(rawItem)) {
        staff.sendMessage(`§cItem in slot ${String(slotKey)} was modified or already confiscated.`);
        await reopenParent();
        return;
      }

      const cloned = currentItem!.clone();
      cloned.amount = existingSnap.amount;
      updatePlayerData(targetPlayerId, (d) => {
        if (mode === 'equipment') {
          if (d.offlineEquipment) {
            delete d.offlineEquipment[slotKey as mc.EquipmentSlot];
          }
          if (!d.pendingOfflineEquipmentModifications) {
            d.pendingOfflineEquipmentModifications = {};
          }
          d.pendingOfflineEquipmentModifications[slotKey as mc.EquipmentSlot] = null;
          d.pendingOfflineInventorySync = true;
        } else if (mode === 'enderchest') {
          if (d.offlineEnderChest) {
            delete d.offlineEnderChest[slotKey as number];
          }
          if (!d.pendingOfflineEnderChestModifications) {
            d.pendingOfflineEnderChestModifications = {};
          }
          d.pendingOfflineEnderChestModifications[slotKey as number] = null;
          d.pendingOfflineEnderChestSync = true;
        } else {
          if (d.offlineInventory) {
            delete d.offlineInventory[slotKey as number];
          }
          if (!d.pendingOfflineInventoryModifications) {
            d.pendingOfflineInventoryModifications = {};
          }
          d.pendingOfflineInventoryModifications[slotKey as number] = null;
          d.pendingOfflineInventorySync = true;
        }
      });
      myInv.addItem(cloned);
      staff.sendMessage(`§aConfiscated ${displayName} x${cloned.amount} from ${targetName}'s offline inventory.`);
      await reopenParent();
    });

    if (currentItem.maxAmount > 1) {
      form.button('§eEdit Stack Quantity', 'textures/ui/book_edit_default', async () => {
        const modal = new CustomFormBuilder<{ qty: string }>(`Edit Quantity: ${displayName}`)
          .textField(
            'qty',
            `New Amount (1 - ${currentItem!.maxAmount}, or 0 to delete)`,
            String(currentItem!.amount),
            String(currentItem!.amount),
          )
          .submitButton('Save Quantity');
        const res = await modal.show(staff);
        if (res) {
          const liveCheck = getPlayerFromCache(targetPlayerId);
          if (isDefined(liveCheck) && liveCheck.isValid) {
            staff.sendMessage(`§e${targetName} is now online. Reopening the live inventory view.`);
            await reopenParent();
            return;
          }

          const parsed = Number.parseInt(res.qty, 10);
          if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= currentItem!.maxAmount) {
            const currentData = loadPlayerData(targetPlayerId);
            const liveSnap =
              mode === 'equipment'
                ? currentData?.offlineEquipment?.[slotKey as mc.EquipmentSlot]
                : mode === 'enderchest'
                  ? currentData?.offlineEnderChest?.[slotKey as number]
                  : currentData?.offlineInventory?.[slotKey as number];

            if (!isDefined(liveSnap) || liveSnap.typeId !== rawItem.typeId) {
              staff.sendMessage(`§cItem in slot ${String(slotKey)} was modified or is no longer present.`);
              await reopenParent();
              return;
            }

            updatePlayerData(targetPlayerId, (d) => {
              if (parsed === 0) {
                if (mode === 'equipment') {
                  if (d.offlineEquipment) {
                    delete d.offlineEquipment[slotKey as mc.EquipmentSlot];
                  }
                  if (!d.pendingOfflineEquipmentModifications) {
                    d.pendingOfflineEquipmentModifications = {};
                  }
                  d.pendingOfflineEquipmentModifications[slotKey as mc.EquipmentSlot] = null;
                  d.pendingOfflineInventorySync = true;
                } else if (mode === 'enderchest') {
                  if (d.offlineEnderChest) {
                    delete d.offlineEnderChest[slotKey as number];
                  }
                  if (!d.pendingOfflineEnderChestModifications) {
                    d.pendingOfflineEnderChestModifications = {};
                  }
                  d.pendingOfflineEnderChestModifications[slotKey as number] = null;
                  d.pendingOfflineEnderChestSync = true;
                } else {
                  if (d.offlineInventory) {
                    delete d.offlineInventory[slotKey as number];
                  }
                  if (!d.pendingOfflineInventoryModifications) {
                    d.pendingOfflineInventoryModifications = {};
                  }
                  d.pendingOfflineInventoryModifications[slotKey as number] = null;
                  d.pendingOfflineInventorySync = true;
                }
              } else {
                const updated = currentItem!.clone();
                updated.amount = parsed;
                const serialized = serializeItem(updated);
                if (mode === 'equipment') {
                  if (!d.offlineEquipment) {
                    d.offlineEquipment = {};
                  }
                  d.offlineEquipment[slotKey as mc.EquipmentSlot] = serialized;
                  if (!d.pendingOfflineEquipmentModifications) {
                    d.pendingOfflineEquipmentModifications = {};
                  }
                  d.pendingOfflineEquipmentModifications[slotKey as mc.EquipmentSlot] = serialized;
                  d.pendingOfflineInventorySync = true;
                } else if (mode === 'enderchest') {
                  if (!d.offlineEnderChest) {
                    d.offlineEnderChest = {};
                  }
                  d.offlineEnderChest[slotKey as number] = serialized;
                  if (!d.pendingOfflineEnderChestModifications) {
                    d.pendingOfflineEnderChestModifications = {};
                  }
                  d.pendingOfflineEnderChestModifications[slotKey as number] = serialized;
                  d.pendingOfflineEnderChestSync = true;
                } else {
                  if (!d.offlineInventory) {
                    d.offlineInventory = {};
                  }
                  d.offlineInventory[slotKey as number] = serialized;
                  if (!d.pendingOfflineInventoryModifications) {
                    d.pendingOfflineInventoryModifications = {};
                  }
                  d.pendingOfflineInventoryModifications[slotKey as number] = serialized;
                  d.pendingOfflineInventorySync = true;
                }
              }
            });
            staff.sendMessage(`§aUpdated ${displayName} quantity to ${parsed} for ${targetName}.`);
          } else {
            staff.sendMessage('§cInvalid stack amount.');
          }
        }
        await reopenParent();
      });
    }

    form.button('§4Delete Item From Slot', 'textures/ui/trash', async () => {
      const liveCheck = getPlayerFromCache(targetPlayerId);
      if (isDefined(liveCheck) && liveCheck.isValid) {
        staff.sendMessage(`§e${targetName} is now online. Reopening the live inventory view.`);
        await reopenParent();
        return;
      }

      const currentData = loadPlayerData(targetPlayerId);
      const liveSnap =
        mode === 'equipment'
          ? currentData?.offlineEquipment?.[slotKey as mc.EquipmentSlot]
          : mode === 'enderchest'
            ? currentData?.offlineEnderChest?.[slotKey as number]
            : currentData?.offlineInventory?.[slotKey as number];

      if (!isDefined(liveSnap) || liveSnap.typeId !== rawItem.typeId) {
        staff.sendMessage(`§cItem in slot ${String(slotKey)} was modified or is no longer present.`);
        await reopenParent();
        return;
      }

      updatePlayerData(targetPlayerId, (d) => {
        if (mode === 'equipment') {
          if (d.offlineEquipment) {
            delete d.offlineEquipment[slotKey as mc.EquipmentSlot];
          }
          if (!d.pendingOfflineEquipmentModifications) {
            d.pendingOfflineEquipmentModifications = {};
          }
          d.pendingOfflineEquipmentModifications[slotKey as mc.EquipmentSlot] = null;
          d.pendingOfflineInventorySync = true;
        } else if (mode === 'enderchest') {
          if (d.offlineEnderChest) {
            delete d.offlineEnderChest[slotKey as number];
          }
          if (!d.pendingOfflineEnderChestModifications) {
            d.pendingOfflineEnderChestModifications = {};
          }
          d.pendingOfflineEnderChestModifications[slotKey as number] = null;
          d.pendingOfflineEnderChestSync = true;
        } else {
          if (d.offlineInventory) {
            delete d.offlineInventory[slotKey as number];
          }
          if (!d.pendingOfflineInventoryModifications) {
            d.pendingOfflineInventoryModifications = {};
          }
          d.pendingOfflineInventoryModifications[slotKey as number] = null;
          d.pendingOfflineInventorySync = true;
        }
      });
      staff.sendMessage(`§aDeleted ${displayName} from ${targetName}'s offline ${mode}.`);
      await reopenParent();
    });
  }

  form.addBackButton(reopenParent);
  await form.show(staff);
}

/**
 * Finds the first unoccupied slot index in a serialized item map.
 *
 * @param slots Map of numeric slots to serialized items.
 * @param max Maximum number of container slots to scan.
 * @returns Index of the first empty slot.
 */
function findFirstEmptySlot(slots: Record<number, unknown>, max: number): number {
  for (let i = 0; i < max; i++) {
    if (!isDefined(slots[i])) {
      return i;
    }
  }
  return -1;
}

/**
 * Displays a modal dialog allowing staff to grant an item to an online or offline player.
 *
 * @param staff Staff member adding the item.
 * @param targetPlayerId Unique identifier of target player.
 * @param mode Target container category ('inventory' | 'enderchest').
 * @param targetSlot Optional specific slot index.
 */
async function showAddItemModal(
  staff: mc.Player,
  targetPlayerId: string,
  mode: 'inventory' | 'enderchest',
  targetSlot?: number,
): Promise<void> {
  const targetName = getPlayerNameById(targetPlayerId) || targetPlayerId;
  const modal = new CustomFormBuilder<{ typeId: string; amount: string; nameTag: string }>(`Add Item to ${targetName}`)
    .textField(
      'typeId',
      `Item Type ID (e.g. ${MinecraftItemTypes.Diamond} or diamond)`,
      MinecraftItemTypes.Diamond,
      MinecraftItemTypes.Diamond,
    )
    .textField('amount', 'Quantity (1-64)', '1', '1')
    .textField('nameTag', 'Custom Name Tag (Optional)', 'Special Item', '')
    .submitButton('Add Item');

  const res = await modal.show(staff);
  if (!res) {
    if (mode === 'enderchest') {
      await showEnderChestPanel(staff, targetPlayerId);
    } else {
      await showInventoryPanel(staff, targetPlayerId);
    }
    return;
  }

  let typeId = res.typeId.trim();
  if (!typeId.includes(':')) {
    typeId = 'minecraft:' + typeId;
  }
  const amount = Number.parseInt(res.amount, 10);
  if (Number.isNaN(amount) || amount < 1 || amount > 64) {
    staff.sendMessage('§cInvalid amount. Must be between 1 and 64.');
    return;
  }

  let newItem: mc.ItemStack;
  try {
    newItem = new mc.ItemStack(typeId, 1);
    if (amount > newItem.maxAmount) {
      staff.sendMessage(`§cInvalid amount. '${typeId}' max stack size is ${newItem.maxAmount}.`);
      return;
    }
    newItem.amount = amount;
    if (isNonEmptyString(res.nameTag.trim())) {
      newItem.nameTag = res.nameTag.trim();
    }
  } catch {
    staff.sendMessage(`§cInvalid item identifier '${typeId}'.`);
    return;
  }

  const targetPlayer = getPlayerFromCache(targetPlayerId);
  if (isDefined(targetPlayer) && targetPlayer.isValid) {
    const compId = mode === 'enderchest' ? EntityComponentTypes.EnderInventory : EntityComponentTypes.Inventory;
    const container = (
      targetPlayer.getComponent(compId) as mc.EntityInventoryComponent | mc.EntityEnderInventoryComponent | undefined
    )?.container;
    if (!isDefined(container)) {
      staff.sendMessage(`§cCould not access ${targetName}'s container.`);
      return;
    }
    if (
      targetSlot !== undefined &&
      targetSlot >= 0 &&
      targetSlot < container.size &&
      !isDefined(container.getItem(targetSlot))
    ) {
      container.setItem(targetSlot, newItem);
      staff.sendMessage(`§aPlaced ${typeId} x${amount} into slot ${targetSlot} for ${targetName}.`);
    } else {
      const leftover = container.addItem(newItem);
      if (isDefined(leftover)) {
        staff.sendMessage(`§eContainer was full; gave what could fit (leftover x${leftover.amount}).`);
      } else {
        staff.sendMessage(`§aAdded ${typeId} x${amount} to ${targetName}'s ${mode}.`);
      }
    }
  } else {
    // Offline target
    let assignedSlot: number | -1 = -1;
    let isFull = false;
    updatePlayerData(targetPlayerId, (d) => {
      const serialized = serializeItem(newItem);
      if (mode === 'enderchest') {
        const ec = d.offlineEnderChest ?? {};
        let slot = targetSlot;
        if (slot === undefined || isDefined(ec[slot])) {
          slot = findFirstEmptySlot(ec, 27);
        }
        if (slot === -1) {
          isFull = true;
          return;
        }
        assignedSlot = slot;
        ec[slot] = serialized;
        d.offlineEnderChest = ec;
        if (!d.pendingOfflineEnderChestModifications) {
          d.pendingOfflineEnderChestModifications = {};
        }
        d.pendingOfflineEnderChestModifications[slot] = serialized;
        d.pendingOfflineEnderChestSync = true;
      } else {
        const inv = d.offlineInventory ?? {};
        let slot = targetSlot;
        if (slot === undefined || isDefined(inv[slot])) {
          slot = findFirstEmptySlot(inv, 36);
        }
        if (slot === -1) {
          isFull = true;
          return;
        }
        assignedSlot = slot;
        inv[slot] = serialized;
        d.offlineInventory = inv;
        if (!d.pendingOfflineInventoryModifications) {
          d.pendingOfflineInventoryModifications = {};
        }
        d.pendingOfflineInventoryModifications[slot] = serialized;
        d.pendingOfflineInventorySync = true;
      }
    });

    if (isFull) {
      staff.sendMessage(`§cCould not add item: ${targetName}'s offline ${mode} is full.`);
    } else {
      staff.sendMessage(`§aAdded ${typeId} x${amount} to ${targetName}'s offline ${mode} (slot ${assignedSlot}).`);
    }
  }

  if (mode === 'enderchest') {
    await showEnderChestPanel(staff, targetPlayerId);
  } else {
    await showInventoryPanel(staff, targetPlayerId);
  }
}

/**
 * Displays an interactive administrative inventory inspection panel for an online or offline player.
 *
 * @param player Staff player viewing the panel.
 * @param targetPlayerId Unique identifier of the target player.
 * @param page Current pagination page number.
 */
export async function showInventoryPanel(player: mc.Player, targetPlayerId: string, page: number = 1): Promise<void> {
  const targetName = getPlayerNameById(targetPlayerId) || targetPlayerId;
  const targetPlayer = getPlayerFromCache(targetPlayerId);

  if (!targetPlayer) {
    const offlineData = loadPlayerData(targetPlayerId);
    const invSnap = offlineData?.offlineInventory ?? {};
    const eqSnap = offlineData?.offlineEquipment ?? {};
    const canEdit = canModifyTargetInventory(player, targetPlayerId);

    const form = new ActionFormBuilder()
      .title(`${targetName}'s Offline Inventory`)
      .body('§7Viewing saved offline snapshot (tap any item to clone a copy to your inventory):');

    if (canEdit) {
      form.button('§a➕ Add Item to Offline Inventory', 'textures/ui/color_plus', async () => {
        await showAddItemModal(player, targetPlayerId, 'inventory');
      });
      form.button('§l§4Clear Offline Inventory (On Next Join)', 'textures/ui/trash', async () => {
        updatePlayerData(targetPlayerId, (d) => {
          d.offlineInventory = {};
          d.offlineEquipment = {};
          d.pendingInventoryClear = true;
          d.pendingOfflineInventorySync = false;
          delete d.pendingOfflineInventoryModifications;
          delete d.pendingOfflineEquipmentModifications;
        });
        player.sendMessage(`§aCleared ${targetName}'s offline inventory (will apply when they next join).`);
        await showInventoryPanel(player, targetPlayerId, page);
      });
    }

    for (const [eqSlot, item] of Object.entries(eqSnap)) {
      if (isDefined(item)) {
        const name = isNonEmptyString(item.nameTag) ? item.nameTag : resolveTradeItemDisplayName(item.typeId);
        form.button(`§6[${eqSlot}] §f${name} x${item.amount}`, resolveTradeItemIcon(item.typeId), async () => {
          await showOfflineSlotActionPanel(player, targetPlayerId, 'equipment', eqSlot, page);
        });
      }
    }

    for (let i = 0; i < 36; i++) {
      const item = invSnap[i];
      if (isDefined(item)) {
        const displayName = isNonEmptyString(item.nameTag) ? item.nameTag : resolveTradeItemDisplayName(item.typeId);
        form.button(`Slot ${i}: ${displayName} x${item.amount}`, resolveTradeItemIcon(item.typeId), async () => {
          await showOfflineSlotActionPanel(player, targetPlayerId, 'inventory', i, page);
        });
      } else if (canEdit) {
        form.button(`Slot ${i}: §8Empty (Add Item)`, 'textures/ui/color_plus', async () => {
          await showAddItemModal(player, targetPlayerId, 'inventory', i);
        });
      }
    }

    form.addBackButton(async () => {
      await showPanel(player, 'playerActionsPanel', { targetPlayerId });
    });

    await form.show(player);
    return;
  }

  const inventoryComponent = targetPlayer.getComponent(EntityComponentTypes.Inventory) as
    mc.EntityInventoryComponent | undefined;
  if (!inventoryComponent || !inventoryComponent.container) {
    player.sendMessage(`§cCannot access inventory component for ${targetName}.`);
    return showPanel(player, 'playerActionsPanel', { targetPlayerId });
  }

  const container = inventoryComponent.container;
  const equipComp = targetPlayer.getComponent(EntityComponentTypes.Equippable) as
    mc.EntityEquippableComponent | undefined;
  const form = new ActionFormBuilder()
    .title(`${targetName}'s Inventory`)
    .body('§7Select any equipped gear or inventory slot to inspect, clone, confiscate, or edit:');

  const canEdit = canModifyTargetInventory(player, targetPlayerId);
  if (canEdit) {
    form.button('§a➕ Add Item to Inventory', 'textures/ui/color_plus', async () => {
      await showAddItemModal(player, targetPlayerId, 'inventory');
    });
  }

  if (page === 1 && isDefined(equipComp)) {
    const armorSlots: [mc.EquipmentSlot, string][] = [
      [mc.EquipmentSlot.Head, 'Head'],
      [mc.EquipmentSlot.Chest, 'Chest'],
      [mc.EquipmentSlot.Legs, 'Legs'],
      [mc.EquipmentSlot.Feet, 'Feet'],
      [mc.EquipmentSlot.Offhand, 'Offhand'],
    ];
    for (const [eqSlot, label] of armorSlots) {
      const eqItem = equipComp.getEquipment(eqSlot);
      if (isDefined(eqItem)) {
        const name = isNonEmptyString(eqItem.nameTag) ? eqItem.nameTag : resolveTradeItemDisplayName(eqItem.typeId);
        form.button(`§6[${label}] §f${name} x${eqItem.amount}`, resolveTradeItemIcon(eqItem.typeId), async () => {
          await showSlotActionPanel(player, targetPlayerId, 'equipment', eqSlot, page);
        });
      }
    }
  }

  const items: { slot: number; item: mc.ItemStack | undefined }[] = [];
  for (let i = 0; i < container.size; i++) {
    items.push({ slot: i, item: container.getItem(i) });
  }

  const itemsPerPage = 36;
  if (page > 1) {
    form.button('§6< Previous Page', 'textures/ui/up_arrow', async () => {
      await showInventoryPanel(player, targetPlayerId, page - 1);
    });
  }

  const startIndex = (page - 1) * itemsPerPage;
  const paginated = items.slice(startIndex, startIndex + itemsPerPage);

  for (const data of paginated) {
    if (data.item) {
      const displayName = isNonEmptyString(data.item.nameTag)
        ? data.item.nameTag
        : resolveTradeItemDisplayName(data.item.typeId);
      form.button(
        `Slot ${data.slot}: ${displayName} x${data.item.amount}`,
        resolveTradeItemIcon(data.item.typeId),
        async () => {
          await showSlotActionPanel(player, targetPlayerId, 'inventory', data.slot, page);
        },
      );
    } else {
      if (canEdit) {
        form.button(`Slot ${data.slot}: §8Empty (Add Item)`, 'textures/ui/color_plus', async () => {
          await showAddItemModal(player, targetPlayerId, 'inventory', data.slot);
        });
      } else {
        form.button(`Slot ${data.slot}: §8Empty`, 'textures/ui/icon_recipe_equipment', async () => {
          await showInventoryPanel(player, targetPlayerId, page);
        });
      }
    }
  }

  const totalPages = Math.ceil(items.length / itemsPerPage);
  if (page < totalPages) {
    form.button('§6Next Page >', 'textures/ui/down_arrow', async () => {
      await showInventoryPanel(player, targetPlayerId, page + 1);
    });
  }

  form.addBackButton(async () => {
    await showPanel(player, 'playerActionsPanel', { targetPlayerId });
  });

  await form.show(player);
}

/**
 * Displays an administrative Ender Chest inspection panel for an online or offline player.
 *
 * @param player Staff player viewing the panel.
 * @param targetPlayerId Unique identifier of the target player.
 */
export async function showEnderChestPanel(player: mc.Player, targetPlayerId: string): Promise<void> {
  const targetName = getPlayerNameById(targetPlayerId) || targetPlayerId;
  const targetPlayer = getPlayerFromCache(targetPlayerId);

  if (!targetPlayer) {
    const offlineData = loadPlayerData(targetPlayerId);
    const ecSnap = offlineData?.offlineEnderChest ?? {};
    const canEdit = canModifyTargetInventory(player, targetPlayerId);

    const form = new ActionFormBuilder()
      .title(`${targetName}'s Offline Ender Chest`)
      .body('§7Viewing saved offline Ender Chest snapshot (tap an item to clone a copy):');

    if (canEdit) {
      form.button('§a➕ Add Item to Offline Ender Chest', 'textures/ui/color_plus', async () => {
        await showAddItemModal(player, targetPlayerId, 'enderchest');
      });
      form.button('§l§4Wipe Offline Ender Chest (On Next Join)', 'textures/ui/trash', async () => {
        updatePlayerData(targetPlayerId, (d) => {
          d.offlineEnderChest = {};
          d.pendingEnderChestWipe = true;
          d.pendingOfflineEnderChestSync = false;
          delete d.pendingOfflineEnderChestModifications;
        });
        player.sendMessage(`§aWiped ${targetName}'s offline Ender Chest (will apply when they next join).`);
        await showEnderChestPanel(player, targetPlayerId);
      });
    }

    for (let i = 0; i < 27; i++) {
      const item = ecSnap[i];
      if (isDefined(item)) {
        const displayName = isNonEmptyString(item.nameTag) ? item.nameTag : resolveTradeItemDisplayName(item.typeId);
        form.button(`Slot ${i}: ${displayName} x${item.amount}`, resolveTradeItemIcon(item.typeId), async () => {
          await showOfflineSlotActionPanel(player, targetPlayerId, 'enderchest', i, 1);
        });
      } else if (canEdit) {
        form.button(`Slot ${i}: §8Empty (Add Item)`, 'textures/ui/color_plus', async () => {
          await showAddItemModal(player, targetPlayerId, 'enderchest', i);
        });
      }
    }

    form.addBackButton(async () => {
      await showPanel(player, 'playerActionsPanel', { targetPlayerId });
    });

    await form.show(player);
    return;
  }

  const enderComponent = targetPlayer.getComponent(EntityComponentTypes.EnderInventory) as
    mc.EntityEnderInventoryComponent | undefined;
  if (!enderComponent || !enderComponent.container) {
    player.sendMessage(`§cCannot access Ender Chest component for ${targetName}.`);
    return showPanel(player, 'playerActionsPanel', { targetPlayerId });
  }

  const container = enderComponent.container;
  const form = new ActionFormBuilder()
    .title(`${targetName}'s Ender Chest`)
    .body('§7Select an Ender Chest slot to inspect, clone, confiscate, or delete:');

  const canEdit = canModifyTargetInventory(player, targetPlayerId);
  if (canEdit) {
    form.button('§a➕ Add Item to Ender Chest', 'textures/ui/color_plus', async () => {
      await showAddItemModal(player, targetPlayerId, 'enderchest');
    });
  }

  for (let i = 0; i < container.size; i++) {
    const slotIdx = i;
    const item = container.getItem(slotIdx);
    if (item) {
      const displayName = isNonEmptyString(item.nameTag) ? item.nameTag : resolveTradeItemDisplayName(item.typeId);
      form.button(`Slot ${slotIdx}: ${displayName} x${item.amount}`, resolveTradeItemIcon(item.typeId), async () => {
        await showSlotActionPanel(player, targetPlayerId, 'enderchest', slotIdx, 1);
      });
    } else {
      if (canEdit) {
        form.button(`Slot ${slotIdx}: §8Empty (Add Item)`, 'textures/ui/color_plus', async () => {
          await showAddItemModal(player, targetPlayerId, 'enderchest', slotIdx);
        });
      } else {
        form.button(`Slot ${slotIdx}: §8Empty`, 'textures/ui/icon_recipe_equipment', async () => {
          await showEnderChestPanel(player, targetPlayerId);
        });
      }
    }
  }

  form.addBackButton(async () => {
    await showPanel(player, 'playerActionsPanel', { targetPlayerId });
  });

  await form.show(player);
}
