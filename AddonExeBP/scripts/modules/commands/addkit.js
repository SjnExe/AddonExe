import { commandManager } from './commandManager.js';
import { createKit } from '../../core/kitAdminManager.js';
import { addItemToKit } from '../../core/kitItemsManager.js';

commandManager.register({
    name: 'addkit',
    description: 'Create a new kit from your inventory.',
    permissionLevel: 1, // Admins only
    allowConsole: false,
    parameters: [
        { name: 'kitName', type: 'string', description: 'The name of the kit to create.' },
        { name: 'icon', type: 'string', description: 'The icon to use for the kit.', optional: true },
        { name: 'price', type: 'number', description: 'The price of the kit.', optional: true }
    ],
    execute: (player, args) => {
        const { kitName, icon, price } = args;

        const inventory = player.getComponent('minecraft:inventory').container;
        const items = [];
        // Player inventory is slots 0-35.
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

        const createResult = createKit(kitName, icon, price);
        if (!createResult.success) {
            return player.sendMessage(`§c${createResult.message}`);
        }

        for (const item of items) {
            addItemToKit(kitName, item);
        }

        player.sendMessage(`§aSuccessfully created kit '${kitName}' with ${items.length} item stacks.`);
    }
});
