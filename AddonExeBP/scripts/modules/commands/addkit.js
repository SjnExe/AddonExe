import { commandManager } from './commandManager.js';
import { createKit, getAllKits } from '../../core/kitAdminManager.js';
import { addItemToKit } from '../../core/kitItemsManager.js';
import { showPanel } from '../../core/uiManager.js';

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
