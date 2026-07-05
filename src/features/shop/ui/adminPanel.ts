import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getConfig, updateMultipleConfig } from '@core/configManager.js';
import { getShopConfig } from '@core/configurations.js';
import { showPanel } from '@core/uiManager.js';
import * as shopAdminManager from '@features/shop/adminManager.js';
import { ShopCategory } from '@features/shop/shopConfig.js';
import { ensureItemsConfig, getAllItems, parseRankOverrides } from '@features/shop/utils.js';
import { isDefined, isNonEmptyString, isNumber, isString } from '@lib/guards.js';
import { showConfirmationDialog } from '@ui/components.js';
import { IPanelHandler, MainConfig, PanelItem, ShopItem, UIContext } from '@ui/types.js';
import { addBackButton, addPaginationItems, getPaginatedItems } from '@ui/uiUtils.js';

interface ShopCategoryEntry {
    type: 'subCategory';
    id: string;
    name: string;
    icon: string;
}

interface ShopItemEntry {
    type: 'item';
    id: string;
    icon?: string;
    displayName?: string;
    buyPrice: number;
    sellPrice: number;
    permission?: string;
}

type ShopEntry = ShopCategoryEntry | ShopItemEntry;

export class ShopAdminPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return (
            panelId === 'shopManagementPanel' ||
            panelId.startsWith('shopAdmin') ||
            panelId.startsWith('shopAddItem') ||
            panelId === 'addCategoryPanel' ||
            panelId === 'addSubCategoryPanel' ||
            panelId === 'editCategoryPanel' ||
            panelId === 'editSubCategoryPanel' ||
            panelId === 'addCustomItemPanel' ||
            panelId === 'addItemFromListPanel' ||
            panelId === 'editItemFormPanel'
        );
    }

    async getTitle(_player: mc.Player, panelId: string, context: UIContext): Promise<string | undefined> {
        await Promise.resolve();
        if (panelId.startsWith('shopAdminCategoryPanel_')) {
            const categoryName = context.categoryName as string;
            return `Manage ${categoryName}`;
        }
        if (panelId.startsWith('shopAdminSubCategoryItemPanel_')) {
            const subName = context.subCategoryName as string;
            return `Manage ${subName}`;
        }
        if (panelId.startsWith('shopAddItemPanel_')) {
            const categoryName = context.categoryName as string;
            return `Add Item to ${categoryName}`;
        }
        if (panelId.startsWith('shopAdminCategoryActionPanel_')) {
            const name = panelId.replace('shopAdminCategoryActionPanel_', '');
            return `Edit ${name}`;
        }
        if (panelId.startsWith('shopAdminSubCategoryActionPanel_')) {
            const name = panelId.replace('shopAdminSubCategoryActionPanel_', '');
            return `Edit ${name}`;
        }
        return undefined;
    }

    async getItems(_player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        await ensureItemsConfig();
        const page = isNumber(context.page) ? context.page : 1;

        if (panelId === 'shopManagementPanel') {
            return this.getShopManagementPanel(page);
        }

        if (panelId.startsWith('shopAdminCategoryPanel_')) {
            return this.getCategoryPanel(context, page);
        }

        if (panelId.startsWith('shopAdminSubCategoryItemPanel_')) {
            return this.getSubCategoryPanel(context, page);
        }

        if (panelId.startsWith('shopAddItemPanel_')) {
            return this.getAddItemPanel(context, page);
        }

        if (panelId.startsWith('shopAdminCategoryActionPanel_')) {
            return this.getCategoryActionPanel(panelId);
        }

        if (panelId.startsWith('shopAdminSubCategoryActionPanel_')) {
            return this.getSubCategoryActionPanel(panelId);
        }

        return [];
    }

    private getShopManagementPanel(page: number): PanelItem[] {
        const items: PanelItem[] = [];
        addBackButton(items, 'configCategoryPanel');
        const mainConfig = getConfig() as unknown as MainConfig;
        const isEnabled = mainConfig.shop.enabled;
        const toggleText = isEnabled ? '§2Shop System: ENABLED' : '§4Shop System: DISABLED';
        items.push(
            {
                id: 'toggleShop',
                text: toggleText,
                icon: isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel',
                permission: 'ui.panel.owner',
                actionType: 'functionCall',
                actionValue: 'toggleShop'
            },
            {
                id: 'addCategory',
                text: '§l§2+ Add Category',
                icon: 'textures/ui/color_plus',
                permission: 'ui.panel.owner',
                actionType: 'openPanel',
                actionValue: 'addCategoryPanel'
            }
        );

        const shopConfig = getShopConfig();
        const categories = Object.keys(shopConfig.categories).toSorted((a, b) => a.localeCompare(b));
        const paginated = getPaginatedItems(categories, page);

        for (const catName of paginated) {
            const cat = shopConfig.categories[catName];
            if (!isDefined(cat)) continue;
            items.push({
                id: catName,
                text: catName,
                icon: cat.icon,
                permission: 'ui.panel.owner',
                actionType: 'openPanel',
                actionValue: `shopAdminCategoryPanel_${catName}`
            });
        }
        addPaginationItems(items, page, categories.length);
        return items;
    }

    private generateShopEntries(category: ShopCategory): ShopEntry[] {
        const subCategories = Object.keys(category.subCategories).toSorted((a, b) => a.localeCompare(b));
        const shopItems = Object.keys(category.items);

        return [
            ...subCategories.map((n): ShopEntry => {
                const sub = category.subCategories[n];
                return {
                    id: n,
                    name: n,
                    type: 'subCategory',
                    icon: sub?.icon ?? ''
                };
            }),
            ...shopItems.map((n): ShopEntry => {
                const item = category.items[n];
                return {
                    id: n,
                    type: 'item',
                    ...(isNonEmptyString(item?.icon) ? { icon: item.icon } : {}),
                    ...(isNonEmptyString(item?.displayName) ? { displayName: item.displayName } : {}),
                    buyPrice: item?.buyPrice ?? -1,
                    sellPrice: item?.sellPrice ?? -1,
                    permission: item?.permission ?? 'ui.panel.member'
                };
            })
        ];
    }

    private getCategoryPanel(context: UIContext, page: number): PanelItem[] {
        const items: PanelItem[] = [];
        const categoryName = context.categoryName as string;
        addBackButton(items, 'shopManagementPanel');
        items.push(
            {
                id: 'addItem',
                text: '§l§2+ Add Item',
                icon: 'textures/ui/color_plus',
                permission: 'ui.panel.owner',
                actionType: 'openPanel',
                actionValue: `shopAddItemPanel_${categoryName}`
            },
            {
                id: 'addSubCategory',
                text: '§l§2+ Add Subcategory',
                icon: 'textures/ui/color_plus',
                permission: 'ui.panel.owner',
                actionType: 'openPanel',
                actionValue: 'addSubCategoryPanel'
            },
            {
                id: 'editCategory',
                text: '§l§1* Edit Category',
                icon: 'textures/ui/icon_setting',
                permission: 'ui.panel.owner',
                actionType: 'openPanel',
                actionValue: `shopAdminCategoryActionPanel_${categoryName}`
            }
        );

        const shopConfig = getShopConfig();
        const category = shopConfig.categories[categoryName];
        if (isDefined(category)) {
            const allEntries = this.generateShopEntries(category);
            const paginated = getPaginatedItems(allEntries, page);
            const allItems = getAllItems();

            for (const entry of paginated) {
                if (!isDefined(entry)) continue;
                if (entry.type === 'subCategory') {
                    const sub = category.subCategories[entry.id];
                    if (!isDefined(sub)) continue;
                    items.push({
                        id: entry.id,
                        text: `§6${entry.id}`,
                        icon: sub.icon,
                        permission: 'ui.panel.owner',
                        actionType: 'openPanel',
                        actionValue: `shopAdminSubCategoryItemPanel_${categoryName}_${entry.id}`
                    });
                } else {
                    const item = category.items[entry.id];
                    if (!isDefined(item)) continue;
                    const masterItem = allItems[entry.id] ?? {};
                    const icon = item.icon ?? masterItem.icon;
                    items.push({
                        id: entry.id,
                        text: item.displayName ?? masterItem.displayName ?? entry.id,
                        ...(isNonEmptyString(icon) ? { icon } : {}),
                        permission: 'ui.panel.owner',
                        actionType: 'functionCall',
                        actionValue: 'editItem'
                    });
                }
            }
            addPaginationItems(items, page, allEntries.length);
        }
        return items;
    }

    private getSubCategoryPanel(context: UIContext, page: number): PanelItem[] {
        const items: PanelItem[] = [];
        const categoryName = context.categoryName as string;
        const subCategoryName = context.subCategoryName as string;
        addBackButton(items, `shopAdminCategoryPanel_${categoryName}`);
        items.push(
            {
                id: 'addItem',
                text: '§l§2+ Add Item',
                icon: 'textures/ui/color_plus',
                permission: 'ui.panel.owner',
                actionType: 'openPanel',
                actionValue: `shopAddItemPanel_${categoryName}`
            },
            {
                id: 'editSubCategory',
                text: '§l§1* Edit Subcategory',
                icon: 'textures/ui/icon_setting',
                permission: 'ui.panel.owner',
                actionType: 'openPanel',
                actionValue: `shopAdminSubCategoryActionPanel_${subCategoryName}`
            }
        );

        const shopConfig = getShopConfig();
        const subCategory = shopConfig.categories[categoryName]?.subCategories[subCategoryName];
        if (isDefined(subCategory)) {
            const allItems = getAllItems();
            const shopItems = Object.keys(subCategory.items);
            const paginated = getPaginatedItems(shopItems, page);
            for (const id of paginated) {
                if (!isNonEmptyString(id)) continue;
                const item = (subCategory.items as Record<string, ShopItem>)[id];
                if (!isDefined(item)) continue;
                const masterItem = allItems[id] ?? {};
                const icon = item.icon ?? masterItem.icon;
                items.push({
                    id: id,
                    text: item.displayName ?? masterItem.displayName ?? id,
                    ...(isNonEmptyString(icon) ? { icon } : {}),
                    permission: 'ui.panel.owner',
                    actionType: 'functionCall',
                    actionValue: 'editItem'
                });
            }
            addPaginationItems(items, page, shopItems.length);
        }
        return items;
    }

    private getAddItemPanel(context: UIContext, page: number): PanelItem[] {
        const items: PanelItem[] = [];
        const categoryName = context.categoryName as string;
        addBackButton(items, `shopAdminCategoryPanel_${categoryName}`);
        items.push({
            id: 'addCustomItem',
            text: '§l§2+ Add Custom Item',
            icon: 'textures/ui/color_plus',
            permission: 'ui.panel.owner',
            actionType: 'openPanel',
            actionValue: 'addCustomItemPanel'
        });

        const allItems = getAllItems();
        const allPossibleItems = Object.keys(allItems);
        const paginated = getPaginatedItems(allPossibleItems, page);
        for (const itemId of paginated) {
            if (!isNonEmptyString(itemId)) continue;
            const masterItem = allItems[itemId];
            if (!isDefined(masterItem)) continue;
            items.push({
                id: itemId,
                text: masterItem.displayName ?? itemId,
                ...(isNonEmptyString(masterItem.icon) ? { icon: masterItem.icon } : {}),
                permission: 'ui.panel.owner',
                actionType: 'openPanel',
                actionValue: 'addItemFromListPanel'
            });
        }
        addPaginationItems(items, page, allPossibleItems.length);
        return items;
    }

    private getCategoryActionPanel(panelId: string): PanelItem[] {
        const items: PanelItem[] = [];
        const categoryName = panelId.replace('shopAdminCategoryActionPanel_', '');
        addBackButton(items, `shopAdminCategoryPanel_${categoryName}`);
        items.push(
            {
                id: 'edit',
                text: 'Edit',
                icon: 'textures/ui/icon_setting',
                permission: 'ui.panel.owner',
                actionType: 'openPanel',
                actionValue: 'editCategoryPanel'
            },
            {
                id: 'delete',
                text: '§4Delete',
                icon: 'textures/ui/trash',
                permission: 'ui.panel.owner',
                actionType: 'functionCall',
                actionValue: 'deleteCategory'
            }
        );
        return items;
    }

    private getSubCategoryActionPanel(panelId: string): PanelItem[] {
        const items: PanelItem[] = [];
        const subCategoryName = panelId.replace('shopAdminSubCategoryActionPanel_', '');
        addBackButton(items, `shopAdminSubCategoryItemPanel_${subCategoryName}`);
        items.push(
            {
                id: 'edit',
                text: 'Edit',
                icon: 'textures/ui/icon_setting',
                permission: 'ui.panel.owner',
                actionType: 'openPanel',
                actionValue: 'editSubCategoryPanel'
            },
            {
                id: 'delete',
                text: '§4Delete',
                icon: 'textures/ui/trash',
                permission: 'ui.panel.owner',
                actionType: 'functionCall',
                actionValue: 'deleteSubCategory'
            }
        );
        return items;
    }

    async buildModal(_player: mc.Player, panelId: string, context: UIContext): Promise<ModalFormData | undefined> {
        await ensureItemsConfig();

        if (panelId === 'addCategoryPanel') {
            return new ModalFormData().title('Add Category').textField('Category Name', 'Enter category name', { defaultValue: '' }).textField('Icon', 'Enter icon texture path', { defaultValue: '' });
        }
        if (panelId === 'addSubCategoryPanel') {
            return new ModalFormData()
                .title('Add Subcategory')
                .textField('Subcategory Name', 'Enter subcategory name', { defaultValue: '' })
                .textField('Icon', 'Enter icon texture path', { defaultValue: '' });
        }
        if (panelId === 'editCategoryPanel') {
            return this.buildEditCategoryModal(context);
        }

        if (panelId === 'editSubCategoryPanel') {
            return this.buildEditSubCategoryModal(context);
        }

        if (panelId === 'addCustomItemPanel') {
            return new ModalFormData()
                .title('Add Custom Item')
                .textField('Item ID (unique key)', 'e.g., custom_sword')
                .textField('Display Name', 'e.g., Sword of Awesome')
                .textField('Minecraft Item ID', 'e.g., minecraft:diamond_sword')
                .textField('Icon Path', 'e.g., textures/items/diamond_sword')
                .textField('Buy Price', '-1 to disable', { defaultValue: '-1' })
                .textField('Sell Price', '-1 to disable', { defaultValue: '-1' })
                .textField('Permission Node', 'e.g., ui.panel.member', { defaultValue: 'ui.panel.member' })
                .textField('Rank Multipliers (rank=buy,sell;)', 'e.g., vip=0.8,1.2', { defaultValue: '' });
        }

        if (panelId === 'addItemFromListPanel') {
            return this.buildAddItemFromListModal(context);
        }

        if (panelId === 'editItemFormPanel') {
            return this.buildEditItemFormModal(context);
        }

        return undefined;
    }

    private buildEditCategoryModal(context: UIContext): ModalFormData | undefined {
        let targetName = context.categoryName as string;
        if (!isNonEmptyString(targetName) && isString(context.id) && context.id.startsWith('shopAdminCategoryActionPanel_')) {
            targetName = context.id.replace('shopAdminCategoryActionPanel_', '');
        }
        const shopConfig = getShopConfig();
        const category = shopConfig.categories[targetName];
        if (!isDefined(category)) return undefined;
        return new ModalFormData()
            .title('Edit Category')
            .textField('Category Name', 'Enter new name', { defaultValue: targetName })
            .textField('Icon', 'Enter icon texture path', { defaultValue: category.icon });
    }

    private buildEditSubCategoryModal(context: UIContext): ModalFormData | undefined {
        const targetName = isString(context.id) ? context.id.replace('shopAdminSubCategoryActionPanel_', '') : '';
        const { categoryName } = context;
        const shopConfig = getShopConfig();
        const subCategory = shopConfig.categories[categoryName as string]?.subCategories[targetName];
        if (!isDefined(subCategory)) return undefined;
        return new ModalFormData()
            .title('Edit Subcategory')
            .textField('Subcategory Name', 'Enter new name', { defaultValue: targetName })
            .textField('Icon', 'Enter icon texture path', { defaultValue: subCategory.icon });
    }

    private buildAddItemFromListModal(context: UIContext): ModalFormData | undefined {
        const allItems = getAllItems();
        const itemId = context.selectedItemId as string;
        const masterItem = allItems[itemId];
        if (!isDefined(masterItem)) return undefined;

        // Serialize overrides for the text field
        let overridesStr = '';
        if (isDefined(masterItem.rankMultiplierOverrides)) {
            overridesStr = Object.entries(masterItem.rankMultiplierOverrides)
                .map(([rankId, multipliers]) => `${rankId}=${multipliers.buy},${multipliers.sell}`)
                .join('; ');
        }

        return new ModalFormData()
            .title(`Add ${String(masterItem.displayName ?? itemId)}`)
            .textField('Icon Path', 'e.g., textures/items/diamond_sword', {
                defaultValue: String(masterItem.icon ?? '')
            })
            .textField('Buy Price', '-1 to disable', { defaultValue: String(masterItem.buyPrice ?? -1) })
            .textField('Sell Price', '-1 to disable', { defaultValue: String(masterItem.sellPrice ?? -1) })
            .textField('Permission Node', 'e.g., ui.panel.member', { defaultValue: 'ui.panel.member' })
            .textField('Rank Multipliers (rank=buy,sell;)', 'e.g., vip=0.8,1.2', { defaultValue: overridesStr });
    }

    private buildEditItemFormModal(context: UIContext): ModalFormData | undefined {
        const itemId = context.selectedItemId as string;
        const categoryName = context.categoryName as string;
        const subCategoryName = context.subCategoryName as string | undefined;
        const shopConfig = getShopConfig();
        const shopItem = isNonEmptyString(subCategoryName) ? shopConfig.categories[categoryName]?.subCategories[subCategoryName]?.items[itemId] : shopConfig.categories[categoryName]?.items[itemId];

        if (!isDefined(shopItem)) return undefined;

        // Serialize overrides for the text field
        let overridesStr = '';
        if (isDefined(shopItem.rankMultiplierOverrides)) {
            overridesStr = Object.entries(shopItem.rankMultiplierOverrides)
                .map(([rankId, multipliers]) => `${rankId}=${multipliers.buy},${multipliers.sell}`)
                .join('; ');
        }

        return new ModalFormData()
            .title(`Edit Item: ${String(itemId)}`)
            .textField('Display Name', 'Name', {
                defaultValue: isNonEmptyString(shopItem.displayName) ? shopItem.displayName : ''
            })
            .textField('Minecraft ID', 'ID', {
                defaultValue: isNonEmptyString(shopItem.itemId) ? shopItem.itemId : ''
            })
            .textField('Icon', 'Icon', { defaultValue: isNonEmptyString(shopItem.icon) ? shopItem.icon : '' })
            .textField('Buy Price', 'Price', { defaultValue: String(shopItem.buyPrice) })
            .textField('Sell Price', 'Price', { defaultValue: String(shopItem.sellPrice) })
            .textField('Permission Node', 'ui.panel.member', { defaultValue: shopItem.permission })
            .textField('Rank Multipliers (rank=buy,sell;)', 'e.g., vip=0.8,1.2', { defaultValue: overridesStr });
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: UIContext): Promise<void> {
        const selection = (response as ActionFormResponse).selection;

        await ensureItemsConfig();

        if (panelId === 'addCategoryPanel') {
            return this.handleAddCategoryResponse(player, response, context);
        }

        if (panelId === 'addSubCategoryPanel') {
            return this.handleAddSubCategoryResponse(player, response, context);
        }

        if (panelId === 'editCategoryPanel') {
            return this.handleEditCategoryResponse(player, response, context);
        }

        if (panelId === 'editSubCategoryPanel') {
            return this.handleEditSubCategoryResponse(player, response, context);
        }

        if (panelId === 'addCustomItemPanel') {
            return this.handleAddCustomItemResponse(player, response, context);
        }

        if (panelId === 'addItemFromListPanel') {
            return this.handleAddItemFromListResponse(player, response, context);
        }

        if (panelId === 'editItemFormPanel') {
            return this.handleEditItemFormResponse(player, response, context);
        }

        if (isNumber(selection)) {
            return this.handleActionSelection(player, panelId, selection, context);
        }
    }

    private async handleAddCategoryResponse(player: mc.Player, response: ModalFormResponse, context: UIContext): Promise<void> {
        if (response.canceled) return showPanel(player, 'shopManagementPanel', context);
        const values = response.formValues as string[] | undefined;
        if (!isDefined(values)) return showPanel(player, 'shopManagementPanel', context);
        const name = values[0];
        const iconStr = values[1];
        if (isNonEmptyString(name)) {
            const result = shopAdminManager.addCategory(name, iconStr ?? '');
            player.sendMessage(result.message);
        }
        return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
    }

    private async handleAddSubCategoryResponse(player: mc.Player, response: ModalFormResponse, context: UIContext): Promise<void> {
        const categoryName = context.categoryName as string;
        if (response.canceled) return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
        const values = response.formValues as string[] | undefined;
        if (!isDefined(values)) return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
        const name = values[0];
        const iconStr = values[1];
        if (isNonEmptyString(name)) {
            const result = shopAdminManager.addSubCategory(categoryName, name, iconStr ?? '');
            player.sendMessage(result.message);
        }
        return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
    }

    private async handleEditCategoryResponse(player: mc.Player, response: ModalFormResponse, context: UIContext): Promise<void> {
        let targetName = context.categoryName as string;
        if (!isNonEmptyString(targetName) && isString(context.id) && context.id.startsWith('shopAdminCategoryActionPanel_')) {
            targetName = context.id.replace('shopAdminCategoryActionPanel_', '');
        }
        if (response.canceled) return showPanel(player, `shopAdminCategoryActionPanel_${targetName}`, context);

        const values = response.formValues as string[] | undefined;
        if (!isDefined(values)) return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
        const newName = values[0];
        const newIcon = values[1];
        if (isNonEmptyString(newName)) {
            const result = shopAdminManager.editCategory(targetName, newName, newIcon ?? '');
            player.sendMessage(result.message);
        }
        return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
    }

    private async handleEditSubCategoryResponse(player: mc.Player, response: ModalFormResponse, context: UIContext): Promise<void> {
        const targetName = isString(context.id) ? context.id.replace('shopAdminSubCategoryActionPanel_', '') : '';
        const categoryName = context.categoryName as string;
        if (response.canceled) return showPanel(player, `shopAdminSubCategoryActionPanel_${targetName}`, context);

        const values = response.formValues as string[] | undefined;
        if (!isDefined(values)) return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        const newName = values[0];
        const newIcon = values[1];
        if (isNonEmptyString(newName)) {
            const result = shopAdminManager.editSubCategory(categoryName, targetName, newName, newIcon ?? '');
            player.sendMessage(result.message);
        }
        return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
    }

    private async handleAddCustomItemResponse(player: mc.Player, response: ModalFormResponse, context: UIContext): Promise<void> {
        const categoryName = context.categoryName as string;
        if (response.canceled) return showPanel(player, `shopAddItemPanel_${categoryName}`, context);

        const values = response.formValues as string[] | undefined;
        if (!isDefined(values)) return showPanel(player, `shopAddItemPanel_${categoryName}`, context);
        const customId = values[0];
        const displayName = values[1];
        const mcId = values[2];
        const iconStr = values[3];
        const buyPriceStr = values[4];
        const sellPriceStr = values[5];
        const permLevelStr = values[6];
        const overridesRaw = values[7] ?? '';

        const icon = iconStr;
        const buyPrice = Number.parseInt(isNonEmptyString(buyPriceStr) ? buyPriceStr : '-1', 10);
        const sellPrice = Number.parseInt(isNonEmptyString(sellPriceStr) ? sellPriceStr : '-1', 10);
        const permission = isNonEmptyString(permLevelStr) ? permLevelStr : 'ui.panel.member';

        const parsedOverrides = parseRankOverrides(overridesRaw);

        if (isNonEmptyString(customId) && isNonEmptyString(displayName) && isNonEmptyString(mcId) && !Number.isNaN(buyPrice)) {
            shopAdminManager.addCustomItemToConfig(customId, {
                itemId: mcId,
                icon: icon ?? '',
                buyPrice,
                sellPrice,
                displayName,
                rankMultiplierOverrides: parsedOverrides
            });
            shopAdminManager.setItem(context.categoryName as string, (context.subCategoryName as string) || undefined, customId, {
                buyPrice,
                sellPrice,
                permission,
                icon: icon ?? '',
                displayName,
                itemId: customId,
                rankMultiplierOverrides: parsedOverrides
            });
            player.sendMessage(`§2Added ${displayName}.`);
        }
        const subName = context.subCategoryName as string | undefined;
        const parent = isNonEmptyString(subName) ? `shopAdminSubCategoryItemPanel_${subName}` : `shopAdminCategoryPanel_${context.categoryName as string}`;
        return showPanel(player, parent, { ...context, page: 1 });
    }

    private async handleAddItemFromListResponse(player: mc.Player, response: ModalFormResponse, context: UIContext): Promise<void> {
        const allItems = getAllItems();
        const categoryName = context.categoryName as string;
        if (response.canceled) return showPanel(player, `shopAddItemPanel_${categoryName}`, context);

        const itemId = context.selectedItemId as string;
        const masterItem = allItems[itemId];
        const values = response.formValues as string[] | undefined;
        if (!isDefined(values)) return showPanel(player, `shopAddItemPanel_${categoryName}`, context);

        const iconStr = values[0];
        const buyPriceStr = values[1];
        const sellPriceStr = values[2];
        const permLevelStr = values[3];
        const overridesRaw = values[4] ?? '';

        const icon = iconStr;
        const buyPrice = Number.parseInt(isNonEmptyString(buyPriceStr) ? buyPriceStr : '-1', 10);
        const sellPrice = Number.parseInt(isNonEmptyString(sellPriceStr) ? sellPriceStr : '-1', 10);
        const permission = isNonEmptyString(permLevelStr) ? permLevelStr : 'ui.panel.member';

        const parsedOverrides = parseRankOverrides(overridesRaw);

        if (!Number.isNaN(buyPrice) && isDefined(masterItem)) {
            shopAdminManager.setItem(context.categoryName as string, (context.subCategoryName as string) || undefined, itemId, {
                buyPrice,
                sellPrice,
                permission,
                icon: icon ?? '',
                displayName: masterItem.displayName ?? '',
                itemId: itemId,
                rankMultiplierOverrides: parsedOverrides
            });
            player.sendMessage(`§2Added ${masterItem.displayName}.`);
        }
        const subName = context.subCategoryName as string | undefined;
        const parent = isNonEmptyString(subName) ? `shopAdminSubCategoryItemPanel_${subName}` : `shopAdminCategoryPanel_${context.categoryName as string}`;
        return showPanel(player, parent, { ...context, page: 1 });
    }

    private async handleEditItemFormResponse(player: mc.Player, response: ModalFormResponse, context: UIContext): Promise<void> {
        const itemId = context.selectedItemId as string;
        const categoryName = context.categoryName as string;
        const subCategoryName = context.subCategoryName as string | undefined;

        const parent = isNonEmptyString(subCategoryName) ? `shopAdminSubCategoryItemPanel_${subCategoryName}` : `shopAdminCategoryPanel_${categoryName}`;

        if (response.canceled) return showPanel(player, parent, context);

        const vals = response.formValues as string[] | undefined;
        if (!isDefined(vals)) return showPanel(player, parent, context);

        const dName = vals[0] ?? undefined;
        const mId = vals[1] ?? undefined;
        const icon = vals[2] ?? undefined;
        const bPrice = vals[3] ?? undefined;
        const sPrice = vals[4] ?? undefined;
        const pLevel = vals[5];
        const overridesRaw = vals[6] ?? '';

        const parsedOverrides = parseRankOverrides(overridesRaw);

        shopAdminManager.updateShopItem(categoryName, subCategoryName ?? undefined, itemId, {
            buyPrice: isDefined(bPrice) ? Number(bPrice) : -1,
            sellPrice: isDefined(sPrice) ? Number(sPrice) : -1,
            permission: pLevel ?? 'ui.panel.member',
            icon: icon ?? '',
            minecraftId: mId ?? itemId,
            displayName: dName ?? itemId,
            rankOverrides: parsedOverrides
        });
        player.sendMessage('§2Item updated.');
        return showPanel(player, parent, context);
    }

    private async handleActionSelection(player: mc.Player, panelId: string, selection: number, context: UIContext): Promise<void> {
        const items = await this.getItems(player, panelId, context);
        if (selection < 0 || selection >= items.length) return;

        const item = items[selection];
        if (!isDefined(item)) return;

        if (item.actionType === 'openPanel') {
            return showPanel(player, item.actionValue, {
                ...context,
                page: 1,
                selectedItemId: item.id,
                id: item.id
            });
        }

        await this.handleStaticAction(player, panelId, item, context);
    }

    private async handleStaticAction(player: mc.Player, panelId: string, item: PanelItem, context: UIContext): Promise<void> {
        if (item.actionValue === 'prevPage') {
            const currentPage = isNumber(context.page) ? context.page : 1;
            return showPanel(player, panelId, {
                ...context,
                page: Math.max(1, currentPage - 1)
            });
        }
        if (item.actionValue === 'nextPage') {
            const currentPage = isNumber(context.page) ? context.page : 1;
            return showPanel(player, panelId, { ...context, page: currentPage + 1 });
        }

        if (item.actionValue === 'toggleShop') {
            const mainConfig = getConfig() as unknown as MainConfig;
            const newStatus = !mainConfig.shop.enabled;
            updateMultipleConfig({ 'shop.enabled': newStatus });
            player.sendMessage(`§2Shop system has been ${newStatus ? 'enabled' : 'disabled'}.`);
            return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
        }

        if (item.actionValue === 'deleteCategory') {
            return this.handleDeleteCategory(player, panelId, context);
        }

        if (item.actionValue === 'deleteSubCategory') {
            return this.handleDeleteSubCategory(player, panelId, context);
        }

        if (item.actionValue === 'editItem') {
            return this.handleEditItemAction(player, panelId, item, context);
        }
    }

    private async handleDeleteCategory(player: mc.Player, panelId: string, context: UIContext): Promise<void> {
        const targetName = panelId.replace('shopAdminCategoryActionPanel_', '');
        await showConfirmationDialog(player, {
            title: 'Confirm Deletion',
            body: 'Are you sure?',
            confirmButtonText: '§4Yes, Delete',
            cancelButtonText: '§2No, Cancel',
            onConfirm: () => {
                const result = shopAdminManager.deleteCategory(targetName);
                player.sendMessage(result.message);
                return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
            },
            onCancel: () => showPanel(player, panelId, context)
        });
    }

    private async handleDeleteSubCategory(player: mc.Player, panelId: string, context: UIContext): Promise<void> {
        const targetName = panelId.replace('shopAdminSubCategoryActionPanel_', '');
        const { categoryName } = context;
        await showConfirmationDialog(player, {
            title: 'Confirm Deletion',
            body: 'Are you sure?',
            confirmButtonText: '§4Yes, Delete',
            cancelButtonText: '§2No, Cancel',
            onConfirm: () => {
                const result = shopAdminManager.deleteSubCategory(categoryName as string, targetName);
                player.sendMessage(result.message);
                return showPanel(player, `shopAdminCategoryPanel_${categoryName as string}`, {
                    ...context,
                    page: 1
                });
            },
            onCancel: () => showPanel(player, panelId, context)
        });
    }

    private async handleEditItemAction(player: mc.Player, panelId: string, item: PanelItem, context: UIContext): Promise<void> {
        const actionForm = new ActionFormData().title('Edit Item').button('Edit', 'textures/ui/icon_setting').button('Delete', 'textures/ui/trash');

        const actionRes = await actionForm.show(player);
        if (actionRes.canceled) return showPanel(player, panelId, context);

        if (actionRes.selection === 0) {
            return showPanel(player, 'editItemFormPanel', {
                ...context,
                selectedItemId: item.id
            });
        } else if (actionRes.selection === 1) {
            shopAdminManager.removeItem(context.categoryName as string, (context.subCategoryName as string) || undefined, item.id);
            player.sendMessage('§2Item removed.');
            return showPanel(player, panelId, context);
        }
    }
}
