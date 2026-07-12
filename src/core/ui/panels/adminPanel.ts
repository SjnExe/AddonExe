import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { showPanel } from '@core/uiManager.js';
import { formatLocation } from '@core/utils.js';
import * as floatingTextManager from '@features/essentials/floatingTextManager.js';
import { isDefined, isNonEmptyString, isNumber } from '@lib/guards.js';
import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions, PanelItem, UIContext } from '@ui/panelRegistry.js';
import { IPanelHandler } from '@ui/types.js';
import { addBackButton } from '@ui/uiUtils.js';

export class AdminPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'staffDashboardPanel' || panelId.startsWith('floatingText');
    }

    getItems(player: mc.Player, panelId: string, _context: UIContext): Promise<PanelItem[]> {
        const items: PanelItem[] = [];
        // Admin Panel uses static items (delegates to sub-panels)
        if (panelId === 'staffDashboardPanel') {
            const def = panelDefinitions[panelId];
            if (isDefined(def)) {
                const staticItems = getStaticMenuItems(player, def);
                items.push(...staticItems);
            }
            return Promise.resolve(items);
        }

        if (panelId === 'floatingTextListPanel') {
            addBackButton(items, 'staffDashboardPanel');
            items.push(
                {
                    id: 'placeholderList',
                    text: '§l§6View Placeholders',
                    icon: 'textures/ui/icon_sign',
                    permission: 'ui.panel.admin',
                    actionType: 'openPanel',
                    actionValue: 'placeholderListPanel'
                },
                {
                    id: 'create',
                    text: '§l§2+ Create New',
                    icon: 'textures/ui/color_plus',
                    permission: 'ui.panel.admin',
                    actionType: 'openPanel',
                    actionValue: 'floatingTextCreatePanel'
                }
            );

            const texts = floatingTextManager.getAllTexts();
            for (const text of texts) {
                items.push({
                    id: text.id,
                    text: `§6${text.id}§r\n${formatLocation(text.location)}`,
                    permission: 'ui.panel.admin',
                    actionType: 'openPanel',
                    actionValue: 'floatingTextActionPanel'
                });
            }
            return Promise.resolve(items);
        }

        if (panelId === 'floatingTextActionPanel') {
            addBackButton(items, 'floatingTextListPanel');
            items.push(
                {
                    id: 'edit',
                    text: 'Edit Settings',
                    icon: 'textures/ui/icon_setting',
                    permission: 'ui.panel.admin',
                    actionType: 'openPanel',
                    actionValue: 'floatingTextEditPanel'
                },
                {
                    id: 'respawn',
                    text: 'Respawn Entity',
                    icon: 'textures/ui/refresh_light',
                    permission: 'ui.panel.admin',
                    actionType: 'functionCall',
                    actionValue: 'respawnText'
                },
                {
                    id: 'despawn',
                    text: 'Despawn Entity',
                    icon: 'textures/ui/cancel',
                    permission: 'ui.panel.admin',
                    actionType: 'functionCall',
                    actionValue: 'despawnText'
                },
                {
                    id: 'delete',
                    text: '§4Delete Text',
                    icon: 'textures/ui/trash',
                    permission: 'ui.panel.admin',
                    actionType: 'functionCall',
                    actionValue: 'deleteText'
                }
            );
            return Promise.resolve(items);
        }

        return Promise.resolve(items);
    }

    buildModal(_player: mc.Player, panelId: string, context: UIContext): Promise<ModalFormData | undefined | void> {
        if (panelId === 'floatingTextCreatePanel') {
            return Promise.resolve(
                new ModalFormData().title('Create New Floating Text').textField('Unique ID (no spaces)', 'e.g., "welcome_message"').textField('Text Content', 'Enter text to display')
            );
        }

        if (panelId === 'floatingTextEditPanel') {
            const id = (context.id ?? context.selectedItemId) as string;
            if (!isNonEmptyString(id)) return Promise.resolve();
            const text = floatingTextManager.getTextById(id);
            if (!isDefined(text)) return Promise.resolve();
            const expiresAt = text.expiresAt;
            const updateInterval = text.updateInterval ?? 0;
            const dimensionOptions = ['Overworld', 'Nether', 'The End'];
            const dimensionIds = [MinecraftDimensionTypes.Overworld, MinecraftDimensionTypes.Nether, MinecraftDimensionTypes.TheEnd];
            const defaultDimensionIndex = Math.max(0, dimensionIds.indexOf(text.dimension as MinecraftDimensionTypes));
            return Promise.resolve(
                new ModalFormData()
                    .title(`Edit: ${id}`)
                    .textField('Text Content', 'Enter the text to display', { defaultValue: text.text })
                    .textField('X', 'X', { defaultValue: String(text.location.x.toFixed(2)) })
                    .textField('Y', 'Y', { defaultValue: String(text.location.y.toFixed(2)) })
                    .textField('Z', 'Z', { defaultValue: String(text.location.z.toFixed(2)) })
                    .dropdown('Dimension', dimensionOptions, { defaultValueIndex: defaultDimensionIndex })
                    .textField('Update Interval', '0 to disable', { defaultValue: String(updateInterval) })
                    .toggle('Expiration', { defaultValue: isNumber(expiresAt) })
                    .textField('Expiration (mins)', 'mins', {
                        defaultValue: isNumber(expiresAt) ? String(Math.round((expiresAt - Date.now()) / 60_000)) : '0'
                    })
            );
        }
        return Promise.resolve();
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: UIContext): Promise<void> {
        const selection = (response as ActionFormResponse).selection;
        const values = (response as ModalFormResponse).formValues;

        if (panelId === 'floatingTextCreatePanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'floatingTextListPanel');
            const rawValues = (values ?? []) as (string | undefined)[];
            const id = rawValues[0];
            const text = rawValues[1];

            if (!isNonEmptyString(id) || id.includes(' ')) {
                player.sendMessage('§4Invalid ID.');
                return showPanel(player, 'floatingTextCreatePanel');
            }
            if (floatingTextManager.createText(player, id, isNonEmptyString(text) ? text : '')) {
                // Success msg in manager
            }
            return showPanel(player, 'floatingTextListPanel');
        }

        if (panelId === 'floatingTextEditPanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'floatingTextActionPanel', context);
            const id = context.id as string;
            const rawValues = values ?? [];

            const textContent = rawValues[0] as string;
            const x = rawValues[1] as string;
            const y = rawValues[2] as string;
            const z = rawValues[3] as string;
            const dimensionIndex = rawValues[4] as number;
            const updateIntervalStr = rawValues[5] as string;
            const useExpiration = rawValues[6] as boolean;
            const expirationMinutes = rawValues[7] as string;

            const dimensionIds = [MinecraftDimensionTypes.Overworld, MinecraftDimensionTypes.Nether, MinecraftDimensionTypes.TheEnd];
            const selectedDimension = (isDefined(dimensionIndex) ? dimensionIds[dimensionIndex] : undefined) ?? MinecraftDimensionTypes.Overworld;

            const updatedConfig = {
                text: textContent,
                location: { x: Number.parseFloat(x), y: Number.parseFloat(y), z: Number.parseFloat(z) },
                dimension: selectedDimension,
                updateInterval: Number.parseInt(updateIntervalStr) || 0,
                expiresAt: useExpiration === true && Number(expirationMinutes) > 0 ? Date.now() + Number(expirationMinutes) * 60_000 : undefined
            };
            floatingTextManager.updateText(id, updatedConfig);
            player.sendMessage(`§2Successfully updated floating text: ${id}`);
            return showPanel(player, 'floatingTextActionPanel', context);
        }

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];
                if (!isDefined(item)) return;
                if (item.actionType === 'openPanel') {
                    const newContext = {
                        ...context,
                        page: 1,
                        selectedItemId: item.id,
                        id: item.id
                    };

                    // Fix: Preserve the floating text ID when navigating to the edit panel
                    if (panelId === 'floatingTextActionPanel' && item.actionValue === 'floatingTextEditPanel') {
                        newContext.id = context.id as string;
                    }

                    return showPanel(player, item.actionValue, newContext);
                }
                const actionContext = {
                    ...context,
                    selectedItemId: item.id,
                    id: item.id
                };

                if (panelId === 'floatingTextActionPanel') {
                    actionContext.id = context.id as string;
                }

                if (item.actionValue === 'showRules') {
                    return showPanel(player, 'rulesManagementPanel', actionContext);
                }
                if (item.actionValue === 'showHelpfulLinks') {
                    return showPanel(player, 'helpfulLinksManagementPanel', actionContext);
                }
                if (item.actionValue === 'respawnText') {
                    const { respawnText } = await import('@features/essentials/floatingTextManager.js');
                    if (isNonEmptyString(actionContext.id)) {
                        try {
                            respawnText(actionContext.id);
                            player.sendMessage(`§2Respawned text: ${actionContext.id}`);
                        } catch (error) {
                            player.sendMessage(`§4Error respawning text: ${String(error)}`);
                        }
                    }
                    return showPanel(player, 'floatingTextActionPanel', actionContext);
                }
                if (item.actionValue === 'despawnText') {
                    const { despawnText } = await import('@features/essentials/floatingTextManager.js');
                    if (isNonEmptyString(actionContext.id)) {
                        try {
                            despawnText(actionContext.id);
                            player.sendMessage(`§2Despawned text: ${actionContext.id}`);
                        } catch (error) {
                            player.sendMessage(`§4Error despawning text: ${String(error)}`);
                        }
                    }
                    return showPanel(player, 'floatingTextActionPanel', actionContext);
                }
                if (item.actionValue === 'deleteText') {
                    const { deleteText } = await import('@features/essentials/floatingTextManager.js');
                    if (isNonEmptyString(actionContext.id)) {
                        try {
                            deleteText(player, actionContext.id);
                        } catch (error) {
                            player.sendMessage(`§4Error deleting text: ${String(error)}`);
                        }
                    }
                    return showPanel(player, 'floatingTextListPanel', actionContext);
                }

                const { uiActionFunctions } = await import('@core/ui/actionRegistry.js');
                const action = uiActionFunctions[item.actionValue];
                if (isDefined(action)) {
                    await action(player, context, panelId);
                    return;
                }

                player.sendMessage(`§cAction ${item.actionValue} not mapped.`);
                return;
            }
        }
    }
}
