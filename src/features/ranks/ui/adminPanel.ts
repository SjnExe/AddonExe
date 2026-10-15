import { getConfig, updateMultipleConfig } from '@core/configManager.js';
import { getRanksConfig, saveRanksConfig } from '@core/configurations.js';
import { getAllPlayersFromCache } from '@core/playerCache.js';
import { reloadRanks, updatePlayerNameTag } from '@core/rankManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/CustomFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';
import { RankCondition, RankDefinition } from '../ranksConfig.js';

function refreshOnlineNameTags(): void {
    const mainConfig = getConfig();
    for (const p of getAllPlayersFromCache()) {
        try {
            updatePlayerNameTag(p, mainConfig);
        } catch {
            // Ignore invalid player refs
        }
    }
}

export async function showRankSystemConfigPanel(player: mc.Player): Promise<void> {
    const config = getRanksConfig();
    const ranks = config.rankDefinitions;

    const form = new ActionFormBuilder().title('Ranks System Configuration');

    form.button('§2Create New Rank', 'textures/ui/color_plus', () => {
        void showRankEditorPanel(player);
    });

    form.button('§6Permission Groups', 'textures/ui/permissions_op_crown', () => {
        void showPermissionGroupsPanel(player);
    });

    form.button('§bGlobal Rank & Chat Defaults', 'textures/ui/icon_setting', () => {
        void showGlobalRankDefaultsPanel(player);
    });

    for (const rank of ranks) {
        form.button(`§l${rank.name}§r\nID: ${rank.id} | Priority: ${rank.priority}`, 'textures/ui/permissions_member_star', () => {
            void showRankActionPanel(player, rank.id);
        });
    }

    form.addBackButton(async () => {
        const { showConfigCategoryPanel } = await import('@core/ui/panels/configPanel.js');
        await showConfigCategoryPanel(player);
    });

    await form.show(player);
}

export async function showPermissionGroupsPanel(player: mc.Player): Promise<void> {
    const config = getRanksConfig();
    const groups = config.permissionGroups;

    const form = new ActionFormBuilder()
        .title('Permission Groups')
        .body('Manage reusable permission node groups assigned to ranks:')
        .button('§2+ Create Permission Group', 'textures/ui/color_plus', () => {
            void showEditPermissionGroupModal(player);
        });

    for (const [groupName, nodes] of Object.entries(groups)) {
        form.button(`§l${groupName}§r\n§7${nodes.length} node(s): ${nodes.slice(0, 2).join(', ')}`, 'textures/ui/permissions_op_crown', () => {
            void showEditPermissionGroupModal(player, groupName);
        });
    }

    form.addBackButton(async () => {
        await showRankSystemConfigPanel(player);
    });

    await form.show(player);
}

async function showEditPermissionGroupModal(player: mc.Player, existingGroup?: string): Promise<void> {
    const config = getRanksConfig();
    const isNew = !isNonEmptyString(existingGroup);
    const currentNodes = existingGroup ? (config.permissionGroups[existingGroup] ?? []) : [];
    const coreGroups = new Set(['default', 'mod', 'admin', 'owner']);
    const canDelete = !isNew && !coreGroups.has(existingGroup);

    const modal = new CustomFormBuilder<{
        groupName: string;
        nodes: string;
        deleteGroup?: boolean;
    }>(isNew ? 'Create Permission Group' : `Edit Group: ${existingGroup}`)
        .textField('groupName', 'Group Name', 'e.g. builder', existingGroup ?? '')
        .textField('nodes', 'Permission Nodes (comma-separated)', 'e.g. **.member, cmd.tp.mod', currentNodes.join(', '));

    if (canDelete) {
        modal.toggle('deleteGroup', '§cDelete this permission group', false);
    }

    modal.submitButton('Save Group');

    const res = await modal.show(player);
    if (!res) {
        await showPermissionGroupsPanel(player);
        return;
    }

    if (canDelete && res.deleteGroup && existingGroup) {
        delete config.permissionGroups[existingGroup];
        saveRanksConfig(config);
        reloadRanks();
        player.sendMessage(`§aDeleted permission group '${existingGroup}'.`);
        await showPermissionGroupsPanel(player);
        return;
    }

    const newName = res.groupName.trim();
    if (!isNonEmptyString(newName)) {
        player.sendMessage('§cGroup name cannot be empty.');
        await showPermissionGroupsPanel(player);
        return;
    }

    const parsedNodes = res.nodes
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    if (!isNew && existingGroup && existingGroup !== newName) {
        delete config.permissionGroups[existingGroup];
    }

    config.permissionGroups[newName] = parsedNodes;
    saveRanksConfig(config);
    reloadRanks();
    player.sendMessage(`§aSaved permission group '${newName}'.`);
    await showPermissionGroupsPanel(player);
}

export async function showGlobalRankDefaultsPanel(player: mc.Player): Promise<void> {
    const ranksConfig = getRanksConfig();
    const mainConfig = getConfig();
    const styleOptions = ['above', 'before', 'after', 'under'];
    const currentStyleIndex = Math.max(0, styleOptions.indexOf(mainConfig.ranks.nameTagStyle));

    const modal = new CustomFormBuilder<{
        nameTagStyle: string;
        defaultRankId: string;
        defaultRanks: string;
        prefixText: string;
        nameColor: string;
        messageColor: string;
    }>('Global Rank & Chat Defaults')
        .dropdown('nameTagStyle', 'Nametag Prefix Position', styleOptions, currentStyleIndex)
        .textField('defaultRankId', 'Default Primary Rank ID', 'member', mainConfig.playerDefaults.rankId)
        .textField('defaultRanks', 'Default Assigned Ranks (comma-separated)', 'member', mainConfig.playerDefaults.ranks.join(', '))
        .textField('prefixText', 'Fallback Chat Prefix', '§8Member', ranksConfig.defaultChatFormatting.prefixText)
        .textField('nameColor', 'Fallback Chat Name Color', '§7', ranksConfig.defaultChatFormatting.nameColor)
        .textField('messageColor', 'Fallback Chat Message Color', '§f', ranksConfig.defaultChatFormatting.messageColor)
        .submitButton('Save Defaults');

    const res = await modal.show(player);
    if (!res) {
        await showRankSystemConfigPanel(player);
        return;
    }

    const defaultRanksList = res.defaultRanks
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    updateMultipleConfig({
        'ranks.nameTagStyle': res.nameTagStyle || 'above',
        'playerDefaults.rankId': res.defaultRankId.trim() || 'member',
        'playerDefaults.ranks': defaultRanksList.length > 0 ? defaultRanksList : ['member']
    });

    ranksConfig.defaultChatFormatting = {
        prefixText: res.prefixText,
        nameColor: res.nameColor || '§7',
        messageColor: res.messageColor || '§f'
    };

    saveRanksConfig(ranksConfig);
    reloadRanks();
    refreshOnlineNameTags();

    player.sendMessage('§aUpdated global rank and chat defaults.');
    await showRankSystemConfigPanel(player);
}

export async function showRankActionPanel(player: mc.Player, rankId: string): Promise<void> {
    const config = getRanksConfig();
    const existingRank = config.rankDefinitions.find((r) => r.id === rankId);
    if (!existingRank) {
        player.sendMessage(`§cError: Rank ${rankId} not found.`);
        return showRankSystemConfigPanel(player);
    }

    const buyMult = existingRank.shopMultiplier?.buy ?? 1;
    const sellMult = existingRank.shopMultiplier?.sell ?? 1;
    const summary = [
        `§7ID: §f${existingRank.id} §8| §7Priority: §f${existingRank.priority}`,
        `§7Nametag: §r${existingRank.nametagPrefix || 'None'} §8| §7Chat Prefix: §r${existingRank.chatFormatting?.prefixText || 'None'}`,
        `§7Name Color: ${existingRank.chatFormatting?.nameColor || '§7'}Sample §8| §7Msg Color: ${existingRank.chatFormatting?.messageColor || '§f'}Sample§r`,
        `§7Shop Multipliers: §aBuy ${buyMult}x §8/ §6Sell ${sellMult}x`,
        `§7Groups: §e${existingRank.groups.join(', ') || 'None'}`
    ].join('\n');

    const form = new ActionFormBuilder().title(`Manage Rank: ${existingRank.name}`).body(summary);

    form.button('Edit Rank', 'textures/ui/color_plus', () => {
        void showRankEditorPanel(player, rankId);
    });

    if (existingRank.locked) {
        form.button('Delete Rank\n§8[Locked]', 'textures/ui/cancel', () => {
            player.sendMessage('§cCannot delete a locked core system rank.');
            void showRankActionPanel(player, rankId);
        });
    } else {
        form.button('§4Delete Rank', 'textures/ui/trash', () => {
            void showRankDeleteConfirmPanel(player, rankId);
        });
    }

    form.addBackButton(async () => {
        await showRankSystemConfigPanel(player);
    });

    await form.show(player);
}

export async function showRankDeleteConfirmPanel(player: mc.Player, rankId: string): Promise<void> {
    const config = getRanksConfig();
    const existingRank = config.rankDefinitions.find((r) => r.id === rankId);
    if (!existingRank) {
        return showRankSystemConfigPanel(player);
    }

    await showConfirmationDialog(player, {
        title: `Delete Rank: ${existingRank.name}`,
        body: `Are you sure you want to delete the rank '${existingRank.name}'?\nThis action cannot be undone.`,
        confirmButtonText: '§4Confirm Delete',
        cancelButtonText: 'Cancel',
        onConfirm: async () => {
            config.rankDefinitions = config.rankDefinitions.filter((r) => r.id !== rankId);
            saveRanksConfig(config);
            reloadRanks();
            refreshOnlineNameTags();
            player.sendMessage(`§aSuccessfully deleted rank '${existingRank.name}'.`);
            await showRankSystemConfigPanel(player);
        },
        onCancel: async () => {
            await showRankActionPanel(player, rankId);
        }
    });
}

export async function showRankEditorPanel(player: mc.Player, rankId?: string, draftRank?: Partial<RankDefinition> & { conditionsRaw?: string; tagCondition?: string }): Promise<void> {
    const config = getRanksConfig();
    const isNew = !isDefined(rankId);
    let rank: RankDefinition;

    if (draftRank) {
        rank = {
            id: draftRank.id || '',
            name: draftRank.name || '',
            priority: draftRank.priority ?? 100,
            conditions: draftRank.conditions || [],
            groups: draftRank.groups || ['default'],
            allow: draftRank.allow || [],
            deny: draftRank.deny || [],
            nametagPrefix: draftRank.nametagPrefix,
            chatFormatting: draftRank.chatFormatting,
            shopMultiplier: draftRank.shopMultiplier
        };
    } else if (isNew) {
        rank = {
            id: '',
            name: '',
            priority: 100,
            conditions: [],
            groups: ['default'],
            allow: [],
            deny: [],
            chatFormatting: {
                prefixText: '',
                nameColor: '§7',
                messageColor: '§f'
            },
            shopMultiplier: {
                buy: 1,
                sell: 1
            }
        };
    } else {
        const existingRank = config.rankDefinitions.find((r) => r.id === rankId);
        if (!existingRank) {
            player.sendMessage(`§cError: Rank ${rankId} not found.`);
            return showRankSystemConfigPanel(player);
        }
        rank = JSON.parse(JSON.stringify(existingRank)) as RankDefinition;
    }

    const existingTagCond = rank.conditions.find((c) => c.type === 'hasTag' && typeof c.value === 'string');
    const otherConditions = rank.conditions.filter((c) => !(c.type === 'hasTag' && c === existingTagCond));
    const initialTagValue = draftRank?.tagCondition ?? (typeof existingTagCond?.value === 'string' ? existingTagCond.value : '');
    const conditionsJson = draftRank?.conditionsRaw ?? JSON.stringify(otherConditions);

    const modal = new CustomFormBuilder<{
        id: string;
        name: string;
        priority: string;
        nametagPrefix: string;
        chatPrefixText: string;
        chatNameColor: string;
        chatMessageColor: string;
        shopBuyMultiplier: string;
        shopSellMultiplier: string;
        groups: string;
        allow: string;
        deny: string;
        tagCondition: string;
        conditions: string;
    }>(isNew ? 'Create New Rank' : `Edit Rank: ${rank.name}`);

    modal.textField('id', 'Rank ID (Unique, alphanumeric)', 'e.g. custom_rank', rank.id);
    modal.textField('name', 'Display Name', 'e.g. Custom Rank', rank.name);
    modal.textField('priority', 'Priority (Lower = Higher Rank)', 'e.g. 50', String(rank.priority));
    modal.textField('nametagPrefix', 'Nametag Prefix', 'e.g. §bVIP', rank.nametagPrefix ?? rank.chatFormatting?.prefixText ?? '');
    modal.textField('chatPrefixText', 'Chat Prefix Text', 'e.g. §bVIP', rank.chatFormatting?.prefixText ?? rank.nametagPrefix ?? '');
    modal.textField('chatNameColor', 'Chat Name Color Code', 'e.g. §b', rank.chatFormatting?.nameColor ?? '§7');
    modal.textField('chatMessageColor', 'Chat Message Color Code', 'e.g. §f', rank.chatFormatting?.messageColor ?? '§f');
    modal.textField('shopBuyMultiplier', 'Shop Buy Multiplier (e.g. 0.8 = 20% off)', '1.0', String(rank.shopMultiplier?.buy ?? 1));
    modal.textField('shopSellMultiplier', 'Shop Sell Multiplier (e.g. 1.2 = 20% bonus)', '1.0', String(rank.shopMultiplier?.sell ?? 1));
    modal.textField('groups', 'Permission Groups (comma-separated)', 'e.g. default,mod', rank.groups.join(', '));
    modal.textField('allow', 'Allowed Permissions (comma-separated)', 'e.g. cmd.kick.mod,ui.panel.mod', rank.allow.join(', '));
    modal.textField('deny', 'Denied Permissions (comma-separated)', 'e.g. cmd.ban.admin', rank.deny.join(', '));
    modal.textField('tagCondition', 'Auto-Assign Vanilla Tag (Optional)', 'e.g. vip (grants rank when player has tag)', initialTagValue);
    modal.textField('conditions', 'Extra Conditions (JSON array)', '[]', conditionsJson);
    modal.submitButton('Save Rank');

    const response = await modal.show(player);
    if (!response) {
        return isNew ? showRankSystemConfigPanel(player) : showRankActionPanel(player, rankId);
    }

    const parsedPriority = Number.parseInt(response.priority, 10);
    const parsedBuy = Number.parseFloat(response.shopBuyMultiplier);
    const parsedSell = Number.parseFloat(response.shopSellMultiplier);
    const safeBuy = Number.isNaN(parsedBuy) || parsedBuy < 0 ? 1 : parsedBuy;
    const safeSell = Number.isNaN(parsedSell) || parsedSell < 0 ? 1 : parsedSell;

    const draftState = {
        id: response.id.trim(),
        name: response.name,
        priority: Number.isNaN(parsedPriority) ? 100 : parsedPriority,
        nametagPrefix: response.nametagPrefix,
        chatFormatting: {
            prefixText: isNonEmptyString(response.chatPrefixText) ? response.chatPrefixText : response.nametagPrefix,
            nameColor: isNonEmptyString(response.chatNameColor) ? response.chatNameColor : '§7',
            messageColor: isNonEmptyString(response.chatMessageColor) ? response.chatMessageColor : '§f'
        },
        shopMultiplier: {
            buy: safeBuy,
            sell: safeSell
        },
        groups: response.groups
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        allow: response.allow
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        deny: response.deny
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        conditions: rank.conditions,
        tagCondition: response.tagCondition.trim(),
        conditionsRaw: response.conditions
    };

    const newId = response.id.trim();
    if (newId === '') {
        player.sendMessage('§cError: Rank ID cannot be empty.');
        return showRankEditorPanel(player, rankId, draftState);
    }

    if (config.rankDefinitions.some((r) => r.id === newId && r.id !== rankId)) {
        player.sendMessage(`§cError: Rank ID '${newId}' already exists.`);
        return showRankEditorPanel(player, rankId, draftState);
    }

    let parsedExtraConditions: RankCondition[] = [];
    const rawCondTrimmed = response.conditions.trim();
    if (rawCondTrimmed.length > 0) {
        try {
            parsedExtraConditions = JSON.parse(rawCondTrimmed) as RankCondition[];
            if (!Array.isArray(parsedExtraConditions)) {
                throw new Error('Must be an array');
            }
        } catch (e: unknown) {
            player.sendMessage(`§cError parsing Extra Conditions JSON: ${e instanceof Error ? e.message : String(e)}`);
            return showRankEditorPanel(player, rankId, draftState);
        }
    }

    const finalConditions: RankCondition[] = [];
    if (isNonEmptyString(draftState.tagCondition)) {
        finalConditions.push({ type: 'hasTag', value: draftState.tagCondition });
    }
    for (const cond of parsedExtraConditions) {
        finalConditions.push(cond);
    }

    rank.id = newId;
    rank.name = draftState.name;
    rank.priority = draftState.priority;
    rank.nametagPrefix = draftState.nametagPrefix;
    rank.chatFormatting = draftState.chatFormatting;
    rank.shopMultiplier = draftState.shopMultiplier;
    rank.groups = draftState.groups;
    rank.allow = draftState.allow;
    rank.deny = draftState.deny;
    rank.conditions = finalConditions;

    if (isNew) {
        config.rankDefinitions.push(rank);
    } else {
        const index = config.rankDefinitions.findIndex((r) => r.id === rankId);
        if (index !== -1) {
            config.rankDefinitions[index] = rank;
        }
    }

    saveRanksConfig(config);
    reloadRanks();
    refreshOnlineNameTags();

    player.sendMessage(`§aSuccessfully saved rank '${rank.name}'.`);
    await showRankSystemConfigPanel(player);
}
