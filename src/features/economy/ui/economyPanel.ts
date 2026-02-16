import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getEconomyConfig, saveEconomyConfig } from '@core/configurations.js';
import { getOrCreatePlayer } from '@core/playerDataManager.js';
import { showPanel } from '@core/uiManager.js';
import { formatCurrency } from '@core/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { showConfirmationDialog } from '@ui/components.js';
import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions, PanelItem, UIContext } from '@ui/panelRegistry.js';
import { IPanelHandler } from '@ui/types.js';
import { getPaginatedItems, itemsPerPage } from '@ui/uiUtils.js';

export class EconomyPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return (
            panelId === 'economyPanel' ||
            panelId === 'mobDropsSystemPanel' ||
            panelId === 'addMobDropPanel' ||
            panelId === 'editMobDropPanel'
        );
    }

    async getItems(player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        await Promise.resolve();
        const items: PanelItem[] = [];
        const pData = getOrCreatePlayer(player);

        const addBack = (target: string) => {
            items.push({
                id: '__back__',
                text: '§l§8< Back',
                icon: 'textures/gui/controls/left.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: target
            });
        };

        const addPagination = (totalItems: number) => {
            const page = (context.page as number) || 1;
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            if (page > 1) {
                items.push({
                    id: '__prev__',
                    text: '§6< Previous Page',
                    icon: 'textures/ui/arrow_left.png',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'prevPage'
                });
            }
            if (page < totalPages) {
                items.push({
                    id: '__next__',
                    text: '§6Next Page >',
                    icon: 'textures/ui/arrow_right.png',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'nextPage'
                });
            }
        };

        if (panelId === 'economyPanel') {
            const def = panelDefinitions[panelId];
            if (isDefined(def)) {
                const staticItems = getStaticMenuItems(def, pData.permissionLevel);
                items.push(...staticItems);
            }
            return items;
        }

        if (panelId === 'mobDropsSystemPanel') {
            addBack('economyPanel');
            const def = panelDefinitions[panelId];
            if (isDefined(def)) {
                const staticItems = getStaticMenuItems(def, pData.permissionLevel);
                items.push(...staticItems);
            }

            const config = getEconomyConfig();
            const mobMoney = config.mobMoney;
            const mobs = Object.keys(mobMoney).toSorted((a, b) => a.localeCompare(b));

            const paginated = getPaginatedItems(mobs, (context.page as number) || 1);

            for (const mobId of paginated) {
                const amount = mobMoney[mobId] ?? 0;
                const color = amount >= 0 ? '§2' : '§c';
                items.push({
                    id: mobId,
                    text: `${mobId}\n${color}${formatCurrency(amount)}`,
                    icon: 'textures/ui/egg_icon',
                    permissionLevel: 1,
                    actionType: 'openPanel',
                    actionValue: 'editMobDropPanel'
                });
            }
            addPagination(mobs.length);
            return items;
        }

        if (panelId === 'editMobDropPanel') {
            addBack('mobDropsSystemPanel');
            const mobId = context.selectedItemId as string;
            if (!isNonEmptyString(mobId)) return items;

            items.push(
                {
                    id: 'edit',
                    text: 'Edit Value',
                    icon: 'textures/ui/icon_setting',
                    permissionLevel: 1,
                    actionType: 'functionCall',
                    actionValue: 'editMobValue'
                },
                {
                    id: 'delete',
                    text: '§4Delete',
                    icon: 'textures/ui/trash',
                    permissionLevel: 1,
                    actionType: 'functionCall',
                    actionValue: 'deleteMobDrop'
                }
            );
            return items;
        }

        return items;
    }

    async buildModal(_player: mc.Player, panelId: string, context: UIContext): Promise<ModalFormData | undefined> {
        await Promise.resolve();
        if (panelId === 'addMobDropPanel') {
            return new ModalFormData()
                .title('Add Mob Drop')
                .textField('Mob Identifier', 'e.g., minecraft:zombie')
                .textField('Reward Amount', 'Negative for penalty', { defaultValue: '0' });
        }
        if (panelId === 'editMobValue') {
            const config = getEconomyConfig();
            const mobId = context.selectedItemId as string;
            const currentVal = config.mobMoney[mobId] ?? 0;
            return new ModalFormData()
                .title(`Edit ${mobId}`)
                .textField('Reward Amount', 'Negative for penalty', { defaultValue: String(currentVal) });
        }
        return undefined;
    }

    async handleResponse(
        player: mc.Player,
        panelId: string,
        response: ActionFormResponse | ModalFormResponse,
        context: UIContext
    ): Promise<void> {
        const selection = (response as ActionFormResponse).selection;

        if (panelId === 'addMobDropPanel') {
            await this.handleAddMobDrop(player, response as ModalFormResponse, context);
            return;
        }

        if (panelId === 'editMobValue') {
            await this.handleEditMobValue(player, response as ModalFormResponse, context);
            return;
        }

        if (typeof selection === 'number') {
            await this.handleSelection(player, panelId, selection, context);
        }
    }

    private async handleAddMobDrop(player: mc.Player, response: ModalFormResponse, context: UIContext): Promise<void> {
        const values = response.formValues;
        if (response.canceled) return showPanel(player, 'mobDropsSystemPanel', context);
        const [mobId, amountStr] = values as [string, string];
        const amount = Number.parseInt(amountStr);

        if (isNonEmptyString(mobId) && !Number.isNaN(amount)) {
            const config = getEconomyConfig();
            config.mobMoney[mobId] = amount;
            saveEconomyConfig(config);
            player.sendMessage(`§2Added ${mobId} with reward ${formatCurrency(amount)}`);
        } else {
            player.sendMessage('§cInvalid input.');
        }
        return showPanel(player, 'mobDropsSystemPanel', { ...context, page: 1 });
    }

    private async handleEditMobValue(
        player: mc.Player,
        response: ModalFormResponse,
        context: UIContext
    ): Promise<void> {
        const values = response.formValues;
        if (response.canceled)
            return showPanel(player, 'editMobDropPanel', { ...context, id: context.selectedItemId ?? '' });
        const [amountStr] = values as [string];
        const amount = Number.parseInt(amountStr);
        const mobId = context.selectedItemId as string;

        if (!Number.isNaN(amount) && isNonEmptyString(mobId)) {
            const config = getEconomyConfig();
            config.mobMoney[mobId] = amount;
            saveEconomyConfig(config);
            player.sendMessage(`§2Updated ${mobId} to ${formatCurrency(amount)}`);
        }
        return showPanel(player, 'editMobDropPanel', { ...context, id: mobId });
    }

    private async handleSelection(
        player: mc.Player,
        panelId: string,
        selection: number,
        context: UIContext
    ): Promise<void> {
        const items = await this.getItems(player, panelId, context);
        if (selection >= 0 && selection < items.length) {
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
            if (item.actionValue === 'prevPage') {
                return showPanel(player, panelId, {
                    ...context,
                    page: Math.max(1, ((context.page as number) || 1) - 1)
                });
            }
            if (item.actionValue === 'nextPage') {
                return showPanel(player, panelId, { ...context, page: ((context.page as number) || 1) + 1 });
            }

            if (item.actionValue === 'editMobValue') {
                const modal = await this.buildModal(player, 'editMobValue', context);
                if (isDefined(modal)) {
                    const res = await modal.show(player);
                    return this.handleResponse(player, 'editMobValue', res, context);
                }
            }

            if (item.actionValue === 'deleteMobDrop') {
                const mobId = context.selectedItemId as string;
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
                        return showPanel(player, 'mobDropsSystemPanel', context);
                    },
                    onCancel: () => showPanel(player, 'editMobDropPanel', context)
                });
                return;
            }
        }
    }
}
