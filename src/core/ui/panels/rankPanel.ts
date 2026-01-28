import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getRanksConfig, saveRanksConfig } from '@core/configurations.js';
import * as rankManager from '@core/rankManager.js';
import { RankDefinition } from '@core/ranksConfig.default.js';
import { showPanel } from '@core/uiManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { handleUIAction } from '@ui/actions.js';
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
            // Static items (Create, Settings) are already in panelRegistry.ts,
            // but we need to list the dynamic ranks.
            // Wait, panelBuilder combines static and dynamic.
            // We just return dynamic here.

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
                        defaultValue:
                            (isDefined(rank.chatFormatting) ? rank.chatFormatting.prefixText : undefined) ?? ''
                    })
                    .textField('Name Color', '', {
                        defaultValue: (isDefined(rank.chatFormatting) ? rank.chatFormatting.nameColor : undefined) ?? ''
                    })
                    .textField('Chat Color', '', {
                        defaultValue:
                            (isDefined(rank.chatFormatting) ? rank.chatFormatting.messageColor : undefined) ?? ''
                    })
                    .toggle('Is Locked (Prevent Deletion)', { defaultValue: rank.locked === true })
            );
        }

        return Promise.resolve();
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

        if (panelId === 'editRankPanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'rankManagementPanel');
            const rankId = context.id as string;
            const rawValues = (values as (string | boolean | undefined)[]) ?? [];
            const [name, permStr, prefix, nameColor, messageColor, locked] = rawValues as [
                string | undefined,
                string | undefined,
                string | undefined,
                string | undefined,
                string | undefined,
                boolean | undefined
            ];

            const config = getRanksConfig();
            const rankIndex = config.rankDefinitions.findIndex((r) => r.id === rankId);

            if (rankIndex === -1) {
                player.sendMessage('§cRank not found.');
                return showPanel(player, 'rankManagementPanel');
            }

            // Cannot edit locked ranks fully?
            // We allow editing logic, but maybe not deletion if locked.

            const existingRank = config.rankDefinitions[rankIndex];
            if (!isDefined(existingRank)) return showPanel(player, 'rankManagementPanel');

            const updatedRank: RankDefinition = {
                ...existingRank,
                name: isNonEmptyString(name) ? name : existingRank.name,
                permissionLevel: isNonEmptyString(permStr)
                    ? Number.parseInt(permStr) || 1024
                    : existingRank.permissionLevel,
                chatFormatting: {
                    prefixText:
                        isNonEmptyString(prefix)
                            ? prefix
                            : (isDefined(existingRank.chatFormatting)
                                ? existingRank.chatFormatting.prefixText
                                : undefined) ?? '',
                    nameColor:
                        isNonEmptyString(nameColor)
                            ? nameColor
                            : (isDefined(existingRank.chatFormatting)
                                ? existingRank.chatFormatting.nameColor
                                : undefined) ?? '§r',
                    messageColor:
                        isNonEmptyString(messageColor)
                            ? messageColor
                            : (isDefined(existingRank.chatFormatting)
                                ? existingRank.chatFormatting.messageColor
                                : undefined) ?? '§r'
                },
                locked: (locked ?? existingRank.locked) === true
            };

            const newConfig = { ...config };
            newConfig.rankDefinitions[rankIndex] = updatedRank;
            saveRanksConfig(newConfig);

            player.sendMessage(`§aRank ${name} updated.`);
            return showPanel(player, 'rankManagementPanel');
        }

        if (typeof selection === 'number') {
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

                await handleUIAction(player, item.actionValue, context);
            }
        }
    }
}
