import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getXrayConfig, saveXrayConfig } from '../../../core/configurations.js';
import { IPanelHandler, PanelItem, UIContext } from '../../../core/ui/types.js';
import { getPaginatedItems, itemsPerPage } from '../../../core/ui/uiUtils.js';
import { showPanel } from '../../../core/uiManager.js';

export class XrayPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'xrayOresPanel' || panelId === 'addXrayOrePanel' || panelId.startsWith('editXrayOrePanel_');
    }

    async getItems(_player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        await Promise.resolve();
        const items: PanelItem[] = [];

        const addBack = (target: string) => {
            items.push({
                id: '__back__',
                text: '§l§8< Back',
                icon: 'textures/gui/controls/left.png',
                permissionLevel: 1,
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
                    permissionLevel: 1,
                    actionType: 'functionCall',
                    actionValue: 'prevPage'
                });
            }
            if (page < totalPages) {
                items.push({
                    id: '__next__',
                    text: '§6Next Page >',
                    icon: 'textures/ui/arrow_right.png',
                    permissionLevel: 1,
                    actionType: 'functionCall',
                    actionValue: 'nextPage'
                });
            }
        };

        if (panelId === 'xrayOresPanel') {
            addBack('configCategoryPanel');
            items.push({
                id: 'addOre',
                text: '§l§2+ Add Ore',
                icon: 'textures/ui/color_plus',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'addXrayOrePanel'
            });

            const config = getXrayConfig();
            const oreKeys = Object.keys(config.monitoredOreTypes);
            const paginated = getPaginatedItems(oreKeys, (context.page as number) || 1);

            paginated.forEach((key) => {
                const ore = config.monitoredOreTypes[key];
                items.push({
                    id: key,
                    text: `${ore.oreName}\n${ore.enabled ? '§2[Enabled]' : '§4[Disabled]'}`,
                    icon: 'textures/blocks/diamond_ore',
                    permissionLevel: 1,
                    actionType: 'openPanel',
                    actionValue: `editXrayOrePanel_${key}`
                });
            });
            addPagination(oreKeys.length);
            return items;
        }

        return items;
    }

    async buildModal(_player: mc.Player, panelId: string, _context: UIContext): Promise<ModalFormData | null> {
        await Promise.resolve();
        if (panelId === 'addXrayOrePanel') {
            return new ModalFormData()
                .title('Add X-Ray Ore')
                .textField('Internal ID (no spaces)', 'diamond')
                .textField('Display Name', 'Diamond Ore')
                .textField('Block ID', 'minecraft:diamond_ore')
                .textField('Dimension', 'minecraft:overworld')
                .textField('Min Y', '-64')
                .textField('Max Y', '16');
        }

        if (panelId.startsWith('editXrayOrePanel_')) {
            const key = panelId.replace('editXrayOrePanel_', '');
            const config = getXrayConfig();
            const ore = config.monitoredOreTypes[key];
            if (!ore) return null;

            // Simplify: Only edit first block definition for now in UI
            const block = ore.blocks[0] || { blockId: '', dimensionId: 'minecraft:overworld', minY: -64, maxY: 320 };

            return new ModalFormData()
                .title(`Edit ${ore.oreName}`)
                .toggle('Enabled', { defaultValue: ore.enabled })
                .textField('Display Name', 'Name', { defaultValue: ore.oreName })
                .textField('Block ID', 'ID', { defaultValue: block.blockId })
                .textField('Dimension', 'ID', { defaultValue: block.dimensionId })
                .textField('Min Y', 'Y', { defaultValue: String(block.minY) })
                .textField('Max Y', 'Y', { defaultValue: String(block.maxY) });
        }
        return null;
    }

    async handleResponse(
        player: mc.Player,
        panelId: string,
        response: ActionFormResponse | ModalFormResponse,
        context: UIContext
    ): Promise<void> {
        const selection = (response as ActionFormResponse).selection;
        const values = (response as ModalFormResponse).formValues;

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];
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
            const [id, name, blockId, dimId, minY, maxY] = values as string[];
            if (id && name && blockId) {
                const config = getXrayConfig();
                config.monitoredOreTypes[id] = {
                    enabled: true,
                    oreName: name,
                    blocks: [
                        {
                            blockId,
                            dimensionId: dimId || 'minecraft:overworld',
                            minY: parseInt(minY) || -64,
                            maxY: parseInt(maxY) || 320
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
            if (values) {
                const [enabled, name, blockId, dimId, minY, maxY] = values as [
                    boolean,
                    string,
                    string,
                    string,
                    string,
                    string
                ];
                const config = getXrayConfig();
                if (config.monitoredOreTypes[key]) {
                    config.monitoredOreTypes[key].enabled = enabled;
                    config.monitoredOreTypes[key].oreName = name;
                    config.monitoredOreTypes[key].blocks[0] = {
                        blockId,
                        dimensionId: dimId,
                        minY: parseInt(minY),
                        maxY: parseInt(maxY)
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
