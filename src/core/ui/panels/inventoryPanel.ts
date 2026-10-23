import { getPlayerFromCache } from '@core/data/playerCache.js';
import { getPlayerNameById } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { canTarget } from '@core/permissions/rankManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import { resolveTradeItemDisplayName, resolveTradeItemIcon } from '@features/economy/tradeUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
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
    returnPage: number = 1
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

    if (mode === 'equipment') {
        const equipComp = targetPlayer.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;
        const eqSlot = slotKey as mc.EquipmentSlot;
        currentItem = equipComp?.getEquipment(eqSlot);
        setSlotItem = (newItem) => equipComp?.setEquipment(eqSlot, newItem);
    } else {
        const compId = mode === 'enderchest' ? EntityComponentTypes.EnderInventory : EntityComponentTypes.Inventory;
        const container = (targetPlayer.getComponent(compId) as mc.EntityInventoryComponent | mc.EntityEnderInventoryComponent | undefined)?.container;
        const idx = slotKey as number;
        currentItem = container?.getItem(idx);
        setSlotItem = (newItem) => container?.setItem(idx, newItem);
    }

    if (!isDefined(currentItem)) {
        staff.sendMessage('§eThat slot is now empty.');
        await reopenParent();
        return;
    }

    const displayName = isNonEmptyString(currentItem.nameTag) ? currentItem.nameTag : resolveTradeItemDisplayName(currentItem.typeId);
    const lore = currentItem.getLore();
    const canEdit = canModifyTargetInventory(staff, targetPlayerId);

    const details: string[] = [
        `§7Target: §f${targetName}`,
        `§7Slot: §e${String(slotKey)} (${mode})`,
        `§7Item: §b${displayName} §7(${currentItem.typeId})`,
        `§7Amount: §ex${currentItem.amount} §8/ ${currentItem.maxAmount}`
    ];
    if (lore.length > 0) {
        details.push(`§7Lore: §d${lore.join(' | ')}`);
    }

    const form = new ActionFormBuilder()
        .title(`Slot ${String(slotKey)}: ${displayName}`)
        .body(details.join('\n'))
        .button('§bClone Copy to My Inventory', 'textures/ui/copy', async () => {
            const myInv = (staff.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)?.container;
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
        form.button('§6Confiscate (Move to My Inventory)', 'textures/ui/inventory_icon', async () => {
            const myInv = (staff.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)?.container;
            if (!isDefined(myInv) || myInv.emptySlotsCount === 0) {
                staff.sendMessage('§cYou need at least 1 empty slot in your inventory to confiscate this item.');
                await reopenParent();
                return;
            }
            const cloned = currentItem.clone();
            setSlotItem(undefined);
            myInv.addItem(cloned);
            staff.sendMessage(`§aConfiscated ${displayName} x${cloned.amount} from ${targetName}.`);
            await reopenParent();
        });

        if (currentItem.maxAmount > 1) {
            form.button('§eEdit Stack Quantity', 'textures/ui/book_edit_default', async () => {
                const modal = new CustomFormBuilder<{ qty: string }>(`Edit Quantity: ${displayName}`)
                    .textField('qty', `New Amount (1 - ${currentItem.maxAmount}, or 0 to delete)`, String(currentItem.amount), String(currentItem.amount))
                    .submitButton('Save Quantity');
                const res = await modal.show(staff);
                if (res) {
                    const parsed = Number.parseInt(res.qty, 10);
                    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= currentItem.maxAmount) {
                        if (parsed === 0) {
                            setSlotItem(undefined);
                            staff.sendMessage(`§aRemoved ${displayName} from ${targetName}.`);
                        } else {
                            const updated = currentItem.clone();
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
            setSlotItem(undefined);
            staff.sendMessage(`§aDeleted ${displayName} from ${targetName}'s ${mode}.`);
            await reopenParent();
        });
    }

    form.addBackButton(reopenParent);
    await form.show(staff);
}

export async function showInventoryPanel(player: mc.Player, targetPlayerId: string, page: number = 1): Promise<void> {
    const targetName = getPlayerNameById(targetPlayerId) || targetPlayerId;
    const targetPlayer = getPlayerFromCache(targetPlayerId);

    if (!targetPlayer) {
        player.sendMessage(`§cCannot view inventory. Player ${targetName} is offline.`);
        return showPanel(player, 'playerActionsPanel', { targetPlayerId });
    }

    const inventoryComponent = targetPlayer.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    if (!inventoryComponent || !inventoryComponent.container) {
        player.sendMessage(`§cCannot access inventory component for ${targetName}.`);
        return showPanel(player, 'playerActionsPanel', { targetPlayerId });
    }

    const container = inventoryComponent.container;
    const equipComp = targetPlayer.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;
    const form = new ActionFormBuilder().title(`${targetName}'s Inventory`).body('§7Select any equipped gear or inventory slot to inspect, clone, confiscate, or edit:');

    if (page === 1 && isDefined(equipComp)) {
        const armorSlots: [mc.EquipmentSlot, string][] = [
            [mc.EquipmentSlot.Head, 'Head'],
            [mc.EquipmentSlot.Chest, 'Chest'],
            [mc.EquipmentSlot.Legs, 'Legs'],
            [mc.EquipmentSlot.Feet, 'Feet'],
            [mc.EquipmentSlot.Offhand, 'Offhand']
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
        form.button('§6< Previous Page', 'textures/gui/newgui/UpArrow', async () => {
            await showInventoryPanel(player, targetPlayerId, page - 1);
        });
    }

    const startIndex = (page - 1) * itemsPerPage;
    const paginated = items.slice(startIndex, startIndex + itemsPerPage);

    for (const data of paginated) {
        if (data.item) {
            const displayName = isNonEmptyString(data.item.nameTag) ? data.item.nameTag : resolveTradeItemDisplayName(data.item.typeId);
            form.button(`Slot ${data.slot}: ${displayName} x${data.item.amount}`, resolveTradeItemIcon(data.item.typeId), async () => {
                await showSlotActionPanel(player, targetPlayerId, 'inventory', data.slot, page);
            });
        } else {
            form.button(`Slot ${data.slot}: §8Empty`, 'textures/ui/inventory_icon', async () => {
                await showInventoryPanel(player, targetPlayerId, page);
            });
        }
    }

    const totalPages = Math.ceil(items.length / itemsPerPage);
    if (page < totalPages) {
        form.button('§6Next Page >', 'textures/gui/newgui/DownArrow', async () => {
            await showInventoryPanel(player, targetPlayerId, page + 1);
        });
    }

    form.addBackButton(async () => {
        await showPanel(player, 'playerActionsPanel', { targetPlayerId });
    });

    await form.show(player);
}

export async function showEnderChestPanel(player: mc.Player, targetPlayerId: string): Promise<void> {
    const targetName = getPlayerNameById(targetPlayerId) || targetPlayerId;
    const targetPlayer = getPlayerFromCache(targetPlayerId);

    if (!targetPlayer) {
        player.sendMessage(`§cCannot view Ender Chest. Player ${targetName} is offline.`);
        return showPanel(player, 'playerActionsPanel', { targetPlayerId });
    }

    const enderComponent = targetPlayer.getComponent(EntityComponentTypes.EnderInventory) as mc.EntityEnderInventoryComponent | undefined;
    if (!enderComponent || !enderComponent.container) {
        player.sendMessage(`§cCannot access Ender Chest component for ${targetName}.`);
        return showPanel(player, 'playerActionsPanel', { targetPlayerId });
    }

    const container = enderComponent.container;
    const form = new ActionFormBuilder().title(`${targetName}'s Ender Chest`).body('§7Select an Ender Chest slot to inspect, clone, confiscate, or delete:');

    for (let i = 0; i < container.size; i++) {
        const slotIdx = i;
        const item = container.getItem(slotIdx);
        if (item) {
            const displayName = isNonEmptyString(item.nameTag) ? item.nameTag : resolveTradeItemDisplayName(item.typeId);
            form.button(`Slot ${slotIdx}: ${displayName} x${item.amount}`, resolveTradeItemIcon(item.typeId), async () => {
                await showSlotActionPanel(player, targetPlayerId, 'enderchest', slotIdx, 1);
            });
        } else {
            form.button(`Slot ${slotIdx}: §8Empty`, 'textures/ui/inventory_icon', async () => {
                await showEnderChestPanel(player, targetPlayerId);
            });
        }
    }

    form.addBackButton(async () => {
        await showPanel(player, 'playerActionsPanel', { targetPlayerId });
    });

    await form.show(player);
}
