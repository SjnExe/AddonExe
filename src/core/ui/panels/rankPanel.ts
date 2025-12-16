import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { saveRanksConfig } from '@core/configurations.js';
import * as rankManager from '@core/rankManager.js';
import { RankDefinition } from '@core/ranksConfig.default.js';
import { showPanel } from '@core/uiManager.js';
import { handleUIAction } from '@ui/actions.js';
import { PanelItem, UIContext } from '@ui/panelRegistry.js';
import { IPanelHandler } from '@ui/types.js';
import { addBackButton } from '@ui/uiUtils.js';

export class RankPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId.startsWith('rank') || panelId.startsWith('addRank') || panelId.startsWith('editRank');
    }

    async getItems(player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        const items: PanelItem[] = [];

        if (panelId === 'rankManagementPanel') {
            addBackButton(items, 'configCategoryPanel');
            // Static items (Create, Settings) are already in panelRegistry.ts,
            // but we need to list the dynamic ranks.
            // Wait, panelBuilder combines static and dynamic.
            // We just return dynamic here.

            // Actually, we must include the static items if we are the handler,
            // OR the panelBuilder calls us for *additional* items.
            // Let's assume panelBuilder handles static items defined in registry
            // and appends our returned items.
            // Checking panelBuilder.ts logic...
            // It calls handler.getItems() and uses that. It does NOT merge with registry automatically unless we do it.
            // But checking other panels (adminPanel), it manually pushes static items.

            items.push({
                id: 'addRank',
                text: 'Create New Rank',
                icon: 'textures/ui/color_plus',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'addRankPanel',
                sortId: 0
            });
            items.push({
                id: 'rankSettings',
                text: 'Settings',
                icon: 'textures/ui/settings_glyph_color_2x',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'rankSettingsPanel',
                sortId: 1
            });

            const ranks = rankManager.getAllRanks();
            ranks.sort((a, b) => a.permissionLevel - b.permissionLevel);

            ranks.forEach((rank) => {
                items.push({
                    id: rank.id,
                    text: `§l${rank.name}§r\nLevel: ${rank.permissionLevel}`,
                    icon: 'textures/ui/permissions_op_crown', // Generic icon
                    permissionLevel: 1,
                    actionType: 'openPanel',
                    actionValue: 'editRankPanel'
                });
            });

            return items;
        }

        return items;
    }

    async buildModal(player: mc.Player, panelId: string, context: UIContext): Promise<ModalFormData | null> {
        if (panelId === 'addRankPanel') {
            return new ModalFormData()
                .title('Create Rank')
                .textField('Rank ID (Unique, no spaces)', 'e.g. vip')
                .textField('Display Name', 'e.g. §6VIP')
                .textField('Permission Level (0-1024)', '1024 = Default, 0 = Owner', '1024')
                .textField('Prefix', 'e.g. §6VIP', '')
                .textField('Name Color', 'e.g. §e', '§r')
                .textField('Chat Color', 'e.g. §f', '§r');
        }

        if (panelId === 'editRankPanel') {
            const rankId = context.id as string;
            const rank = rankManager.getRankById(rankId);
            if (!rank) return null;

            return new ModalFormData()
                .title(`Edit Rank: ${rank.name}`)
                .textField('Display Name', '', rank.name)
                .textField('Permission Level', '', String(rank.permissionLevel))
                .textField('Prefix', '', rank.chatFormatting?.prefixText || '')
                .textField('Name Color', '', rank.chatFormatting?.nameColor || '')
                .textField('Chat Color', '', rank.chatFormatting?.chatColor || '')
                .toggle('Is Locked (Prevent Deletion)', rank.locked || false);
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

        if (panelId === 'addRankPanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'rankManagementPanel');
            const [id, name, permStr, prefix, nameColor, chatColor] = values as string[];

            if (!id || !name || !permStr) {
                player.sendMessage('§cInvalid input.');
                return showPanel(player, 'rankManagementPanel');
            }

            const config = getRanksConfig();
            if (config.ranks.some((r) => r.id === id)) {
                player.sendMessage('§cRank ID already exists.');
                return showPanel(player, 'rankManagementPanel');
            }

            const newRank: RankDefinition = {
                id,
                name,
                permissionLevel: parseInt(permStr) || 1024,
                chatFormatting: {
                    prefixText: prefix,
                    nameColor,
                    chatColor
                },
                conditions: []
            };

            const newConfig = { ...config };
            newConfig.ranks.push(newRank);
            saveRanksConfig(newConfig);

            player.sendMessage(`§aRank ${name} created.`);
            return showPanel(player, 'rankManagementPanel');
        }

        if (panelId === 'editRankPanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'rankManagementPanel');
            const rankId = context.id as string;
            const [name, permStr, prefix, nameColor, chatColor, locked] = values as [
                string,
                string,
                string,
                string,
                string,
                boolean
            ];

            const config = getRanksConfig();
            const rankIndex = config.ranks.findIndex((r) => r.id === rankId);

            if (rankIndex === -1) {
                player.sendMessage('§cRank not found.');
                return showPanel(player, 'rankManagementPanel');
            }

            // Cannot edit locked ranks fully?
            // We allow editing logic, but maybe not deletion if locked.

            const updatedRank = { ...config.ranks[rankIndex] };
            updatedRank.name = name;
            updatedRank.permissionLevel = parseInt(permStr) || 1024;
            updatedRank.chatFormatting = {
                prefixText: prefix,
                nameColor,
                chatColor
            };
            updatedRank.locked = locked;

            const newConfig = { ...config };
            newConfig.ranks[rankIndex] = updatedRank;
            saveRanksConfig(newConfig);

            player.sendMessage(`§aRank ${name} updated.`);
            return showPanel(player, 'rankManagementPanel');
        }

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];

                if (item.actionType === 'openPanel') {
                    return showPanel(player, item.actionValue, {
                        ...context,
                        id: item.id,
                        selectedItemId: item.id
                    });
                }

                if (item.actionType === 'functionCall') {
                    await handleUIAction(player, item.actionValue, context);
                }
            }
        }
    }
}
