import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { createKit, getAllKits } from '@features/kit/adminManager.js';
import { addItemToKit } from '@features/kit/itemsManager.js';
import * as kitsManager from '@features/kit/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

interface KitCommandArgs {
    kitName?: string;
}

const kitCommand: CustomCommand = {
    name: 'kit',
    description: 'Claims a specific kit. Leave blank to see a list of available kits.',
    category: 'Economy',
    permissionNode: 'cmd.kit.member',
    parameters: [
        {
            name: 'kitName',
            type: 'string',
            optional: true,
            enumOptions: () => {
                try {
                    return Object.keys(getAllKits());
                } catch {
                    return [];
                }
            }
        }
    ],
    execute: async (executor: CommandExecutor, args: KitCommandArgs) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getConfig();
        if (!config.kits.enabled) {
            executor.sendMessage('§cThe Kits system is currently disabled globally.');
            return;
        }

        const kitName = args.kitName;

        if (!isNonEmptyString(kitName)) {
            const { showKitClaimPanel } = await import('@features/kit/ui/panel.js');
            await showKitClaimPanel(executor, 1);
            return;
        }

        const result = kitsManager.giveKit(executor, kitName);

        if (result.success) {
            executor.sendMessage(`§a${result.message}`);
        } else {
            executor.sendMessage(`§c${result.message}`);
        }
    }
};

const addKitCommand: CustomCommand = {
    name: 'addkit',
    description: 'Create a new kit from your inventory and open the editor.',
    category: 'Economy',
    permissionNode: 'cmd.addkit.admin',
    allowConsole: false,
    parameters: [{ name: 'kitName', type: 'string', optional: true }],
    execute: async (executor: CommandExecutor, args: KitCommandArgs) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const config = getConfig();
        if (!config.kits.enabled) {
            executor.sendMessage('§cThe Kits system is currently disabled globally.');
            return;
        }

        let kitName = args.kitName;

        if (!isNonEmptyString(kitName)) {
            const allKits = getAllKits();
            let i = 1;
            kitName = 'kit';
            while (allKits[kitName]) {
                i++;
                kitName = `kit${i}`;
            }
        }

        const inventory = executor.getComponent(EntityComponentTypes.Inventory)?.container;
        if (!isDefined(inventory)) {
            return executor.sendMessage('§cCould not access your inventory.');
        }

        const items = [];
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (isDefined(item)) {
                items.push({
                    typeId: item.typeId,
                    amount: item.amount,
                    ...(isNonEmptyString(item.nameTag) ? { nameTag: item.nameTag } : {}),
                    lore: item.getLore()
                });
            }
        }

        if (items.length === 0) {
            return executor.sendMessage('§cYour inventory is empty. Cannot create an empty kit.');
        }

        const createResult = createKit(kitName);
        if (!createResult.success) {
            return executor.sendMessage(`§c${createResult.message}`);
        }

        const lowerCaseKitName = kitName.toLowerCase();
        for (const item of items) {
            addItemToKit(lowerCaseKitName, item);
        }

        executor.sendMessage(`§aSuccessfully created kit '${lowerCaseKitName}'. Opening editor...`);
        const { showKitActionMenu } = await import('@features/kit/ui/panel.js');
        await showKitActionMenu(executor, lowerCaseKitName);
    }
};

export default [kitCommand, addKitCommand];
