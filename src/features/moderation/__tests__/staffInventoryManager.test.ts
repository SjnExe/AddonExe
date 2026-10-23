import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import * as playerDataManager from '@core/data/playerDataManager.js';
import * as permissionEngine from '@core/permissions/permissionEngine.js';
import { isStaffChatEnabled, toggleStaffChat } from '@features/moderation/commands/staffchat.js';
import { handleGameModeInventorySwap, swapStaffInventory, toggleStaffAutoSwap, toggleStaffInventory } from '@features/moderation/staffInventoryManager.js';
import { isTeamChatEnabled, toggleTeamChat } from '@features/social/team/commands/team.js';
import * as mc from '@minecraft/server';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';

const itemProto = mc.ItemStack.prototype as unknown as {
    lore?: string[];
    canDestroy?: string[];
    canPlaceOn?: string[];
    getLore?: () => string[];
    setLore?: (lore?: string[]) => void;
    getComponent?: () => undefined;
    getCanDestroy?: () => string[];
    setCanDestroy?: (ids?: string[]) => void;
    getCanPlaceOn?: () => string[];
    setCanPlaceOn?: (ids?: string[]) => void;
    getDynamicPropertyIds?: () => string[];
    getDynamicProperty?: (id: string) => unknown;
    setDynamicProperty?: (id: string, val: unknown) => void;
};
itemProto.getLore ??= function () {
    return this.lore ?? [];
};
itemProto.setLore ??= function (lore?: string[]) {
    this.lore = lore ?? [];
};
itemProto.getComponent ??= function () {
    return undefined;
};
itemProto.getCanDestroy ??= function () {
    return this.canDestroy ?? [];
};
itemProto.setCanDestroy ??= function (ids?: string[]) {
    this.canDestroy = ids ?? [];
};
itemProto.getCanPlaceOn ??= function () {
    return this.canPlaceOn ?? [];
};
itemProto.setCanPlaceOn ??= function (ids?: string[]) {
    this.canPlaceOn = ids ?? [];
};
itemProto.getDynamicPropertyIds ??= function () {
    return [];
};
itemProto.getDynamicProperty ??= function () {
    return undefined;
};
itemProto.setDynamicProperty ??= function () {};

function createMockPlayer(id: string, name: string, initialMode: mc.GameMode = mc.GameMode.Survival) {
    const slots = new Map<number, mc.ItemStack>();
    const equipment = new Map<string, mc.ItemStack>();
    let gameMode = initialMode;
    let level = 15;

    const container = {
        size: 36,
        getItem: mock((slot: number) => slots.get(slot)),
        setItem: mock((slot: number, item?: mc.ItemStack) => {
            if (item) {
                slots.set(slot, item);
            } else {
                slots.delete(slot);
            }
        }),
        addItem: mock((item: mc.ItemStack) => {
            for (let i = 0; i < 36; i++) {
                if (!slots.has(i)) {
                    slots.set(i, item);
                    return undefined;
                }
            }
            return item;
        }),
        clearAll: mock(() => {
            slots.clear();
        })
    };

    const equipComp = {
        getEquipment: mock((slot: string) => equipment.get(slot)),
        setEquipment: mock((slot: string, item?: mc.ItemStack) => {
            if (item) {
                equipment.set(slot, item);
            } else {
                equipment.delete(slot);
            }
        })
    };

    const player = {
        id,
        name,
        isValid: true,
        get level() {
            return level;
        },
        resetLevel: mock(() => {
            level = 0;
        }),
        addLevels: mock((amount: number) => {
            level += amount;
        }),
        getGameMode: mock(() => gameMode),
        setGameMode: mock((newMode: mc.GameMode) => {
            gameMode = newMode;
        }),
        sendMessage: mock(() => {}),
        getComponent: mock((compId: string) => {
            if (String(compId).toLowerCase().includes('inventory')) {
                return { container };
            }
            if (String(compId).toLowerCase().includes('equippable')) {
                return equipComp;
            }
            return undefined;
        }),
        slots,
        equipment
    };

    return player as unknown as mc.Player & {
        slots: Map<number, mc.ItemStack>;
        equipment: Map<string, mc.ItemStack>;
    };
}

describe('staffInventoryManager & staffChat', () => {
    let getOrCreateSpy: any;
    let updateDataSpy: any;
    let hasPermSpy: any;

    beforeEach(() => {
        getOrCreateSpy = spyOn(playerDataManager, 'getOrCreatePlayer').mockReturnValue({
            name: 'StaffTester',
            balance: 0,
            homes: {},
            kits: {},
            cooldowns: {},
            tpaSettings: { autoAccept: false },
            pendingInvites: [],
            mailbox: []
        } as any);
        updateDataSpy = spyOn(playerDataManager, 'updatePlayerData').mockImplementation(() => {});
        hasPermSpy = spyOn(permissionEngine, 'hasPermission').mockReturnValue(true);
    });

    afterEach(() => {
        getOrCreateSpy?.mockRestore();
        updateDataSpy?.mockRestore();
        hasPermSpy?.mockRestore();
    });

    it('should preserve survival items, equipment, and XP levels when swapping to staff and back', () => {
        const player = createMockPlayer('staff1', 'AdminOne', mc.GameMode.Survival);
        playerDataManager.getOrCreatePlayer(player);

        const diamondSword = new mc.ItemStack(MinecraftItemTypes.DiamondSword, 1);
        const goldenApples = new mc.ItemStack(MinecraftItemTypes.GoldenApple, 16);
        const helmet = new mc.ItemStack(MinecraftItemTypes.NetheriteHelmet, 1);

        player.slots.set(0, diamondSword);
        player.slots.set(8, goldenApples);
        player.equipment.set('Head', helmet);

        // Swap to staff inventory
        const toStaff = toggleStaffInventory(player);
        expect(toStaff.success).toBe(true);
        expect(toStaff.switched).toBe(true);
        expect(player.slots.size).toBe(0);
        expect(player.equipment.size).toBe(0);
        expect(player.level).toBe(0);

        // Put a staff item in slot 4 while in staff inventory
        const bedrockItem = new mc.ItemStack(MinecraftItemTypes.Bedrock, 64);
        player.slots.set(4, bedrockItem);

        // Swap back to survival inventory
        const toSurvival = toggleStaffInventory(player);
        expect(toSurvival.success).toBe(true);
        expect(toSurvival.switched).toBe(true);

        expect(player.slots.get(0)?.typeId).toBe(MinecraftItemTypes.DiamondSword);
        expect(player.slots.get(8)?.typeId).toBe(MinecraftItemTypes.GoldenApple);
        expect(player.slots.get(8)?.amount).toBe(16);
        expect(player.slots.has(4)).toBe(false);
        expect(player.equipment.get('Head')?.typeId).toBe(MinecraftItemTypes.NetheriteHelmet);
        expect(player.level).toBe(15);

        // Swap to staff again and confirm staff item in slot 4 was also preserved
        swapStaffInventory(player, 'staff');
        expect(player.slots.get(4)?.typeId).toBe(MinecraftItemTypes.Bedrock);
        expect(player.slots.get(4)?.amount).toBe(64);
    });

    it('should auto-swap on gamemode change only when autoSwap is enabled', () => {
        const player = createMockPlayer('staff2', 'ModTwo', mc.GameMode.Survival);
        playerDataManager.getOrCreatePlayer(player);

        player.slots.set(2, new mc.ItemStack(MinecraftItemTypes.Emerald, 32));

        // Survival -> Creative triggers auto-swap to staff profile
        handleGameModeInventorySwap(player, mc.GameMode.Creative, mc.GameMode.Survival);
        expect(player.slots.size).toBe(0);

        // Disable auto-swap
        const autoState = toggleStaffAutoSwap(player);
        expect(autoState).toBe(false);

        // Creative -> Survival should NOT auto-swap while disabled
        handleGameModeInventorySwap(player, mc.GameMode.Survival, mc.GameMode.Creative);
        expect(player.slots.size).toBe(0);

        // Re-enable auto-swap and switch back to Survival
        toggleStaffAutoSwap(player);
        handleGameModeInventorySwap(player, mc.GameMode.Survival, mc.GameMode.Creative);
        expect(player.slots.get(2)?.typeId).toBe(MinecraftItemTypes.Emerald);
        expect(player.slots.get(2)?.amount).toBe(32);
    });

    it('should keep Staff Chat and Team Chat mutually exclusive when toggled', () => {
        const playerId = 'chatTester';
        expect(toggleStaffChat(playerId)).toBe(true);
        expect(isStaffChatEnabled(playerId)).toBe(true);

        // Toggling team chat on disables staff chat
        expect(toggleTeamChat(playerId)).toBe(true);
        expect(isTeamChatEnabled(playerId)).toBe(true);
        expect(isStaffChatEnabled(playerId)).toBe(false);

        // Toggling staff chat on disables team chat
        expect(toggleStaffChat(playerId)).toBe(true);
        expect(isStaffChatEnabled(playerId)).toBe(true);
        expect(isTeamChatEnabled(playerId)).toBe(false);
    });
});
