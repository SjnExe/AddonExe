/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getRanksConfig, saveRanksConfig } from '@core/configurations.js';
import * as rankManager from '@core/rankManager.js';
import { RankDefinition } from '@core/ranksConfig.default.js';
import { showPanel } from '@core/uiManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { PanelItem, UIContext } from '@ui/panelRegistry.js';
import { IPanelHandler } from '@ui/types.js';
import { addBackButton } from '@ui/uiUtils.js';

export class RankPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId.startsWith('rank') || panelId.startsWith('addRank') || panelId.startsWith('editRank');
    }

    getItems(_player: mc.Player, panelId: string, _context: UIContext): Promise<PanelItem[]> {
        const items: PanelItem[] = [];

        if (panelId === 'rankManagementPanel') {
            addBackButton(items, 'configCategoryPanel');

            items.push(
                {
                    id: 'addRank',
                    text: 'Create New Rank',
                    icon: 'textures/ui/color_plus',
                    permissionLevel: 1,
                    actionType: 'openPanel',
                    actionValue: 'addRankPanel',
                    sortId: 0
                },
                {
                    id: 'rankSettings',
                    text: 'Settings',
                    icon: 'textures/ui/settings_glyph_color_2x',
                    permissionLevel: 1,
                    actionType: 'openPanel',
                    actionValue: 'rankSettingsPanel',
                    sortId: 1
                }
            );

            const ranks = rankManager.getAllRanks();
            ranks.sort((a, b) => a.permissionLevel - b.permissionLevel);

            for (const rank of ranks) {
                if (!isDefined(rank)) continue;
                items.push({
                    id: rank.id,
                    text: `§l${rank.name}§r\nLevel: ${rank.permissionLevel}`,
                    icon: 'textures/ui/permissions_op_crown', // Generic icon
                    permissionLevel: 1,
                    actionType: 'openPanel',
                    actionValue: 'editRankPanel'
                });
            }

            return Promise.resolve(items);
        }

        return Promise.resolve(items);
    }

    buildModal(_player: mc.Player, panelId: string, context: UIContext): Promise<ModalFormData | undefined | void> {
        if (panelId === 'addRankPanel') {
            return Promise.resolve(
                new ModalFormData()
                    .title('Create Rank')
                    .textField('Rank ID (Unique, no spaces)', 'e.g. vip')
                    .textField('Display Name', 'e.g. §6VIP')
                    .textField('Permission Level (0-1024)', '1024 = Default, 0 = Owner', { defaultValue: '1024' })
                    .textField('Prefix', 'e.g. §6VIP', { defaultValue: '' })
                    .textField('Name Color', 'e.g. §e', { defaultValue: '§r' })
                    .textField('Chat Color', 'e.g. §f', { defaultValue: '§r' })
            );
        }

        if (panelId === 'editRankPanel') {
            const rankId = context.id as string;
            const rank = isNonEmptyString(rankId) ? rankManager.getRankById(rankId) : undefined;
            if (!isDefined(rank)) return Promise.resolve();

            return Promise.resolve(
                new ModalFormData()
                    .title(`Edit Rank: ${rank.name}`)
                    .textField('Display Name', '', { defaultValue: rank.name })
                    .textField('Permission Level', '', { defaultValue: String(rank.permissionLevel) })
                    .textField('Prefix', '', {
                        defaultValue: rank.chatFormatting?.prefixText ?? ''
                    })
                    .textField('Name Color', '', {
                        defaultValue: rank.chatFormatting?.nameColor ?? ''
                    })
                    .textField('Chat Color', '', {
                        defaultValue: rank.chatFormatting?.messageColor ?? ''
                    })
                    .toggle('Is Locked (Prevent Deletion)', { defaultValue: rank.locked === true })
            );
        }

        return Promise.resolve();
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: UIContext): Promise<void> {
        const selection = (response as ActionFormResponse).selection;

        if (panelId === 'addRankPanel') {
            await this.handleAddRankResponse(player, response as ModalFormResponse);
            return;
        }

        if (panelId === 'editRankPanel') {
            await this.handleEditRankResponse(player, response as ModalFormResponse, context);
            return;
        }

        if (typeof selection === 'number') {
            await this.handleSelection(player, panelId, selection, context);
        }
    }

    private async handleAddRankResponse(player: mc.Player, response: ModalFormResponse): Promise<void> {
        const values = response.formValues;
        if (response.canceled) return showPanel(player, 'rankManagementPanel');
        const rawValues = (values as (string | undefined)[]) ?? [];
        const [id, name, permStr, prefix, nameColor, messageColor] = rawValues;

        if (!isNonEmptyString(id) || !isNonEmptyString(name) || !isNonEmptyString(permStr)) {
            player.sendMessage('§cInvalid input.');
            return showPanel(player, 'rankManagementPanel');
        }

        const config = getRanksConfig();
        if (config.rankDefinitions.some((r) => r.id === id)) {
            player.sendMessage('§cRank ID already exists.');
            return showPanel(player, 'rankManagementPanel');
        }

        const newRank: RankDefinition = {
            id: id,
            name: name,
            permissionLevel: Number.parseInt(permStr) || 1024,
            chatFormatting: {
                prefixText: prefix ?? '',
                nameColor: nameColor ?? '§r',
                messageColor: messageColor ?? '§r'
            },
            conditions: [],
            locked: false
        } satisfies RankDefinition;

        const newConfig = { ...config };
        newConfig.rankDefinitions.push(newRank);
        saveRanksConfig(newConfig);

        player.sendMessage(`§aRank ${name} created.`);
        return showPanel(player, 'rankManagementPanel');
    }

    private async handleEditRankResponse(player: mc.Player, response: ModalFormResponse, context: UIContext): Promise<void> {
        const values = response.formValues;
        if (response.canceled) return showPanel(player, 'rankManagementPanel');
        const rankId = context.id as string;
        const rawValues = (values as (string | boolean | undefined)[]) ?? [];
        const name = rawValues[0] as string | undefined;
        const permStr = rawValues[1] as string | undefined;
        const prefix = rawValues[2] as string | undefined;
        const nameColor = rawValues[3] as string | undefined;
        const messageColor = rawValues[4] as string | undefined;
        const locked = rawValues[5] as boolean | undefined;

        const config = getRanksConfig();
        const rankIndex = config.rankDefinitions.findIndex((r) => r.id === rankId);

        if (rankIndex === -1) {
            player.sendMessage('§cRank not found.');
            return showPanel(player, 'rankManagementPanel');
        }

        const existingRank = config.rankDefinitions[rankIndex];
        if (!isDefined(existingRank)) return showPanel(player, 'rankManagementPanel');

        const updatedRank: RankDefinition = {
            ...existingRank,
            name: isNonEmptyString(name) ? name : existingRank.name,
            permissionLevel: isNonEmptyString(permStr) ? Number.parseInt(permStr) || 1024 : existingRank.permissionLevel,
            chatFormatting: {
                prefixText: isNonEmptyString(prefix) ? prefix : (existingRank.chatFormatting?.prefixText ?? ''),
                nameColor: isNonEmptyString(nameColor) ? nameColor : (existingRank.chatFormatting?.nameColor ?? '§r'),
                messageColor: isNonEmptyString(messageColor) ? messageColor : (existingRank.chatFormatting?.messageColor ?? '§r')
            },
            locked: (locked ?? existingRank.locked) === true
        };

        const newConfig = { ...config };
        newConfig.rankDefinitions[rankIndex] = updatedRank;
        saveRanksConfig(newConfig);

        player.sendMessage(`§aRank ${name} updated.`);
        return showPanel(player, 'rankManagementPanel');
    }

    private async handleSelection(player: mc.Player, panelId: string, selection: number, context: UIContext): Promise<void> {
        const items = await this.getItems(player, panelId, context);
        if (selection >= 0 && selection < items.length) {
            const item = items[selection];
            if (!isDefined(item)) return;

            if (item.actionType === 'openPanel') {
                return showPanel(player, item.actionValue, {
                    ...context,
                    id: item.id,
                    selectedItemId: item.id
                });
            }

            const { uiActionFunctions } = await import('@core/ui/actionRegistry.js');
            const action = uiActionFunctions[item.actionValue];
            if (isDefined(action)) {
                await action(player, context, panelId);
                return;
            }

            player.sendMessage(`§cAction ${item.actionValue} not mapped.`);
        }
    }
}
