/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import * as shopAdminManager from '../../../features/shop/shopAdminManager.js';
import * as shopManager from '../../../features/shop/shopManager.js';
import { getConfig, updateMultipleConfig } from '../../configManager.js';
import { getShopConfig } from '../../configurations.js';
import { items as allItems } from '../../itemsConfig.default.js';
import { showPanel } from '../../uiManager.js';
import * as utils from '../../utils.js';
import { showConfirmationDialog } from '../components.js';
import { getPanelItems } from '../panelBuilder.js';
import { UIContext } from '../panelRegistry.js';
import { MainConfig, ShopConfig } from '../types.js';

export async function handleShopPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const selection = (response as ActionFormResponse).selection;

    // Use HEADLESS BUILDER pattern for Action Forms
    if (typeof selection === 'number') {
        const items = await getPanelItems(player, panelId, context);
        if (selection >= 0 && selection < items.length) {
            const selectedItem = items[selection];

            if (selectedItem.actionType === 'openPanel') {
                return showPanel(player, selectedItem.actionValue, { ...context, page: 1 });
            }

            if (selectedItem.id === '__back__') {
                return showPanel(player, selectedItem.actionValue, { ...context, page: 1 });
            }

            if (selectedItem.id === '__prev__') {
                const newPage = (context.page || 1) - 1;
                return showPanel(player, panelId, { ...context, page: newPage });
            }
            if (selectedItem.id === '__next__') {
                const newPage = (context.page || 1) + 1;
                return showPanel(player, panelId, { ...context, page: newPage });
            }

            // --- Shop Actions ---

            if (selectedItem.actionValue === 'toggleShop') {
                const mainConfig = getConfig() as unknown as MainConfig;
                const newStatus = !mainConfig.shop.enabled;
                updateMultipleConfig({ 'shop.enabled': newStatus });
                player.sendMessage(`§2Shop system has been ${newStatus ? 'enabled' : 'disabled'}.`);
                return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
            }

            if (selectedItem.actionValue === 'addCategory') {
                const form = new ModalFormData()
                    .title('Add Category')
                    .textField('Category Name', 'Enter category name', { defaultValue: '' })
                    .textField('Icon', 'Enter icon texture path', { defaultValue: '' });
                const addCatResponse = await utils.uiWait(player, form);
                if (addCatResponse.canceled) return showPanel(player, panelId, context);

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

            if (selectedItem.actionValue === 'addSubCategory') {
                const { categoryName } = context;
                const form = new ModalFormData()
                    .title('Add Subcategory')
                    .textField('Subcategory Name', 'Enter subcategory name', { defaultValue: '' })
                    .textField('Icon', 'Enter icon texture path', { defaultValue: '' });
                const addSubCatResponse = await utils.uiWait(player, form);
                if (addSubCatResponse.canceled) return showPanel(player, panelId, context);

                const values = (addSubCatResponse as ModalFormResponse).formValues;
                if (!values) return;
                const name = values[0] as string;
                const iconStr = values[1] as string;

                if (name) {
                    const result = shopAdminManager.addSubCategory(categoryName as string, name, iconStr || '');
                    player.sendMessage(result.message);
                }
                return showPanel(player, panelId, { ...context, page: 1 });
            }

            if (selectedItem.actionValue === 'editCategory') {
                let targetName = context.categoryName as string;
                if (!targetName && panelId.startsWith('shopAdminCategoryActionPanel_')) {
                    targetName = panelId.replace('shopAdminCategoryActionPanel_', '');
                }

                const shopConfig = getShopConfig() as ShopConfig;
                const category = shopConfig.categories[targetName];
                const form = new ModalFormData()
                    .title('Edit Category')
                    .textField('Category Name', 'Enter new name', { defaultValue: targetName })
                    .textField('Icon', 'Enter icon texture path', { defaultValue: category.icon });
                const editCatResponse = await utils.uiWait(player, form);
                if (editCatResponse.canceled) return showPanel(player, panelId, context);

                const values = (editCatResponse as ModalFormResponse).formValues;
                if (!values) return;
                const newName = values[0] as string;
                const newIcon = values[1] as string;

                if (newName) {
                    const result = shopAdminManager.editCategory(targetName, newName, newIcon || '');
                    player.sendMessage(result.message);
                }
                return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
            }

            if (selectedItem.actionValue === 'deleteCategory') {
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
                return;
            }

            if (selectedItem.actionValue === 'editSubCategory') {
                const targetName = panelId.replace('shopAdminSubCategoryActionPanel_', '');
                const { categoryName } = context;
                const shopConfig = getShopConfig() as ShopConfig;
                const subCategory = shopConfig.categories[categoryName as string].subCategories[targetName];

                const form = new ModalFormData()
                    .title('Edit Subcategory')
                    .textField('Subcategory Name', 'Enter new name', { defaultValue: targetName })
                    .textField('Icon', 'Enter icon texture path', { defaultValue: subCategory.icon });
                const editResponse = await utils.uiWait(player, form);
                if (editResponse.canceled) return showPanel(player, panelId, context);

                const values = (editResponse as ModalFormResponse).formValues;
                if (!values) return;
                const newName = values[0] as string;
                const newIcon = values[1] as string;

                if (newName) {
                    const result = shopAdminManager.editSubCategory(
                        categoryName as string,
                        targetName,
                        newName,
                        newIcon || ''
                    );
                    player.sendMessage(result.message);
                }
                return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
            }

            if (selectedItem.actionValue === 'deleteSubCategory') {
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
                        return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
                    },
                    onCancel: () => showPanel(player, panelId, context)
                });
                return;
            }

            if (selectedItem.actionValue === 'addCustomItem') {
                const form = new ModalFormData()
                    .title('Add Custom Item')
                    .textField('Item ID (unique key)', 'e.g., custom_sword')
                    .textField('Display Name', 'e.g., Sword of Awesome')
                    .textField('Minecraft Item ID', 'e.g., minecraft:diamond_sword')
                    .textField('Icon Path', 'e.g., textures/items/diamond_sword')
                    .textField('Buy Price', '-1 to disable', { defaultValue: '-1' })
                    .textField('Sell Price', '-1 to disable', { defaultValue: '-1' })
                    .textField('Permission Level', 'e.g., 1024', { defaultValue: '1024' });

                const addCustomResponse = await utils.uiWait(player, form);
                if (addCustomResponse.canceled) return showPanel(player, panelId, context);

                const values = (addCustomResponse as ModalFormResponse).formValues as string[];
                const [customId, displayName, mcId, iconStr, buyPriceStr, sellPriceStr, permLevelStr] = values;
                const icon = iconStr || '';
                const buyPrice = parseInt(buyPriceStr, 10);
                const sellPrice = parseInt(sellPriceStr, 10);
                const permissionLevel = parseInt(permLevelStr, 10);

                if (customId && displayName && mcId && !isNaN(buyPrice)) {
                    shopAdminManager.addCustomItemToConfig(customId, {
                        itemId: mcId,
                        icon,
                        buyPrice,
                        sellPrice,
                        displayName
                    });
                    shopAdminManager.setItem(
                        context.categoryName as string,
                        (context.subCategoryName as string) || null,
                        customId,
                        {
                            buyPrice,
                            sellPrice,
                            permissionLevel,
                            icon,
                            displayName,
                            itemId: customId
                        }
                    );
                    player.sendMessage(`§2Added ${displayName}.`);
                }
                const parent = context.subCategoryName
                    ? `shopAdminSubCategoryItemPanel_${context.subCategoryName}`
                    : `shopAdminCategoryPanel_${context.categoryName}`;
                return showPanel(player, parent, { ...context, page: 1 });
            }

            if (selectedItem.actionValue === 'addItemFromList') {
                const itemId = selectedItem.id;
                const masterItem = allItems[itemId];
                const form = new ModalFormData()
                    .title(`Add ${masterItem.displayName}`)
                    .textField('Icon Path', 'e.g., textures/items/diamond_sword', { defaultValue: masterItem.icon })
                    .textField('Buy Price', '-1 to disable', { defaultValue: `${masterItem.buyPrice}` })
                    .textField('Sell Price', '-1 to disable', { defaultValue: `${masterItem.sellPrice}` })
                    .textField('Permission Level', 'e.g., 1024', { defaultValue: '1024' });

                const addListResponse = await utils.uiWait(player, form);
                if (addListResponse.canceled) return showPanel(player, panelId, context);

                const values = (addListResponse as ModalFormResponse).formValues as string[];
                const [iconStr, buyPriceStr, sellPriceStr, permLevelStr] = values;
                const icon = iconStr || '';
                const buyPrice = parseInt(buyPriceStr, 10);
                const sellPrice = parseInt(sellPriceStr, 10);
                const permissionLevel = parseInt(permLevelStr, 10);

                if (!isNaN(buyPrice)) {
                    shopAdminManager.setItem(
                        context.categoryName as string,
                        (context.subCategoryName as string) || null,
                        itemId,
                        {
                            buyPrice,
                            sellPrice,
                            permissionLevel,
                            icon,
                            displayName: masterItem.displayName || '',
                            itemId: itemId
                        }
                    );
                    player.sendMessage(`§2Added ${masterItem.displayName}.`);
                }
                const parent = context.subCategoryName
                    ? `shopAdminSubCategoryItemPanel_${context.subCategoryName}`
                    : `shopAdminCategoryPanel_${context.categoryName}`;
                return showPanel(player, parent, { ...context, page: 1 });
            }

            if (selectedItem.actionValue === 'editItem') {
                const actionForm = new ActionFormData()
                    .title('Edit Item')
                    .button('Edit', 'textures/ui/icon_setting')
                    .button('Delete', 'textures/ui/trash');

                const actionRes = await utils.uiWait(player, actionForm);
                if (actionRes.canceled) return showPanel(player, panelId, context);

                if (actionRes.selection === 0) {
                    const itemId = selectedItem.id;
                    const { categoryName, subCategoryName } = context;
                    const shopConfig = getShopConfig() as ShopConfig;
                    let item;
                    if (subCategoryName)
                        item =
                            shopConfig.categories[categoryName as string].subCategories[subCategoryName].items[itemId];
                    else item = shopConfig.categories[categoryName as string].items[itemId];

                    const masterItem = allItems[itemId] || {};

                    const editForm = new ModalFormData()
                        .title(`Edit Item: ${itemId}`)
                        .textField('Display Name', 'Name', { defaultValue: item.displayName || masterItem.displayName })
                        .textField('Minecraft ID', 'ID', { defaultValue: item.itemId || masterItem.itemId })
                        .textField('Icon', 'Icon', { defaultValue: item.icon || masterItem.icon })
                        .textField('Buy Price', 'Price', { defaultValue: String(item.buyPrice) })
                        .textField('Sell Price', 'Price', { defaultValue: String(item.sellPrice) })
                        .textField('Permission', 'Level', { defaultValue: String(item.permissionLevel) });

                    const editRes = await utils.uiWait(player, editForm);
                    if (editRes.canceled) return showPanel(player, panelId, context);

                    const vals = editRes.formValues as string[];
                    const [dName, mId, icon, bPrice, sPrice, pLevel] = vals;
                    shopAdminManager.updateShopItem(
                        categoryName as string,
                        (subCategoryName as string) || null,
                        itemId,
                        {
                            buyPrice: Number(bPrice),
                            sellPrice: Number(sPrice),
                            permissionLevel: Number(pLevel),
                            icon,
                            minecraftId: mId,
                            displayName: dName
                        }
                    );
                    player.sendMessage('§2Item updated.');
                } else if (actionRes.selection === 1) {
                    shopAdminManager.removeItem(
                        context.categoryName as string,
                        (context.subCategoryName as string) || null,
                        selectedItem.id
                    );
                    player.sendMessage('§2Item removed.');
                }
                return showPanel(player, panelId, context);
            }

            if (selectedItem.actionValue === 'buyOrSell') {
                const itemId = selectedItem.id;
                const masterItem = allItems[itemId];
                const categoryName = context.categoryName as string;
                const subCategoryName = context.subCategoryName as string;
                const shopConfig = getShopConfig() as ShopConfig;

                let shopItem;
                if (subCategoryName) {
                    shopItem = shopConfig.categories[categoryName].subCategories[subCategoryName].items[itemId];
                } else {
                    shopItem = shopConfig.categories[categoryName].items[itemId];
                }

                if (!shopItem) return;

                const canBuy = context.view !== 'sell' && shopItem.buyPrice > 0;
                const canSell = context.view !== 'buy' && shopItem.sellPrice > 0;

                if (!canBuy && !canSell) {
                    player.sendMessage('§4This item cannot be bought or sold currently.');
                    return showPanel(player, panelId, context);
                }

                const modal = new ModalFormData().title(masterItem?.displayName ?? itemId);
                let action: 'buy' | 'sell' | undefined;
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
                    modal.textField(`Amount to Sell (Price: $${shopItem.sellPrice})`, 'Enter a numeric value', {
                        defaultValue: '1'
                    });
                    action = 'sell';
                }

                const modalResponse = await utils.uiWait(player, modal);
                if (modalResponse.canceled) return showPanel(player, panelId, context);

                let amount;
                if (hasDropdown) {
                    const values = (modalResponse as ModalFormResponse).formValues as [string, number];
                    if (!values) return showPanel(player, panelId, context);
                    const amountStr = values[0];
                    const actionIndex = values[1];
                    amount = utils.parseCurrency(amountStr);
                    const options = [`Buy ($${shopItem.buyPrice})`, `Sell ($${shopItem.sellPrice})`];
                    const selectedActionString = options[actionIndex];
                    action = selectedActionString.startsWith('Buy') ? 'buy' : 'sell';
                } else {
                    const values = (modalResponse as ModalFormResponse).formValues as [string];
                    if (!values) return showPanel(player, panelId, context);
                    const amountStr = values[0];
                    amount = utils.parseCurrency(amountStr);
                }

                if (isNaN(amount) || amount <= 0) {
                    player.sendMessage('§4Invalid amount. Please enter a positive number (e.g. 1, 64, 1k).');
                    return showPanel(player, panelId, context);
                }

                let result;
                if (action === 'buy') {
                    result = shopManager.buyItem(player, itemId, amount);
                } else {
                    result = shopManager.sellItem(player, itemId, amount);
                }
                player.sendMessage(result.message);
                return showPanel(player, panelId, context);
            }
        }
    }
}
