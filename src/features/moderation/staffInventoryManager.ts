import { deserializeItem, SerializedItem, serializeItem } from '@core/data/itemSerializer.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { registerEvent } from '@core/events/eventManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { errorLog } from '@core/utils/logger.js';
import { isDefined, isNumber } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';

export type InventoryProfileType = 'survival' | 'staff';

export interface InventorySnapshot {
    slots: Record<number, SerializedItem>;
    equipment: Partial<Record<mc.EquipmentSlot, SerializedItem>>;
    xpLevel: number;
    savedAt: number;
}

export interface StaffInventoryRecord {
    activeProfile: InventoryProfileType;
    autoSwap: boolean;
    survival?: InventorySnapshot;
    staff?: InventorySnapshot;
}

const staffInvPrefix = 'exe:staffInv.';
function getEquipmentSlots(): mc.EquipmentSlot[] {
    return [mc.EquipmentSlot.Head, mc.EquipmentSlot.Chest, mc.EquipmentSlot.Legs, mc.EquipmentSlot.Feet, mc.EquipmentSlot.Offhand];
}

const memoryCache = new Map<string, StaffInventoryRecord>();

function getStorage(playerId: string): StorageManager {
    return new StorageManager(`${staffInvPrefix}${playerId}`);
}

export function isStaffGamemode(mode: mc.GameMode): boolean {
    const modeLower = String(mode).toLowerCase();
    return mode === mc.GameMode.Creative || mode === mc.GameMode.Spectator || modeLower === 'creative' || modeLower === 'spectator';
}

export function hasStaffInventoryPermission(player: mc.Player): boolean {
    return hasPermission(player, 'cmd.staffinv.mod') || hasPermission(player, 'group.mod');
}

export function getStaffInventoryRecord(player: mc.Player, fallbackMode?: mc.GameMode): StaffInventoryRecord {
    const cached = memoryCache.get(player.id);
    if (isDefined(cached)) {
        return cached;
    }

    const storage = getStorage(player.id);
    const loaded = storage.load<StaffInventoryRecord>();
    if (isDefined(loaded)) {
        memoryCache.set(player.id, loaded);
        return loaded;
    }

    const pData = playerDataManager.getOrCreatePlayer(player);
    const modeToUse = fallbackMode ?? player.getGameMode();
    const initialProfile: InventoryProfileType = pData.staffInventoryMode ?? (isStaffGamemode(modeToUse) ? 'staff' : 'survival');
    const initialAutoSwap = pData.staffAutoSwapInventory ?? true;

    const freshRecord: StaffInventoryRecord = {
        activeProfile: initialProfile,
        autoSwap: initialAutoSwap
    };
    memoryCache.set(player.id, freshRecord);
    return freshRecord;
}

function saveStaffInventoryRecord(playerId: string, record: StaffInventoryRecord): void {
    memoryCache.set(playerId, record);
    getStorage(playerId).save(record);
    playerDataManager.updatePlayerData(playerId, (d) => {
        d.staffInventoryMode = record.activeProfile;
        d.staffAutoSwapInventory = record.autoSwap;
    });
}

function captureLiveInventory(player: mc.Player): InventorySnapshot | undefined {
    const invComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    if (!isDefined(invComp) || !isDefined(invComp.container)) {
        return undefined;
    }

    const container = invComp.container;
    const slots: Record<number, SerializedItem> = {};

    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (isDefined(item)) {
            slots[i] = serializeItem(item);
        }
    }

    const equipment: Partial<Record<mc.EquipmentSlot, SerializedItem>> = {};
    const equipComp = player.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;
    if (isDefined(equipComp)) {
        for (const slot of getEquipmentSlots()) {
            const eqItem = equipComp.getEquipment(slot);
            if (isDefined(eqItem)) {
                equipment[slot] = serializeItem(eqItem);
            }
        }
    }

    const xpLevel = typeof player.level === 'number' ? Math.max(0, player.level) : 0;

    return {
        slots,
        equipment,
        xpLevel,
        savedAt: Date.now()
    };
}

function sendOverflowToMailbox(player: mc.Player, item: SerializedItem): void {
    playerDataManager.updatePlayerData(player.id, (d) => {
        d.mailbox.push(item);
    });
    player.sendMessage('§e[StaffInv] An item could not fit in your inventory and was safely placed in your Collection Bin (/ah).');
}

function applySnapshotToPlayer(player: mc.Player, snapshot: InventorySnapshot | undefined): boolean {
    const invComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    if (!isDefined(invComp) || !isDefined(invComp.container)) {
        return false;
    }

    const container = invComp.container;
    const equipComp = player.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;

    container.clearAll();
    if (isDefined(equipComp)) {
        for (const slot of getEquipmentSlots()) {
            try {
                equipComp.setEquipment(slot, undefined);
            } catch {
                // Ignore if slot clear fails
            }
        }
    }

    try {
        player.resetLevel();
    } catch {
        // Ignore if resetLevel is unavailable in mock environment
    }

    if (!isDefined(snapshot)) {
        return true;
    }

    for (const [slotStr, serialized] of Object.entries(snapshot.slots)) {
        const slotIndex = Number.parseInt(slotStr, 10);
        const stack = deserializeItem(serialized);
        if (!isDefined(stack)) {
            sendOverflowToMailbox(player, serialized);
            continue;
        }

        if (!Number.isNaN(slotIndex) && slotIndex >= 0 && slotIndex < container.size) {
            try {
                container.setItem(slotIndex, stack);
            } catch {
                const leftover = container.addItem(stack);
                if (isDefined(leftover)) {
                    sendOverflowToMailbox(player, serializeItem(leftover));
                }
            }
        } else {
            const leftover = container.addItem(stack);
            if (isDefined(leftover)) {
                sendOverflowToMailbox(player, serializeItem(leftover));
            }
        }
    }

    if (isDefined(equipComp) && isDefined(snapshot.equipment)) {
        for (const slot of getEquipmentSlots()) {
            const eqData = snapshot.equipment[slot];
            if (!isDefined(eqData)) {
                continue;
            }
            const stack = deserializeItem(eqData);
            if (!isDefined(stack)) {
                sendOverflowToMailbox(player, eqData);
                continue;
            }
            try {
                equipComp.setEquipment(slot, stack);
            } catch {
                const leftover = container.addItem(stack);
                if (isDefined(leftover)) {
                    sendOverflowToMailbox(player, serializeItem(leftover));
                }
            }
        }
    }

    if (isNumber(snapshot.xpLevel) && snapshot.xpLevel > 0) {
        try {
            player.addLevels(snapshot.xpLevel);
        } catch {
            // Ignore XP errors
        }
    }

    return true;
}

export function swapStaffInventory(
    player: mc.Player,
    targetProfile: InventoryProfileType,
    options: { silent?: boolean; initialFromMode?: mc.GameMode } = {}
): { success: boolean; switched: boolean; message: string } {
    if (!player.isValid) {
        return { success: false, switched: false, message: '§cPlayer is not valid.' };
    }

    const record = getStaffInventoryRecord(player, options.initialFromMode);
    if (record.activeProfile === targetProfile) {
        return {
            success: true,
            switched: false,
            message: `§eYou are already using your ${targetProfile === 'staff' ? '§cStaff' : '§aSurvival'}§e inventory.`
        };
    }

    const currentSnapshot = captureLiveInventory(player);
    if (!isDefined(currentSnapshot)) {
        return { success: false, switched: false, message: '§cCould not access your inventory container.' };
    }

    try {
        // 1. Save outgoing profile to disk BEFORE clearing live inventory so zero data can be lost
        if (record.activeProfile === 'survival') {
            record.survival = currentSnapshot;
        } else {
            record.staff = currentSnapshot;
        }
        saveStaffInventoryRecord(player.id, record);

        // 2. Apply incoming profile
        const targetSnapshot = targetProfile === 'survival' ? record.survival : record.staff;
        const applied = applySnapshotToPlayer(player, targetSnapshot);
        if (!applied) {
            return { success: false, switched: false, message: '§cFailed to apply target inventory.' };
        }

        // 3. Persist updated active profile state
        record.activeProfile = targetProfile;
        saveStaffInventoryRecord(player.id, record);

        const label = targetProfile === 'staff' ? '§cStaff Inventory' : '§aSurvival Inventory';
        const savedLabel = targetProfile === 'staff' ? 'Survival' : 'Staff';
        const msg = `§6[StaffInv] §aSwitched to ${label}§a. §7(Your ${savedLabel} inventory was safely saved)`;

        if (!options.silent) {
            player.sendMessage(msg);
        }

        return { success: true, switched: true, message: msg };
    } catch (error) {
        errorLog(`[StaffInv] Error swapping inventory for ${player.name}:`, error);
        return { success: false, switched: false, message: '§cAn error occurred while swapping inventories. No data was lost.' };
    }
}

export function toggleStaffInventory(player: mc.Player): { success: boolean; switched: boolean; message: string } {
    const record = getStaffInventoryRecord(player);
    const nextProfile: InventoryProfileType = record.activeProfile === 'survival' ? 'staff' : 'survival';
    return swapStaffInventory(player, nextProfile);
}

export function toggleStaffAutoSwap(player: mc.Player): boolean {
    const record = getStaffInventoryRecord(player);
    record.autoSwap = !record.autoSwap;
    saveStaffInventoryRecord(player.id, record);
    return record.autoSwap;
}

export function getStaffInventoryStatus(player: mc.Player): string {
    const record = getStaffInventoryRecord(player);
    const activeText = record.activeProfile === 'staff' ? '§cSTAFF' : '§aSURVIVAL';
    const autoText = record.autoSwap ? '§2ON' : '§cOFF';
    const survCount = record.survival ? Object.keys(record.survival.slots).length : 0;
    const staffCount = record.staff ? Object.keys(record.staff.slots).length : 0;
    return [
        `§6--- Staff Inventory Status ---`,
        `§7Active Profile: ${activeText}`,
        `§7Auto-Swap on Gamemode: ${autoText}`,
        `§7Stored Survival Slots: §f${survCount} §8| §7Stored Staff Slots: §f${staffCount}`
    ].join('\n');
}

export function handleGameModeInventorySwap(player: mc.Player, toGameMode: mc.GameMode, fromGameMode?: mc.GameMode): void {
    if (!player.isValid || !hasStaffInventoryPermission(player)) {
        return;
    }

    const record = getStaffInventoryRecord(player, fromGameMode);
    if (!record.autoSwap) {
        return;
    }

    const targetProfile: InventoryProfileType = isStaffGamemode(toGameMode) ? 'staff' : 'survival';
    if (record.activeProfile !== targetProfile) {
        swapStaffInventory(player, targetProfile, { initialFromMode: fromGameMode });
    }
}

export function initializeStaffInventoryListener(): void {
    if (isDefined(mc.world?.afterEvents?.playerGameModeChange)) {
        registerEvent(
            mc.world.afterEvents.playerGameModeChange,
            (event) => {
                handleGameModeInventorySwap(event.player, event.toGameMode, event.fromGameMode);
            },
            'staffInventoryGameModeChange'
        );
    }
}
