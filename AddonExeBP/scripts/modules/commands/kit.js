import { ActionFormData } from '@minecraft/server-ui';
import { commandManager } from './commandManager.js';
import * as kitsManager from '../../core/kitsManager.js';
import { getConfig } from '../../core/configManager.js';
import { errorLog } from '../../core/errorLogger.js';
import { createKit, getAllKits } from '../../core/kitAdminManager.js';
import { addItemToKit } from '../../core/kitItemsManager.js';
import { formatCooldown } from '../../core/utils.js';
import { showPanel } from '../../core/uiManager.js';

const KITS_PER_PAGE = 8;

/**
 * Shows a paginated list of available kits to the player.
 * @param {import('@minecraft/server').Player} player The player to show the list to.
 * @param {number} page The page number to display (1-based).
 */
function showKitList(player, page) {
    const availableKits = kitsManager.listKits(player);
    if (availableKits.length === 0) {
        player.sendMessage('§cThere are no kits available for you.');
        return;
    }

    const totalPages = Math.ceil(availableKits.length / KITS_PER_PAGE);
    page = Math.max(1, Math.min(page, totalPages)); // Clamp page number

    const startIndex = (page - 1) * KITS_PER_PAGE;
    const endIndex = startIndex + KITS_PER_PAGE;
    const kitsToShow = availableKits.slice(startIndex, endIndex);

    const form = new ActionFormData()
        .title(`Available Kits (Page ${page}/${totalPages})`)
        .body('Select a kit to claim:');

    kitsToShow.forEach(kit => {
        let buttonText = kit.name;
        if (kit.price > 0) {
            buttonText += ` - $${kit.price}`;
        }
        if (kit.cooldown > 0) {
            buttonText += ` - Cooldown: ${formatCooldown(kit.cooldown)}`;
        }
        form.button(buttonText, kit.icon || 'textures/ui/inventory_icon');
    });

    if (page > 1) {
        form.button('§e< Previous Page');
    }
    if (page < totalPages) {
        form.button('§eNext Page >');
    }

    form.show(player).then(response => {
        if (response.canceled) { return; }

        const selection = response.selection;
        let selectedIndex = selection;

        if (selection >= kitsToShow.length) {
            let buttonIndex = selection - kitsToShow.length;
            if (page > 1) {
                if (buttonIndex === 0) {
                    showKitList(player, page - 1);
                    return;
                }
                buttonIndex--;
            }
            if (page < totalPages) {
                if (buttonIndex === 0) {
                    showKitList(player, page + 1);
                    return;
                }
            }
            return; // Should not happen
        }

        const selectedKitIndex = startIndex + selectedIndex;
        const selectedKitName = availableKits[selectedKitIndex].name;
        const result = kitsManager.giveKit(player, selectedKitName);
        if (result.success) {
            player.sendMessage(`§a${result.message}`);
        } else {
            player.sendMessage(`§c${result.message}`);
        }
    }).catch(error => {
        errorLog(`[Kit UI] Error showing form: ${error}`);
    });
}

commandManager.register({
    name: 'kit',
    description: 'Claims a specific kit. Leave blank to see a list of available kits.',
    category: 'General',
    permissionLevel: 1024, // Everyone
    parameters: [
        { name: 'kitName', type: 'string', description: 'The name of the kit to claim. Leave blank to see a list.', optional: true }
    ],
    execute: (player, args) => {
        const config = getConfig();
        if (!config.kits.enabled) {
            player.sendMessage('§cThe kits system is currently disabled.');
            return;
        }

        const { kitName } = args;

        if (!kitName) {
            showKitList(player, 1);
            return;
        }

        // Original logic to claim a kit by name
        const result = kitsManager.giveKit(player, kitName);

        if (result.success) {
            player.sendMessage(`§a${result.message}`);
        } else {
            player.sendMessage(`§c${result.message}`);
        }
    }
});

commandManager.register({
    name: 'addkit',
    description: 'Create a new kit from your inventory and open the editor.',
    permissionLevel: 1, // Admins only
    allowConsole: false,
    parameters: [
        { name: 'kitName', type: 'string', description: 'The name for the new kit. Leave blank to auto-generate.', optional: true }
    ],
    execute: (player, args) => {
        let { kitName } = args;

        if (!kitName) {
            const allKits = getAllKits();
            let i = 1;
            kitName = 'kit';
            while (allKits[kitName]) {
                i++;
                kitName = `kit${i}`;
            }
        }

        const inventory = player.getComponent('minecraft:inventory').container;
        const items = [];
        for (let i = 0; i < 36; i++) {
            const item = inventory.getItem(i);
            if (item) {
                items.push({
                    typeId: item.typeId,
                    amount: item.amount,
                    nameTag: item.nameTag,
                    lore: item.getLore()
                });
            }
        }

        if (items.length === 0) {
            return player.sendMessage('§cYour inventory is empty. Cannot create an empty kit.');
        }

        const createResult = createKit(kitName);
        if (!createResult.success) {
            return player.sendMessage(`§c${createResult.message}`);
        }

        const lowerCaseKitName = kitName.toLowerCase();
        for (const item of items) {
            addItemToKit(lowerCaseKitName, item);
        }

        player.sendMessage(`§aSuccessfully created kit '${lowerCaseKitName}'. Opening editor...`);
        showPanel(player, `kitActionMenu_${lowerCaseKitName}`);
    }
});
