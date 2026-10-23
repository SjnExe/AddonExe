import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import { formatCurrency, parseCurrency } from '@core/utils/index.js';
import * as shopAdminManager from '@features/economy/shop/adminManager.js';
import { items as allItems } from '@features/economy/shop/itemsConfig.js';
import * as shopManager from '@features/economy/shop/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { EntityComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import { showConfirmationDialog } from '@ui/components.js';

const shopCommand: CustomCommand = {
    name: 'shop',
    description: 'Opens the server shop.',
    category: 'Economy',
    permissionNode: 'cmd.shop.member',
    allowConsole: false,
    execute: async (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        if (!isFeatureActive('eco.shop')) {
            // @ts-ignore (ignoring unused var)
            return executor.sendMessage('§cThe Shop system is currently disabled globally.');
        }
        await showPanel(executor, 'shopMainPanel', { view: 'shop' });
    }
};

const tryOpenHandItemPanel = async (player: mc.Player): Promise<boolean> => {
    const equipment = player.getComponent(EntityComponentTypes.Equippable);
    if (!isDefined(equipment)) {
        return false;
    }

    const item = equipment.getEquipment(mc.EquipmentSlot.Mainhand);
    if (!isDefined(item)) {
        return false;
    }

    const itemTypeId = item.typeId;
    const shopItemKey = Object.keys(allItems).find((key) => {
        const entry = (allItems as Record<string, { itemId: string }>)[key];
        return isDefined(entry) && entry.itemId === itemTypeId;
    });

    if (isNonEmptyString(shopItemKey)) {
        const itemData = shopManager.findShopItem(shopItemKey);
        if (isDefined(itemData)) {
            await showPanel(player, 'shopBuyOrSellPanel', { itemKey: shopItemKey, itemData, returnCtx: { returnTo: 'main', page: 1 } });
            return true;
        }
    }
    return false;
};

const buyCommand: CustomCommand = {
    name: 'buy',
    description: 'Opens the shop to buy items (tries hand item first).',
    category: 'Economy',
    permissionNode: 'cmd.buy.member',
    allowConsole: false,
    execute: async (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        if (!isFeatureActive('eco.shop')) {
            return executor.sendMessage('§cThe Shop system is currently disabled globally.');
        }

        const opened = await tryOpenHandItemPanel(executor);
        if (!opened) {
            await showPanel(executor, 'shopMainPanel', { view: 'buy' });
        }
    }
};

const sellCommand: CustomCommand = {
    name: 'sell',
    description: 'Opens the shop to sell items (tries hand item first).',
    category: 'Economy',
    permissionNode: 'cmd.sell.member',
    allowConsole: false,
    execute: async (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        if (!isFeatureActive('eco.shop')) {
            return executor.sendMessage('§cThe Shop system is currently disabled globally.');
        }

        const opened = await tryOpenHandItemPanel(executor);
        if (!opened) {
            await showPanel(executor, 'shopMainPanel', { view: 'sell' });
        }
    }
};

const sellHandCommand: CustomCommand = {
    name: 'sellhand',
    aliases: ['sh'],
    description: 'Quickly sells the stackable item in your main hand.',
    category: 'Economy',
    permissionNode: 'cmd.sell.member',
    allowConsole: false,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        if (!isFeatureActive('eco.shop')) {
            executor.sendMessage('§cThe Shop system is currently disabled globally.');
            return;
        }

        const equipment = executor.getComponent(EntityComponentTypes.Equippable);
        const heldItem = equipment?.getEquipment(mc.EquipmentSlot.Mainhand);
        if (!isDefined(heldItem)) {
            executor.sendMessage('§cYou are not holding an item in your main hand.');
            return;
        }

        if (heldItem.maxAmount <= 1) {
            executor.sendMessage('§cUnstackable items cannot be sold with /sellhand. Use /shop instead.');
            return;
        }

        const shopItemKey = Object.keys(allItems).find((key) => {
            const entry = (allItems as Record<string, { itemId: string }>)[key];
            return isDefined(entry) && entry.itemId === heldItem.typeId;
        });

        if (!isNonEmptyString(shopItemKey) || !isDefined(shopManager.findShopItem(shopItemKey))) {
            executor.sendMessage('§cThe item in your hand cannot be sold to the shop.');
            return;
        }

        const result = shopManager.sellItem(executor, shopItemKey, heldItem.amount);
        executor.sendMessage(result.message);
    }
};

const shopEditCommand: CustomCommand = {
    name: 'shopedit',
    description: 'Opens the shop management panel.',
    category: 'Economy',
    aliases: ['editshop'],
    permissionNode: 'cmd.shopedit.admin',
    allowConsole: false,
    execute: async (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        if (!isFeatureActive('eco.shop')) {
            return executor.sendMessage('§cThe Shop system is currently disabled globally.');
        }
        const { showShopManagementPanel } = await import('@features/economy/shop/ui/adminPanel.js');
        await showShopManagementPanel(executor, 1);
    }
};

interface AddShopCommandArgs {
    category: string;
    buyPrice: string;
    sellPrice: string;
    subCategory?: string;
}

const addShopCommand: CustomCommand = {
    name: 'addshop',
    description: 'Adds the item in your hand to a shop category.',
    category: 'Economy',
    permissionNode: 'cmd.addshop.admin', // Admins only
    allowConsole: false,
    parameters: [
        { name: 'category', type: 'string' },
        { name: 'buyPrice', type: 'string' },
        { name: 'sellPrice', type: 'string' },
        { name: 'subCategory', type: 'string', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player) || !isDefined(args)) {
            return;
        }

        if (!isFeatureActive('eco.shop')) {
            return executor.sendMessage('§cThe Shop system is currently disabled globally.');
        }

        const { category, buyPrice: buyPriceStr, sellPrice: sellPriceStr, subCategory } = args as unknown as AddShopCommandArgs;
        // @ts-ignore (ignoring unused var)

        if (!isNonEmptyString(buyPriceStr) || !isNonEmptyString(sellPriceStr)) {
            return executor.sendMessage('§cPlease specify buy and sell prices.');
        }

        const buyPrice = parseCurrency(buyPriceStr);
        const sellPrice = parseCurrency(sellPriceStr);

        if (Number.isNaN(buyPrice) || buyPrice < 0 || Number.isNaN(sellPrice) || sellPrice < 0) {
            return executor.sendMessage('§cInvalid prices. Please enter non-negative numbers.');
        }

        // Validate max 2 decimal places
        if (Math.abs(buyPrice - Number.parseFloat(buyPrice.toFixed(2))) > 0.001 || Math.abs(sellPrice - Number.parseFloat(sellPrice.toFixed(2))) > 0.001) {
            return executor.sendMessage('§cInvalid precision. Prices can only have up to 2 decimal places (e.g. 10.55).');
        }

        const equipment = executor.getComponent(EntityComponentTypes.Equippable);
        if (!isDefined(equipment)) {
            return executor.sendMessage('§cCould not access your inventory.');
        }
        const item = equipment.getEquipment(mc.EquipmentSlot.Mainhand);

        if (!isDefined(item)) {
            return executor.sendMessage("§cYou aren't holding anything.");
        }

        const result = shopAdminManager.addShopItemFromHand(item, category, isNonEmptyString(subCategory) ? subCategory : undefined, buyPrice, sellPrice);

        executor.sendMessage(result.message);

        if (result.success) {
            executor.sendMessage(`§aUse the panel to edit details for item ID: ${result.itemId}`);
        }
    }
};

const pendingSellAllConfirmations = new Map<string, number>();

const sellAllCommand: CustomCommand = {
    name: 'sellall',
    aliases: ['sa'],
    description: 'Sells all sellable shop items in your inventory (with confirmation).',
    category: 'Economy',
    permissionNode: 'cmd.sell.member',
    allowConsole: false,
    parameters: [
        {
            name: 'action',
            type: 'string',
            optional: true,
            enumOptions: ['confirm']
        }
    ],
    execute: async (executor: CommandExecutor, args: { action?: string }) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        if (!isFeatureActive('eco.shop')) {
            executor.sendMessage('§cThe Shop system is currently disabled globally.');
            return;
        }

        const preview = shopManager.previewSellAllInventory(executor);
        if (preview.totalItems === 0) {
            executor.sendMessage('§cYou have no sellable shop items in your inventory.');
            return;
        }

        if (args.action?.toLowerCase() === 'confirm') {
            pendingSellAllConfirmations.delete(executor.id);
            const result = shopManager.executeSellAllInventory(executor);
            executor.sendMessage(result.message);
            return;
        }

        pendingSellAllConfirmations.set(executor.id, Date.now() + 30_000);
        const topLines = preview.breakdown
            .slice(0, 8)
            .map((b) => `§7- §f${b.displayName} §ex${b.count} §7(§a${formatCurrency(b.payout)}§7)`)
            .join('\n');
        const extraLine = preview.breakdown.length > 8 ? `\n§8...and ${preview.breakdown.length - 8} more item types` : '';

        executor.sendMessage(`§e[Shop] Ready to sell §f${preview.totalItems}§e items for §a${formatCurrency(preview.totalPayout)}§e. Confirm in the popup or type §a/sellall confirm§e within 30s.`);

        await showConfirmationDialog(executor, {
            title: 'Confirm Sell All',
            body: `Sell §e${preview.totalItems}§f items (§b${preview.distinctTypes}§f types) for §a${formatCurrency(preview.totalPayout)}§f?\n\n${topLines}${extraLine}`,
            confirmButtonText: `§2Sell All (${formatCurrency(preview.totalPayout)})`,
            cancelButtonText: '§cCancel',
            onConfirm: () => {
                pendingSellAllConfirmations.delete(executor.id);
                const res = shopManager.executeSellAllInventory(executor);
                executor.sendMessage(res.message);
            },
            onCancel: () => {
                pendingSellAllConfirmations.delete(executor.id);
                executor.sendMessage('§eSell All cancelled.');
            }
        });
    }
};

export default [shopCommand, buyCommand, sellCommand, sellHandCommand, sellAllCommand, shopEditCommand, addShopCommand];
