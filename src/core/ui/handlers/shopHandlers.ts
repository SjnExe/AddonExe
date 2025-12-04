import * as mc from '@minecraft/server';
import { ActionFormResponse, ActionFormData, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import * as shopAdminManager from '../../../features/shop/shopAdminManager.js';
import * as shopManager from '../../../features/shop/shopManager.js';
import { getConfig } from '../../configManager.js';
import { getShopConfig } from '../../configurations.js';
import { items as allItems } from '../../itemsConfig.default.js';
import { showPanel } from '../../uiManager.js';
import * as utils from '../../utils.js';
import { showConfirmationDialog } from '../components.js';
import { UIContext } from '../panelRegistry.js';
import { itemsPerPage, getPaginatedItems } from '../uiUtils.js';

export async function handleShopPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const selection = (response as ActionFormResponse).selection;

    // --- Shop Panel Handlers ---
    if (panelId === 'shopMainPanel') {
        if (selection === 0) {
            return showPanel(player, 'mainPanel');
        }
        if (typeof selection !== 'number') return;

        const shopConfig = getShopConfig();

        const validCategories = Object.keys(shopConfig.categories)
            .filter((categoryName: string) => {
                const category = shopConfig.categories[categoryName];
                const hasItems = Object.keys(category.items).length > 0;
                const hasSubCategories = Object.keys(category.subCategories).length > 0;
                return hasItems || hasSubCategories;
            })
            .sort();
        const selectedCategoryName = validCategories[selection - 1];
        if (selectedCategoryName) {
            return showPanel(player, `shopCategoryPanel_${selectedCategoryName}`, {
                ...context,
                categoryName: selectedCategoryName
            });
        }
        return;
    }

    if (panelId.startsWith('shopCategoryPanel_') || panelId.startsWith('shopItemListPanel_')) {
        const isItemList = panelId.startsWith('shopItemListPanel_');
        const prefix = isItemList ? 'shopItemListPanel_' : 'shopCategoryPanel_';
        const rawId = panelId.replace(prefix, '');
        const parts = rawId.split('_');
        const categoryName = parts[0];
        const subCategoryName = isItemList ? parts.slice(1).join('_') : undefined;
        const page = context.page || 1;
        const view = context.view || 'shop';

        if (selection === 0) {
            // Back button
            const parentPanel = isItemList ? `shopCategoryPanel_${categoryName}` : 'shopMainPanel';
            return showPanel(player, parentPanel, { ...context, page: 1 });
        }

        // Reconstruct the list of entries that was shown to the player
        const shopConfig = getShopConfig();
        const category = shopConfig.categories[categoryName];
        let allEntries: { type: string }[] = [];
        if (isItemList && subCategoryName) {
            const subCategory = category.subCategories[subCategoryName];
            allEntries = Object.keys(subCategory.items).map((id) => ({ id, ...subCategory.items[id], type: 'item' }));
        } else {
            // shopCategoryPanel
            const subCategories = Object.keys(category.subCategories)
                .sort()
                .map((name) => ({ name, ...category.subCategories[name], type: 'subCategory' }));
            const items = Object.keys(category.items).map((id) => ({ id, ...category.items[id], type: 'item' }));
            allEntries = [...subCategories, ...items];
        }

        const paginatedEntries = getPaginatedItems(allEntries, page);
        const selectionIndex = selection && selection > 0 ? selection - 1 : -1;

        // Handle pagination
        if (selectionIndex >= paginatedEntries.length) {
            let newPage = page;
            const totalPages = Math.ceil(allEntries.length / itemsPerPage);
            const hasPrev = page > 1;
            const hasNext = page < totalPages;
            const buttonIndex = selectionIndex - paginatedEntries.length;

            if (hasPrev && buttonIndex === 0) {
                newPage--;
            } else if (hasNext) {
                newPage++;
            }
            return showPanel(player, panelId, { ...context, page: newPage });
        }

        const selectedEntry =
            selectionIndex >= 0
                ? (paginatedEntries[selectionIndex] as {
                      type: string;
                      name: string;
                      id: string;
                      buyPrice: number;
                      sellPrice: number;
                  })
                : undefined;

        if (selectedEntry && selectedEntry.type === 'subCategory') {
            return showPanel(player, `shopItemListPanel_${categoryName}_${selectedEntry.name}`, {
                ...context,
                categoryName,
                subCategoryName: selectedEntry.name,
                page: 1
            });
        }

        // It's an item
        if (selectedEntry) {
            const itemId = selectedEntry.id;
            const masterItem = allItems[itemId];
            const shopItem = selectedEntry;

            const canBuy = view !== 'sell' && shopItem.buyPrice > 0;
            const canSell = view !== 'buy' && shopItem.sellPrice > 0;

            if (!canBuy && !canSell) {
                player.sendMessage('§4This item cannot be bought or sold currently.');
                return showPanel(player, panelId, context);
            }

            const modal = new ModalFormData().title(masterItem.displayName ?? itemId);
            let action;
            let hasDropdown = false;

            if (canBuy && canSell) {
                modal.textField('Amount', 'Enter the amount', { defaultValue: '1' });
                const options = [`Buy ($${shopItem.buyPrice})`, `Sell ($${shopItem.sellPrice})`];
                modal.dropdown('Action', options, { defaultValueIndex: 0 });
                hasDropdown = true;
            } else if (canBuy) {
                modal.textField(`Amount to Buy (Price: $${shopItem.buyPrice})`, 'Enter a numeric value', {
                    defaultValue: '1'
                });
                action = 'buy';
            } else {
                // canSell
                modal.textField(`Amount to Sell (Price: $${shopItem.sellPrice})`, 'Enter a numeric value', {
                    defaultValue: '1'
                });
                action = 'sell';
            }

            const modalResponse = await utils.uiWait(player, modal);

            if (modalResponse.canceled) {
                return showPanel(player, panelId, context);
            }

            let amount;
            if (hasDropdown) {
                const values = (modalResponse as ModalFormResponse).formValues as [string, number];
                const amountStr = values[0];
                const actionIndex = values[1];
                amount = parseInt(amountStr, 10);
                const options = [`Buy ($${shopItem.buyPrice})`, `Sell ($${shopItem.sellPrice})`];
                const selectedActionString = options[actionIndex];
                action = selectedActionString.startsWith('Buy') ? 'buy' : 'sell';
            } else {
                const values = (modalResponse as ModalFormResponse).formValues as [string];
                const amountStr = values[0];
                amount = parseInt(amountStr, 10);
            }

            if (isNaN(amount) || amount <= 0) {
                player.sendMessage('§4Invalid amount.');
                return showPanel(player, panelId, context);
            }

            let result;
            if (action === 'buy') {
                result = shopManager.buyItem(player, itemId, amount);
            } else {
                // action === 'sell'
                result = shopManager.sellItem(player, itemId, amount);
            }
            player.sendMessage(result.message);

            return showPanel(player, panelId, context); // Refresh the panel
        }
    }

    // --- Admin Edit Shop Panel Handlers ---
    if (panelId.startsWith('shopAddItemPanel_')) {
        const { categoryName, page = 1 } = context;
        if (selection === 0) {
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
        }

        if (selection === 1) {
            // Add Custom Item
            const form = new ModalFormData()
                .title('Add Custom Item')
                .textField('Item ID (unique key)', 'e.g., custom_sword')
                .textField('Display Name', 'e.g., Sword of Awesome')
                .textField('Minecraft Item ID', 'e.g., minecraft:diamond_sword')
                .textField('Icon Path', 'e.g., textures/items/diamond_sword')
                .textField('Buy Price', '-1 to disable', { defaultValue: '-1' })
                .textField('Sell Price', '-1 to disable', { defaultValue: '-1' })
                .textField('Permission Level', 'e.g., 1024', { defaultValue: '1024' });
            const addItemResponse = await utils.uiWait(player, form);
            if (addItemResponse.canceled) {
                return showPanel(player, panelId, context);
            }
            const values = (addItemResponse as ModalFormResponse).formValues;
            if (!values) return;
            const customId = values[0] as string;
            const displayName = values[1] as string;
            const mcId = values[2] as string;
            const iconStr = values[3] as string;
            const buyPriceStr = values[4] as string;
            const sellPriceStr = values[5] as string;
            const permLevelStr = values[6] as string;

            const icon = iconStr || '';
            const buyPrice = parseInt(buyPriceStr, 10);
            const sellPrice = parseInt(sellPriceStr, 10);
            const permissionLevel = parseInt(permLevelStr, 10);

            if (
                customId &&
                displayName &&
                mcId &&
                icon &&
                !isNaN(buyPrice) &&
                !isNaN(sellPrice) &&
                !isNaN(permissionLevel)
            ) {
                shopAdminManager.addCustomItemToConfig(customId, {
                    itemId: mcId,
                    icon,
                    buyPrice,
                    sellPrice,
                    displayName
                });
                shopAdminManager.setItem(categoryName, null, customId, {
                    buyPrice,
                    sellPrice,
                    permissionLevel,
                    icon,
                    displayName,
                    itemId: customId // ADDED
                });
                player.sendMessage(`§2Successfully added custom item '${displayName}'.`);
            } else {
                player.sendMessage('§4Invalid custom item data.');
            }
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        }

        const allPossibleItems = Object.keys(allItems);
        const paginatedItems = getPaginatedItems(allPossibleItems, page);
        const selectedItemId = selection && selection > 1 ? paginatedItems[selection - 2] : undefined;

        if (selectedItemId) {
            const masterItem = allItems[selectedItemId];
            const form = new ModalFormData()
                .title(`Add ${masterItem.displayName}`)
                .textField('Icon Path', 'e.g., textures/items/diamond_sword', { defaultValue: masterItem.icon })
                .textField('Buy Price', '-1 to disable', { defaultValue: `${masterItem.buyPrice}` })
                .textField('Sell Price', '-1 to disable', { defaultValue: `${masterItem.sellPrice}` })
                .textField('Permission Level', 'e.g., 1024', { defaultValue: '1024' });
            const addItemResponse = await utils.uiWait(player, form);
            if (addItemResponse.canceled) {
                return showPanel(player, panelId, context);
            }
            const values = (addItemResponse as ModalFormResponse).formValues;
            if (!values) return;
            const iconStr = values[0] as string;
            const buyPriceStr = values[1] as string;
            const sellPriceStr = values[2] as string;
            const permLevelStr = values[3] as string;

            const icon = iconStr || '';
            const buyPrice = parseInt(buyPriceStr, 10);
            const sellPrice = parseInt(sellPriceStr, 10);
            const permissionLevel = parseInt(permLevelStr, 10);
            if (!isNaN(buyPrice) && !isNaN(sellPrice) && !isNaN(permissionLevel)) {
                const result = shopAdminManager.setItem(categoryName, null, selectedItemId, {
                    buyPrice,
                    sellPrice,
                    permissionLevel,
                    icon,
                    itemId: selectedItemId, // ADDED
                    displayName: masterItem.displayName || '' // ADDED
                });
                player.sendMessage(result.message);
            }
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        }
        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(allPossibleItems.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        const buttonIndex = selection && selection > 1 ? selection - 2 - paginatedItems.length : -1;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId === 'shopManagementPanel') {
        const page = context.page || 1;
        if (selection === 0) {
            return showPanel(player, 'configCategoryPanel');
        }

        if (selection === 1) {
            const mainConfig = getConfig();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newStatus = !(mainConfig as any).shop.enabled;
            // TODO: import updateMultipleConfig if needed
            const { updateMultipleConfig } = await import('../../configManager.js');
            updateMultipleConfig({ 'shop.enabled': newStatus });
            player.sendMessage(`§2Shop system has been ${newStatus ? 'enabled' : 'disabled'}.`);
            return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
        }

        if (selection === 2) {
            // Add Category
            const form = new ModalFormData()
                .title('Add Category')
                .textField('Category Name', 'Enter category name', { defaultValue: '' })
                .textField('Icon', 'Enter icon texture path', { defaultValue: '' });
            const addCatResponse = await utils.uiWait(player, form);
            if (addCatResponse.canceled) {
                return showPanel(player, panelId, context);
            }
            const values = (addCatResponse as ModalFormResponse).formValues;
            if (!values) return;
            const name = values[0] as string;
            const iconStr = values[1] as string;

            if (name) {
                const result = shopAdminManager.addCategory(name, iconStr || '');
                player.sendMessage(result.message);
            }
            return showPanel(player, panelId, { ...context, page: 1 });
        }

        const shopConfig = getShopConfig();
        const categories = Object.keys(shopConfig.categories).sort();
        const paginatedCategories = getPaginatedItems(categories, page);
        const selectedCategoryName = selection && selection > 2 ? paginatedCategories[selection - 3] : undefined;

        if (selectedCategoryName) {
            return showPanel(player, `shopAdminCategoryPanel_${selectedCategoryName}`, {
                categoryName: selectedCategoryName
            });
        }
        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(categories.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        const buttonIndex = selection && selection > 2 ? selection - 3 - paginatedCategories.length : -1;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId.startsWith('shopAdminCategoryPanel_')) {
        const { categoryName, page = 1 } = context;
        if (selection === 0) {
            return showPanel(player, 'shopManagementPanel');
        }
        if (selection === 1) {
            // Add Item
            return showPanel(player, `shopAddItemPanel_${categoryName}`, context);
        }
        if (selection === 2) {
            // Add Subcategory
            const form = new ModalFormData()
                .title('Add Subcategory')
                .textField('Subcategory Name', 'Enter subcategory name', { defaultValue: '' })
                .textField('Icon', 'Enter icon texture path', { defaultValue: '' });
            const addSubCatResponse = await utils.uiWait(player, form);
            if (addSubCatResponse.canceled) {
                return showPanel(player, panelId, context);
            }
            const values = (addSubCatResponse as ModalFormResponse).formValues;
            if (!values) return;
            const name = values[0] as string;
            const iconStr = values[1] as string;

            if (name) {
                const result = shopAdminManager.addSubCategory(categoryName, name, iconStr || '');
                player.sendMessage(result.message);
            }
            return showPanel(player, panelId, { ...context, page: 1 });
        }
        if (selection === 3) {
            // Edit Category
            return showPanel(player, `shopAdminCategoryActionPanel_${categoryName}`, context);
        }

        const shopConfig = getShopConfig();
        const category = shopConfig.categories[categoryName];
        const subCategories = Object.keys(category.subCategories)
            .sort()
            .map((name) => ({ name, ...category.subCategories[name], type: 'subCategory' }));
        const items = Object.keys(category.items).map((id) => ({ id, ...category.items[id], type: 'item' }));
        const allEntries = [...subCategories, ...items];
        const paginatedEntries = getPaginatedItems(allEntries, page);
        const selectedEntry =
            selection && selection > 3
                ? (paginatedEntries[selection - 4] as {
                      type: string;
                      id: string;
                      displayName: string;
                      icon: string;
                      buyPrice: number;
                      sellPrice: number;
                      permissionLevel: number;
                      name: string;
                  })
                : undefined;

        if (selectedEntry) {
            if (selectedEntry.type === 'item') {
                const form = new ActionFormData()
                    .title('Edit Item')
                    .button('Edit', 'textures/ui/icon_setting')
                    .button('Delete', 'textures/ui/trash');
                const itemActionResponse = await utils.uiWait(player, form);
                if (itemActionResponse.canceled) {
                    return showPanel(player, panelId, context);
                }
                const itemActionSelection = (itemActionResponse as ActionFormResponse).selection;
                if (itemActionSelection === 0) {
                    // Edit
                    const masterItem = allItems[selectedEntry.id] || {};
                    const editForm = new ModalFormData()
                        .title(`Edit Item: ${selectedEntry.id}`)
                        .textField('Display Name', 'e.g., Magical Sword', {
                            defaultValue: selectedEntry.displayName || masterItem.displayName
                        })
                        .textField('Minecraft Item ID', 'e.g., minecraft:diamond_sword', {
                            defaultValue: masterItem.itemId
                        })
                        .textField('Icon Path', 'e.g., textures/items/diamond_sword', {
                            defaultValue: selectedEntry.icon || masterItem.icon
                        })
                        .textField('Buy Price', '-1 to disable', { defaultValue: String(selectedEntry.buyPrice) })
                        .textField('Sell Price', '-1 to disable', { defaultValue: String(selectedEntry.sellPrice) })
                        .textField('Permission Level', 'e.g., 1024', {
                            defaultValue: String(selectedEntry.permissionLevel)
                        });

                    const editResponse = await utils.uiWait(player, editForm);
                    if (editResponse.canceled) {
                        return showPanel(player, panelId, context);
                    }

                    const values = (editResponse as ModalFormResponse).formValues as string[];
                    const [displayName, minecraftId, iconStr, buyPriceStr, sellPriceStr, permLevelStr] = values;
                    const icon = iconStr || '';
                    const buyPrice = Number(buyPriceStr);
                    const sellPrice = Number(sellPriceStr);
                    const permissionLevel = Number(permLevelStr);

                    if (
                        displayName &&
                        minecraftId &&
                        icon &&
                        !isNaN(buyPrice) &&
                        !isNaN(sellPrice) &&
                        !isNaN(permissionLevel)
                    ) {
                        const result = shopAdminManager.updateShopItem(categoryName, null, selectedEntry.id, {
                            buyPrice,
                            sellPrice,
                            permissionLevel,
                            icon,
                            minecraftId,
                            displayName
                        });
                        player.sendMessage(result.message);
                    } else {
                        player.sendMessage('§4Invalid data. Please check all fields.');
                    }
                } else {
                    // Delete
                    const result = shopAdminManager.removeItem(categoryName, null, selectedEntry.id);
                    player.sendMessage(result.message);
                }
            } else {
                // subCategory
                return showPanel(player, `shopAdminSubCategoryItemPanel_${selectedEntry.name}`, {
                    ...context,
                    subCategoryName: selectedEntry.name
                });
            }
            return showPanel(player, panelId, { ...context, page: 1 });
        }
        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(allEntries.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        const buttonIndex = selection && selection > 3 ? selection - 4 - paginatedEntries.length : -1;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId.startsWith('shopAdminCategoryActionPanel_')) {
        const categoryName = panelId.replace('shopAdminCategoryActionPanel_', '');

        if (selection === 0) {
            // Edit
            const shopConfig = getShopConfig();
            const category = shopConfig.categories[categoryName];
            const form = new ModalFormData()
                .title('Edit Category')
                .textField('Category Name', 'Enter new name', { defaultValue: categoryName })
                .textField('Icon', 'Enter icon texture path', { defaultValue: category.icon });
            const editCatResponse = await utils.uiWait(player, form);
            if (editCatResponse.canceled) {
                return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
            }
            const values = (editCatResponse as ModalFormResponse).formValues;
            if (!values) return;
            const newName = values[0] as string;
            const newIcon = values[1] as string;

            if (newName) {
                const result = shopAdminManager.editCategory(categoryName, newName, newIcon || '');
                player.sendMessage(result.message);
            }
            return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
        }
        if (selection === 1) {
            // Delete
            await showConfirmationDialog(player, {
                title: 'Confirm Deletion',
                body: 'Are you sure?',
                confirmButtonText: '§4Yes, Delete',
                cancelButtonText: '§2No, Cancel',
                onConfirm: () => {
                    const result = shopAdminManager.deleteCategory(categoryName);
                    player.sendMessage(result.message);
                    return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
                },
                onCancel: () => {
                    return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
                }
            });
            return;
        }
        if (selection === 2) {
            // Back
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
        }
    }

    if (panelId.startsWith('shopAdminSubCategoryItemPanel_')) {
        const { categoryName, subCategoryName, page = 1 } = context;
        if (selection === 0) {
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
        }
        if (selection === 1) {
            // Add Item
            return showPanel(player, `shopAddItemPanel_${categoryName}`, { ...context, subCategoryName });
        }
        if (selection === 2) {
            // Edit Subcategory
            return showPanel(player, `shopAdminSubCategoryActionPanel_${subCategoryName}`, context);
        }

        const shopConfig = getShopConfig();
        const subCategory = shopConfig.categories[categoryName].subCategories[subCategoryName];
        const items = Object.keys(subCategory.items).map((id) => ({ id, ...subCategory.items[id], type: 'item' }));
        const paginatedItems = getPaginatedItems(items, page);
        const selectedItem =
            selection && selection > 2
                ? (paginatedItems[selection - 3] as {
                      id: string;
                      displayName: string;
                      icon: string;
                      buyPrice: number;
                      sellPrice: number;
                      permissionLevel: number;
                  })
                : undefined;

        if (selectedItem) {
            const form = new ActionFormData()
                .title('Edit Item')
                .button('Edit', 'textures/ui/icon_setting')
                .button('Delete', 'textures/ui/trash');
            const itemActionResponse = await utils.uiWait(player, form);
            if (itemActionResponse.canceled) {
                return showPanel(player, panelId, context);
            }
            const itemActionSelection = (itemActionResponse as ActionFormResponse).selection;
            if (itemActionSelection === 0) {
                // Edit
                const masterItem = allItems[selectedItem.id] || {};
                const editForm = new ModalFormData()
                    .title(`Edit Item: ${selectedItem.id}`)
                    .textField('Display Name', 'e.g., Magical Sword', {
                        defaultValue: selectedItem.displayName || masterItem.displayName
                    })
                    .textField('Minecraft Item ID', 'e.g., minecraft:diamond_sword', {
                        defaultValue: masterItem.itemId
                    })
                    .textField('Icon Path', 'e.g., textures/items/diamond_sword', {
                        defaultValue: selectedItem.icon || masterItem.icon
                    })
                    .textField('Buy Price', '-1 to disable', { defaultValue: String(selectedItem.buyPrice) })
                    .textField('Sell Price', '-1 to disable', { defaultValue: String(selectedItem.sellPrice) })
                    .textField('Permission Level', 'e.g., 1024', {
                        defaultValue: String(selectedItem.permissionLevel)
                    });

                const editResponse = await utils.uiWait(player, editForm);
                if (editResponse.canceled) {
                    return showPanel(player, panelId, context);
                }

                const values = (editResponse as ModalFormResponse).formValues as string[];
                const [displayName, minecraftId, iconStr, buyPriceStr, sellPriceStr, permLevelStr] = values;
                const icon = iconStr || '';
                const buyPrice = Number(buyPriceStr);
                const sellPrice = Number(sellPriceStr);
                const permissionLevel = Number(permLevelStr);

                if (
                    displayName &&
                    minecraftId &&
                    icon &&
                    !isNaN(buyPrice) &&
                    !isNaN(sellPrice) &&
                    !isNaN(permissionLevel)
                ) {
                    const result = shopAdminManager.updateShopItem(categoryName, subCategoryName, selectedItem.id, {
                        buyPrice,
                        sellPrice,
                        permissionLevel,
                        icon,
                        minecraftId,
                        displayName
                    });
                    player.sendMessage(result.message);
                } else {
                    player.sendMessage('§4Invalid data. Please check all fields.');
                }
            } else {
                // Delete
                const result = shopAdminManager.removeItem(categoryName, subCategoryName, selectedItem.id);
                player.sendMessage(result.message);
            }
            return showPanel(player, panelId, { ...context, page: 1 });
        }

        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(items.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        const buttonIndex = selection && selection > 2 ? selection - 3 - paginatedItems.length : -1;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId.startsWith('shopAdminSubCategoryActionPanel_')) {
        const subCategoryName = panelId.replace('shopAdminSubCategoryActionPanel_', '');
        const { categoryName } = context;
        if (selection === 0) {
            // Edit
            const shopConfig = getShopConfig();
            const subCategory = shopConfig.categories[categoryName].subCategories[subCategoryName];
            const form = new ModalFormData()
                .title('Edit Subcategory')
                .textField('Subcategory Name', 'Enter new name', { defaultValue: subCategoryName })
                .textField('Icon', 'Enter icon texture path', { defaultValue: subCategory.icon });
            const editSubCatResponse = await utils.uiWait(player, form);
            if (editSubCatResponse.canceled) {
                return showPanel(player, `shopAdminSubCategoryItemPanel_${subCategoryName}`, context);
            }
            const values = (editSubCatResponse as ModalFormResponse).formValues;
            if (!values) return;
            const newName = values[0] as string;
            const newIcon = values[1] as string;

            if (newName) {
                const result = shopAdminManager.editSubCategory(categoryName, subCategoryName, newName, newIcon || '');
                player.sendMessage(result.message);
            }
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        }
        if (selection === 1) {
            // Delete
            await showConfirmationDialog(player, {
                title: 'Confirm Deletion',
                body: 'Are you sure?',
                confirmButtonText: '§4Yes, Delete',
                cancelButtonText: '§2No, Cancel',
                onConfirm: () => {
                    const result = shopAdminManager.deleteSubCategory(categoryName, subCategoryName);
                    player.sendMessage(result.message);
                    return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
                },
                onCancel: () => {
                    return showPanel(player, `shopAdminSubCategoryActionPanel_${subCategoryName}`, context);
                }
            });
            return;
        }
        if (selection === 2) {
            // Back
            return showPanel(player, `shopAdminSubCategoryItemPanel_${subCategoryName}`, context);
        }
    }
}
