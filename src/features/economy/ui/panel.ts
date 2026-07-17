import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';

import { getEconomyConfig, saveEconomyConfig } from '@core/configurations.js';

import { showPanel } from '@core/uiManager.js';
import { formatCurrency } from '@core/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { showConfirmationDialog } from '@ui/components.js';
import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions, UIContext } from '@ui/panelRegistry.js';
import { getPaginatedItems } from '@ui/uiUtils.js';

export async function showEconomyMainPanel(player: mc.Player, context: UIContext = {}): Promise<void> {
    const def = panelDefinitions['economyPanel'];
    if (!isDefined(def)) return;

    const form = new ActionFormBuilder().title(def.title).body(def.body ?? '');
    const staticItems = getStaticMenuItems(player, def);

    for (const item of staticItems) {
        form.button(item.text, item.icon, async () => {
            if (item.actionType === 'openPanel') {
                return showPanel(player, item.actionValue, { ...context, page: 1 });
            }
        });
    }

    form.addBackButton(async () => {
        await showPanel(player, 'mainPanel', context);
    });

    await form.show(player);
}

export async function showMobDropsSystemPanel(player: mc.Player, context: UIContext = {}): Promise<void> {
    const def = panelDefinitions['mobDropsSystemPanel'];
    if (!isDefined(def)) return;

    const page = (context.page as number) || 1;
    const form = new ActionFormBuilder().title(def.title).body(def.body ?? '');

    const staticItems = getStaticMenuItems(player, def);
    for (const item of staticItems) {
        form.button(item.text, item.icon, async () => {
            if (item.actionType === 'openPanel') {
                return showPanel(player, item.actionValue, { ...context, page: 1 });
            }
        });
    }

    const config = getEconomyConfig();
    const mobMoney = config.mobMoney;
    const mobs = Object.keys(mobMoney).toSorted((a, b) => a.localeCompare(b));

    const paginated = getPaginatedItems(mobs, page);

    for (const mobId of paginated) {
        const amount = mobMoney[mobId] ?? 0;
        const color = amount >= 0 ? '§2' : '§c';

        form.button(`${mobId}\n${color}${formatCurrency(amount)}`, 'textures/ui/egg_icon', async () => {
            await showPanel(player, 'editMobDropPanel', {
                ...context,
                page: 1,
                selectedItemId: mobId,
                id: mobId
            });
        });
    }

    const totalPages = Math.ceil(mobs.length / 45); // Assuming 45 items per page in uiUtils
    if (page > 1) {
        form.button('§6< Previous Page', 'textures/ui/arrow_left.png', async () => showMobDropsSystemPanel(player, { ...context, page: page - 1 }));
    }
    if (page < totalPages) {
        form.button('§6Next Page >', 'textures/ui/arrow_right.png', async () => showMobDropsSystemPanel(player, { ...context, page: page + 1 }));
    }

    form.addBackButton(async () => {
        await showEconomyMainPanel(player, context);
    });

    await form.show(player);
}

export async function showEditMobDropPanel(player: mc.Player, context: UIContext): Promise<void> {
    const mobId = context.selectedItemId as string;
    if (!isNonEmptyString(mobId)) return showMobDropsSystemPanel(player, context);

    const form = new ActionFormBuilder().title(`Edit: ${mobId}`);

    form.button('Edit Value', 'textures/ui/icon_setting', async () => {
        await showEditMobValuePanel(player, context);
    });

    form.button('§4Delete', 'textures/ui/trash', async () => {
        await showConfirmationDialog(player, {
            title: 'Delete Drop?',
            body: `Remove reward for ${mobId}?`,
            confirmButtonText: '§cDelete',
            cancelButtonText: 'Cancel',
            onConfirm: () => {
                const config = getEconomyConfig();
                delete config.mobMoney[mobId];
                saveEconomyConfig(config);
                player.sendMessage(`§2Removed ${mobId}`);
                return showMobDropsSystemPanel(player, context);
            },
            onCancel: () => showEditMobDropPanel(player, context)
        });
    });

    form.addBackButton(async () => {
        await showMobDropsSystemPanel(player, context);
    });

    await form.show(player);
}

export async function showAddMobDropPanel(player: mc.Player, context: UIContext): Promise<void> {
    const form = new ModalFormBuilder<{ mobId: string; amount: string }>()
        .title('Add Mob Drop')
        .textField('mobId', 'Mob Identifier', 'e.g., minecraft:zombie')
        .textField('amount', 'Reward Amount', 'Negative for penalty', '0');

    const response = await form.show(player);
    if (response.canceled) return showMobDropsSystemPanel(player, context);

    const { mobId, amount: amountStr } = response.formValues!;
    const amount = Number.parseInt(amountStr);

    if (isNonEmptyString(mobId) && !Number.isNaN(amount)) {
        const config = getEconomyConfig();
        config.mobMoney[mobId] = amount;
        saveEconomyConfig(config);
        player.sendMessage(`§2Added ${mobId} with reward ${formatCurrency(amount)}`);
    } else {
        player.sendMessage('§cInvalid input.');
    }
    return showMobDropsSystemPanel(player, { ...context, page: 1 });
}

export async function showEditMobValuePanel(player: mc.Player, context: UIContext): Promise<void> {
    const config = getEconomyConfig();
    const mobId = context.selectedItemId as string;
    if (!isNonEmptyString(mobId)) return showMobDropsSystemPanel(player, context);

    const currentVal = config.mobMoney[mobId] ?? 0;
    const form = new ModalFormBuilder<{ amount: string }>().title(`Edit ${mobId}`).textField('amount', 'Reward Amount', 'Negative for penalty', String(currentVal));

    const response = await form.show(player);
    if (response.canceled) return showEditMobDropPanel(player, { ...context, id: mobId });

    const { amount: amountStr } = response.formValues!;
    const amount = Number.parseInt(amountStr);

    if (!Number.isNaN(amount) && isNonEmptyString(mobId)) {
        config.mobMoney[mobId] = amount;
        saveEconomyConfig(config);
        player.sendMessage(`§2Updated ${mobId} to ${formatCurrency(amount)}`);
    }
    return showEditMobDropPanel(player, { ...context, id: mobId });
}
