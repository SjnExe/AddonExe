import { ActionFormData } from '@minecraft/server-ui';
import { commandManager } from './commandManager.js';
import * as kitsManager from '../../core/kitsManager.js';
import { getConfig } from '../../core/configManager.js';
import { errorLog } from '../../core/errorLogger.js';
import { createKit, getAllKits } from '../../core/kitAdminManager.js';
import { addItemToKit } from '../../core/kitItemsManager.js';
import { formatCooldown } from '../../core/utils.js';
import { showPanel } from '../../core/uiManager.js';

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
            const availableKits = kitsManager.listKits(player);
            if (availableKits.length === 0) {
                player.sendMessage('§cThere are no kits available for you.');
                return;
            }

            const form = new ActionFormData()
                .title('Available Kits')
                .body('Select a kit to claim:');

            availableKits.forEach(kit => {
                let buttonText = kit.name;
                if (kit.price > 0) {
                    buttonText += ` - $${kit.price}`;
                }
                if (kit.cooldown > 0) {
                    buttonText += ` - Cooldown: ${formatCooldown(kit.cooldown)}`;
                }
                form.button(buttonText, kit.icon);
            });

            form.show(player).then(response => {
                if (response.canceled) { return; }
                const selectedKitName = availableKits[response.selection].name;
                const result = kitsManager.giveKit(player, selectedKitName);
                if (result.success) {
                    player.sendMessage(`§a${result.message}`);
                } else {
                    player.sendMessage(`§c${result.message}`);
                }
            }).catch(error => {
                errorLog(`[Kit UI] Error showing form: ${error}`);
            });
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
