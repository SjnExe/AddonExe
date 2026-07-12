import { EntityComponentTypes } from '@minecraft/server';

import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';

import { getConfig } from '@core/configManager.js';
import { errorLog } from '@core/logger.js';
import { showPanel } from '@core/uiManager.js';
import { formatCooldown, uiWait } from '@core/utils.js';
import { createKit, getAllKits } from '@features/kit/adminManager.js';
import { addItemToKit } from '@features/kit/itemsManager.js';
import * as kitsManager from '@features/kit/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';

const KITS_PER_PAGE = 8;

async function showKitList(player: mc.Player, page: number) {
    const availableKits = kitsManager.listKits(player);
    if (availableKits.length === 0) {
        player.sendMessage('§cThere are no kits available for you.');
        return;
    }

    const totalPages = Math.ceil(availableKits.length / KITS_PER_PAGE);
    page = Math.max(1, Math.min(page, totalPages));

    const startIndex = (page - 1) * KITS_PER_PAGE;
    const kitsToShow = availableKits.slice(startIndex, startIndex + KITS_PER_PAGE);

    const form = new ActionFormData().title(`Available Kits (Page ${page}/${totalPages})`).body('Select a kit to claim:');

    for (const kit of kitsToShow) {
        let buttonText = kit.name;
        if (kit.price > 0) {
            buttonText += ` - $${kit.price}`;
        }
        if (kit.cooldown > 0) {
            buttonText += ` - Cooldown: ${formatCooldown(kit.cooldown)}`;
        }
        form.button(buttonText, kit.icon || 'textures/ui/inventory_icon');
    }

    if (page > 1) {
        form.button('§6< Previous Page');
    }
    if (page < totalPages) {
        form.button('§6Next Page >');
    }

    try {
        const response = await uiWait(player, form);
        if (!isDefined(response) || response.canceled) {
            return;
        }

        const selection = (response as ActionFormResponse).selection;
        if (!isDefined(selection)) return;

        if (selection >= kitsToShow.length) {
            let buttonIndex = selection - kitsToShow.length;
            if (page > 1) {
                if (buttonIndex === 0) {
                    await showKitList(player, page - 1);
                    return;
                }
                buttonIndex--;
            }
            if (page < totalPages && buttonIndex === 0) {
                await showKitList(player, page + 1);
            }
            return;
        }

        const selectedKitIndex = startIndex + selection;
        const selectedKit = availableKits[selectedKitIndex];
        if (!isDefined(selectedKit)) return;
        const selectedKitName = selectedKit.name;
        const result = kitsManager.giveKit(player, selectedKitName);
        if (result.success) {
            player.sendMessage(`§a${result.message}`);
        } else {
            player.sendMessage(`§c${result.message}`);
        }
    } catch (error) {
        errorLog(`[Kit UI] Error showing form: ${String(error)}`);
    }
}

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
            // Provide suggestions for kit names based on currently loaded kits
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
            await showKitList(executor, 1);
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
    permissionNode: 'cmd.addkit.admin', // Admins only
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
        await showPanel(executor, `kitActionMenu_${lowerCaseKitName}`);
    }
};

export default [kitCommand, addKitCommand];
