import { MinecraftBlockTypes, MinecraftDimensionTypes } from '@minecraft/vanilla-data';

import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getXrayConfig, saveXrayConfig } from '@core/configurations.js';
import { showPanel } from '@core/uiManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { IPanelHandler, PanelItem, UIContext } from '@ui/types.js';
import { addBackButton, addPaginationItems, getPaginatedItems } from '@ui/uiUtils.js';

export class XrayPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'xrayOresPanel' || panelId === 'addXrayOrePanel' || panelId === 'editXrayOrePanel' || panelId.startsWith('editXrayOrePanel_');
    }

    async getItems(_player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        await Promise.resolve();
        const items: PanelItem[] = [];

        if (panelId === 'xrayOresPanel') {
            addBackButton(items, 'configCategoryPanel', 'ui.panel.admin');
            items.push({
                id: 'addOre',
                text: '§l§2+ Add Ore',
                icon: 'textures/ui/color_plus',
                permission: 'ui.panel.admin',
                actionType: 'openPanel',
                actionValue: 'addXrayOrePanel'
            });

            const config = getXrayConfig();
            const oreKeys = Object.keys(config.monitoredOreTypes);
            const paginated = getPaginatedItems(oreKeys, (context.page as number) || 1);

            for (const key of paginated) {
                const ore = config.monitoredOreTypes[key];
                if (!isDefined(ore)) continue;
                items.push({
                    id: key,
                    text: `${ore.oreName}\n${ore.enabled ? '§2[Enabled]' : '§4[Disabled]'}`,
                    icon: 'textures/blocks/diamond_ore',
                    permission: 'ui.panel.admin',
                    actionType: 'openPanel',
                    actionValue: `editXrayOrePanel_${key}`
                });
            }
            addPaginationItems(items, (context.page as number) || 1, oreKeys.length, 'ui.panel.admin');
            return items;
        }

        return items;
    }

    async buildModal(_player: mc.Player, panelId: string, _context: UIContext): Promise<ModalFormData | undefined> {
        await Promise.resolve();
        if (panelId === 'addXrayOrePanel') {
            return new ModalFormData()
                .title('Add X-Ray Ore')
                .textField('Internal ID (no spaces)', 'diamond')
                .textField('Display Name', 'Diamond Ore')
                .textField('Block ID', MinecraftBlockTypes.DiamondOre)
                .textField('Dimension', MinecraftDimensionTypes.Overworld)
                .textField('Min Y', '-64')
                .textField('Max Y', '16');
        }

        if (panelId.startsWith('editXrayOrePanel_')) {
            const key = panelId.replace('editXrayOrePanel_', '');
            const config = getXrayConfig();
            const ore = config.monitoredOreTypes[key];
            if (!isDefined(ore)) return undefined;

            // Simplify: Only edit first block definition for now in UI
            const block = ore.blocks[0] ?? { blockId: '', dimensionId: MinecraftDimensionTypes.Overworld, minY: -64, maxY: 320 };

            return new ModalFormData()
                .title(`Edit ${ore.oreName}`)
                .toggle('Enabled', { defaultValue: ore.enabled })
                .textField('Display Name', 'Name', { defaultValue: ore.oreName })
                .textField('Block ID', 'ID', { defaultValue: block.blockId })
                .textField('Dimension', 'ID', { defaultValue: block.dimensionId })
                .textField('Min Y', 'Y', { defaultValue: String(block.minY) })
                .textField('Max Y', 'Y', { defaultValue: String(block.maxY) });
        }
        return undefined;
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: UIContext): Promise<void> {
        const selection = (response as ActionFormResponse).selection;
        const values = (response as ModalFormResponse).formValues;

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];
                if (!isDefined(item)) return;
                if (item.actionType === 'openPanel') {
                    return showPanel(player, item.actionValue, { ...context, page: 1 });
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
            }
        }

        if (panelId === 'addXrayOrePanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'xrayOresPanel');
            if (!isDefined(values)) return showPanel(player, 'xrayOresPanel');
            const [id, name, blockId, dimId, minY, maxY] = values as string[];
            if (isNonEmptyString(id) && isNonEmptyString(name) && isNonEmptyString(blockId) && isNonEmptyString(minY) && isNonEmptyString(maxY)) {
                const config = getXrayConfig();
                config.monitoredOreTypes[id] = {
                    enabled: true,
                    oreName: name,
                    blocks: [
                        {
                            blockId,
                            dimensionId: isNonEmptyString(dimId) ? dimId : MinecraftDimensionTypes.Overworld,
                            minY: Number.parseInt(minY) || -64,
                            maxY: Number.parseInt(maxY) || 320
                        }
                    ]
                };
                saveXrayConfig(config);
                player.sendMessage('§aOre added.');
            }
            return showPanel(player, 'xrayOresPanel');
        }

        if (panelId.startsWith('editXrayOrePanel_')) {
            const key = panelId.replace('editXrayOrePanel_', '');
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'xrayOresPanel');
            if (isDefined(values)) {
                const [enabled, name, blockId, dimId, minY, maxY] = values as [boolean, string, string, string, string, string];
                const config = getXrayConfig();
                if (isDefined(config.monitoredOreTypes[key])) {
                    config.monitoredOreTypes[key].enabled = enabled;
                    config.monitoredOreTypes[key].oreName = name;
                    config.monitoredOreTypes[key].blocks[0] = {
                        blockId,
                        dimensionId: dimId,
                        minY: Number.parseInt(minY),
                        maxY: Number.parseInt(maxY)
                    };
                    saveXrayConfig(config);
                    player.sendMessage('§aOre updated.');
                }
            }
            // Add Delete option logic via ActionForm? Or just in Modal?
            // Modal doesn't have buttons.
            // I should add a "Delete" button in the Item List or a separate Action Menu.
            // For now, simple edit.
            return showPanel(player, 'xrayOresPanel');
        }
    }
}
