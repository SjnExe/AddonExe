import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getRanksConfig, saveRanksConfig } from '@core/configurations.js';
import * as rankManager from '@core/rankManager.js';
import { showPanel } from '@core/uiManager.js';
import { RankDefinition } from '@features/ranks/ranksConfig.js';
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
                    permission: 'ui.panel.admin',
                    actionType: 'openPanel',
                    actionValue: 'addRankPanel',
                    sortId: 0
                },
                {
                    id: 'rankSettings',
                    text: 'Settings',
                    icon: 'textures/ui/settings_glyph_color_2x',
                    permission: 'ui.panel.admin',
                    actionType: 'openPanel',
                    actionValue: 'rankSettingsPanel',
                    sortId: 1
                }
            );

            const ranks = rankManager.getAllRanks();
            ranks.sort((a, b) => a.priority - b.priority);

            for (const rank of ranks) {
                if (!isDefined(rank)) continue;
                items.push({
                    id: rank.id,
                    text: `§l${rank.name}§r\nPriority: ${rank.priority}`,
                    icon: 'textures/ui/permissions_op_crown', // Generic icon
                    permission: 'ui.panel.admin',
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
                    .textField('Allow Nodes (comma separated)', 'e.g. cmd.tp', { defaultValue: '' })
                    .textField('Deny Nodes (comma separated)', '', { defaultValue: '' })
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
                    .textField('Allow Nodes (comma separated)', 'e.g. cmd.tp', { defaultValue: rank.allow.join(', ') })
                    .textField('Deny Nodes (comma separated)', '', { defaultValue: rank.deny.join(', ') })
            );
        }

        return Promise.resolve();
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: UIContext): Promise<void> {
        const selection = (response as ActionFormResponse).selection;

        if (panelId === 'addRankPanel') {
            await this.handleAddRankResponse(player, response);
            return;
        }

        if (panelId === 'editRankPanel') {
            await this.handleEditRankResponse(player, response, context);
            return;
        }

        if (typeof selection === 'number') {
            await this.handleSelection(player, panelId, selection, context);
        }
    }

    private async handleAddRankResponse(player: mc.Player, response: ModalFormResponse): Promise<void> {
        const values = response.formValues;
        if (response.canceled) return showPanel(player, 'rankManagementPanel');
        const rawValues = values as (string | undefined)[];
        const [id, name, permStr, prefix, nameColor, messageColor, allowNodesStr, denyNodesStr] = rawValues;

        if (!isNonEmptyString(id) || !isNonEmptyString(name) || !isNonEmptyString(permStr)) {
            player.sendMessage('§cInvalid input.');
            return showPanel(player, 'rankManagementPanel');
        }

        const config = getRanksConfig();
        if (config.rankDefinitions.some((r) => r.id === id)) {
            player.sendMessage('§cRank ID already exists.');
            return showPanel(player, 'rankManagementPanel');
        }

        const { getPlayerRank } = await import('@core/rankManager.js');
        const { getConfig } = await import('@core/configManager.js');
        const editorPriority = getPlayerRank(player, getConfig()).priority;
        const parsedPriority = Number.parseInt(permStr, 10);
        const newPriority = Number.isNaN(parsedPriority) ? 1024 : parsedPriority;

        if (newPriority <= editorPriority) {
            player.sendMessage('§cYou cannot create a rank with a priority equal to or higher than your own.');
            return showPanel(player, 'rankManagementPanel');
        }

        const allowNodes = (allowNodesStr ?? '')
            .split(',')
            .map((n) => n.trim())
            .filter((n) => n !== '');

        const denyNodes = (denyNodesStr ?? '')
            .split(',')
            .map((n) => n.trim())
            .filter((n) => n !== '');

        const { canGrantPermissions } = await import('@core/permissionEngine.js');
        if (!canGrantPermissions(player, [...allowNodes, ...denyNodes])) {
            player.sendMessage('§cYou cannot grant or deny permissions you do not possess.');
            return showPanel(player, 'rankManagementPanel');
        }

        const newRank: RankDefinition = {
            id: id,
            name: name,
            priority: newPriority,
            permissionLevel: newPriority,
            chatFormatting: {
                prefixText: prefix ?? '',
                nameColor: nameColor ?? '§r',
                messageColor: messageColor ?? '§r'
            },
            conditions: [],
            locked: false,
            groups: ['default'],
            allow: allowNodes,
            deny: denyNodes
        };

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
        const rawValues = values as (string | boolean | undefined)[];
        const name = rawValues[0] as string | undefined;
        const permStr = rawValues[1] as string | undefined;
        const prefix = rawValues[2] as string | undefined;
        const nameColor = rawValues[3] as string | undefined;
        const messageColor = rawValues[4] as string | undefined;
        const locked = rawValues[5] as boolean | undefined;
        const allowNodesStr = rawValues[6] as string | undefined;
        const denyNodesStr = rawValues[7] as string | undefined;

        const config = getRanksConfig();
        const rankIndex = config.rankDefinitions.findIndex((r) => r.id === rankId);

        if (rankIndex === -1) {
            player.sendMessage('§cRank not found.');
            return showPanel(player, 'rankManagementPanel');
        }

        const existingRank = config.rankDefinitions[rankIndex];
        if (!isDefined(existingRank)) return showPanel(player, 'rankManagementPanel');

        const { getPlayerRank } = await import('@core/rankManager.js');
        const { getConfig } = await import('@core/configManager.js');
        const editorPriority = getPlayerRank(player, getConfig()).priority;

        if (existingRank.priority < editorPriority) {
            player.sendMessage('§cYou cannot edit a rank with a priority higher than your own.');
            return showPanel(player, 'rankManagementPanel');
        }

        const parsedPriority = Number.parseInt(permStr ?? '', 10);
        const newPriority = Number.isNaN(parsedPriority) ? existingRank.permissionLevel : parsedPriority;

        if (newPriority < editorPriority) {
            player.sendMessage('§cYou cannot assign a priority higher than your own.');
            return showPanel(player, 'rankManagementPanel');
        }

        const allowNodes = (allowNodesStr ?? '')
            .split(',')
            .map((n) => n.trim())
            .filter((n) => n !== '');

        const denyNodes = (denyNodesStr ?? '')
            .split(',')
            .map((n) => n.trim())
            .filter((n) => n !== '');

        const newAllowNodes = allowNodes.filter((n) => !existingRank.allow.includes(n));
        const newDenyNodes = denyNodes.filter((n) => !existingRank.deny.includes(n));

        const { canGrantPermissions } = await import('@core/permissionEngine.js');
        if (!canGrantPermissions(player, [...newAllowNodes, ...newDenyNodes])) {
            player.sendMessage('§cYou cannot grant or deny permissions you do not possess.');
            return showPanel(player, 'rankManagementPanel');
        }

        const updatedRank: RankDefinition = {
            ...existingRank,
            name: isNonEmptyString(name) ? name : existingRank.name,
            priority: newPriority,
            permissionLevel: newPriority,
            chatFormatting: {
                prefixText: isNonEmptyString(prefix) ? prefix : (existingRank.chatFormatting?.prefixText ?? ''),
                nameColor: isNonEmptyString(nameColor) ? nameColor : (existingRank.chatFormatting?.nameColor ?? '§r'),
                messageColor: isNonEmptyString(messageColor) ? messageColor : (existingRank.chatFormatting?.messageColor ?? '§r')
            },
            locked: (locked ?? existingRank.locked) === true,
            allow: allowNodes,
            deny: denyNodes
        };

        const { updateRank } = await import('@core/rankDb.js');
        const updateResult = updateRank(rankId, updatedRank);

        if (!updateResult.success) {
            player.sendMessage(`§c${updateResult.message}`);
            return showPanel(player, 'rankManagementPanel');
        }

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
