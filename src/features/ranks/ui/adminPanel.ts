import { getConfig, updateMultipleConfig } from '@core/config/configManager.js';
import { getRanksConfig, saveRanksConfig } from '@core/config/configurations.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { canDeleteRankDefinition, canEditRankDefinition, isOwner, isProtectedSystemRank, validatePermissionGroupEdits, validateRankDefinitionEdits } from '@core/permissions/permissionEngine.js';
import { reloadRanks, updatePlayerNameTag } from '@core/permissions/rankManager.js';
import { RankCondition, RankDefinition } from '@features/ranks/config.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';

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
    const sortedRanks = [...config.rankDefinitions].toSorted((a, b) => a.priority - b.priority);
    const viewerIsOwner = isOwner(player);

    const form = new ActionFormBuilder()
        .title('Ranks & Permissions')
        .body(viewerIsOwner ? '§7Role: §4Server Owner §8(Full Rank & Permission Access)' : '§7Role: §cAdmin §8(Can manage ranks below Admin; Owner & Admin are locked)');

    form.button('§2+ Create New Rank', 'textures/ui/color_plus', () => {
        void showRankEditorPanel(player);
    });

    form.button('§6Permission Groups', 'textures/ui/permissions_op_crown', () => {
        void showPermissionGroupsPanel(player);
    });

    form.button('§bGlobal Rank & Chat Defaults', 'textures/ui/icon_setting', () => {
        void showGlobalRankDefaultsPanel(player);
    });

    form.button('§ePermission Nodes Guide', 'textures/ui/icon_sign', () => {
        void showPermissionNodesGuidePanel(player);
    });

    for (const rank of sortedRanks) {
        const editAccess = canEditRankDefinition(player, rank.id);
        const lockBadge = !editAccess.allowed ? ' §8[Owner Only]' : isProtectedSystemRank(rank.id) ? ' §8[Core]' : '';
        const prefixPreview = rank.chatFormatting?.prefixText ?? rank.nametagPrefix ?? rank.name;
        form.button(`§l${prefixPreview}§r${lockBadge}\n§7ID: §f${rank.id} §8| §7Priority: §f${rank.priority}`, 'textures/ui/permissions_member_star', () => {
            void showRankActionPanel(player, rank.id);
        });
    }

    form.addBackButton(async () => {
        const { showConfigCategoryPanel } = await import('@core/ui/panels/configPanel.js');
        await showConfigCategoryPanel(player);
    });

    await form.show(player);
}

export async function showPermissionNodesGuidePanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder()
        .grid(1)
        .title('Permission Nodes & Groups Guide')
        .body(
            [
                '§l§61. Universal Permission Groups (assign in Rank Groups):§r',
                '§e• default§r (or §emember§r) — Standard player commands & UI (/spawn, /home, /tpa, /shop, /ah, /pay, /kit, /team, /friend)',
                '§e• vip§r — Donor & VIP perks (**.vip)',
                '§e• builder§r — Creative/Survival toggle (/gmc, /gms, /gm c|s) & spawn protection bypass',
                '§e• helper§r — Chat & basic moderation (/xkick, /mute, /unmute, /warn, /freeze, /sc, /watch)',
                '§e• mod§r — Full Moderator toolkit (/vanish, /sinv, /invsee, /notify, /xraynotify, Staff Dashboard)',
                '§e• admin§r — Server Administration (/ban, /unban, /rank, /xgamemode, /xtp, /setspawn, /addwarp, /logs) §c[Owner Only]§r',
                '§e• owner§r — Unrestricted Server Owner (*) §4[Owner Only]§r',
                '',
                '§l§b2. Universal Permission Node Formats:§r',
                '§e• Short Command Nodes:§r §fcmd.<command>§7 (e.g. §acmd.kick§7, §acmd.gmc§7, §acmd.invsee§7)',
                '§e• Tiered Command Nodes:§r §fcmd.<command>.<tier>§7 (e.g. §acmd.kick.mod§7, §acmd.gmc.builder§7)',
                '§e• Tier Wildcards:§r §f**.member§7, §f**.builder§7, §f**.helper§7, §f**.mod§7, §f**.admin§7',
                '§e• Command Wildcard:§r §fcmd.*§7 (all commands) or §fcmd.*.mod§7 (all mod commands)',
                '§e• Special Nodes:§r §fbypass.spawnprotection§7, §fui.panel.mod§7, §fgroup.mod§7'
            ].join('\n')
        );

    form.addBackButton(async () => {
        await showRankSystemConfigPanel(player);
    });

    await form.show(player);
}

export async function showPermissionGroupsPanel(player: mc.Player): Promise<void> {
    const config = getRanksConfig();
    const groups = config.permissionGroups;
    const viewerIsOwner = isOwner(player);

    const form = new ActionFormBuilder()
        .title('Permission Groups')
        .body('Manage reusable permission node bundles assigned to ranks:')
        .button('§2+ Create Permission Group', 'textures/ui/color_plus', () => {
            void showEditPermissionGroupModal(player);
        });

    for (const [groupName, nodes] of Object.entries(groups)) {
        const isLockedToOwner = !viewerIsOwner && (groupName === 'owner' || groupName === 'admin');
        const badge = isLockedToOwner ? ' §8[Owner Only]' : '';
        form.button(`§l${groupName}§r${badge}\n§7${nodes.length} node(s): ${nodes.slice(0, 2).join(', ')}`, 'textures/ui/permissions_op_crown', () => {
            if (isLockedToOwner) {
                player.sendMessage(`§cOnly the Server Owner can edit the '${groupName}' permission group.`);
                void showPermissionGroupsPanel(player);
                return;
            }
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
    const coreGroups = new Set(['default', 'vip', 'builder', 'helper', 'mod', 'admin', 'owner']);
    const canDelete = !isNew && !coreGroups.has(existingGroup);

    const modal = new CustomFormBuilder<{
        groupName: string;
        nodes: string;
        deleteGroup?: boolean;
    }>(isNew ? 'Create Permission Group' : `Edit Group: ${existingGroup}`)
        .textField('groupName', 'Group Name', 'e.g. event_host', existingGroup ?? '')
        .textField('nodes', 'Permission Nodes (comma-separated)', 'e.g. **.member, cmd.tp, cmd.gmc', currentNodes.join(', '));

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

    const securityCheck = validatePermissionGroupEdits(player, newName, parsedNodes);
    if (!securityCheck.valid) {
        player.sendMessage(securityCheck.error ?? '§cPermission group validation failed.');
        await showPermissionGroupsPanel(player);
        return;
    }

    if (!isNew && existingGroup && existingGroup !== newName) {
        if (coreGroups.has(existingGroup)) {
            player.sendMessage(`§cCannot rename core permission group '${existingGroup}'.`);
            await showPermissionGroupsPanel(player);
            return;
        }
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

    const defaultRankIdClean = res.defaultRankId.trim() || 'member';
    const defaultRanksList = res.defaultRanks
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    const effectiveDefaultRanks = defaultRanksList.length > 0 ? defaultRanksList : ['member'];

    if (!isOwner(player)) {
        const forbidden = ['owner', 'admin'];
        if (forbidden.includes(defaultRankIdClean.toLowerCase()) || effectiveDefaultRanks.some((r) => forbidden.includes(r.toLowerCase()))) {
            player.sendMessage('§cSecurity Error: Cannot set Owner or Admin as the default rank for new players.');
            await showRankSystemConfigPanel(player);
            return;
        }
    }

    updateMultipleConfig({
        'ranks.nameTagStyle': res.nameTagStyle || 'above',
        'playerDefaults.rankId': defaultRankIdClean,
        'playerDefaults.ranks': effectiveDefaultRanks
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

    const editCheck = canEditRankDefinition(player, rankId);
    const deleteCheck = canDeleteRankDefinition(player, rankId);
    const buyMult = existingRank.shopMultiplier?.buy ?? 1;
    const sellMult = existingRank.shopMultiplier?.sell ?? 1;

    const summary = [
        `§7ID: §f${existingRank.id} §8| §7Priority: §f${existingRank.priority}`,
        `§7Nametag: §r${existingRank.nametagPrefix || 'None'} §8| §7Chat Prefix: §r${existingRank.chatFormatting?.prefixText || 'None'}`,
        `§7Name Color: ${existingRank.chatFormatting?.nameColor || '§7'}Sample §8| §7Msg Color: ${existingRank.chatFormatting?.messageColor || '§f'}Sample§r`,
        `§7Shop Multipliers: §aBuy ${buyMult}x §8/ §6Sell ${sellMult}x`,
        `§7Groups: §e${existingRank.groups.join(', ') || 'None'}`,
        `§7Allow Nodes: §a${existingRank.allow.join(', ') || 'None'}`,
        `§7Deny Nodes: §c${existingRank.deny.join(', ') || 'None'}`
    ].join('\n');

    const form = new ActionFormBuilder().title(`Manage Rank: ${existingRank.name}`).body(summary);

    if (editCheck.allowed) {
        form.button('Edit Rank', 'textures/ui/book_edit_default', () => {
            void showRankEditorPanel(player, rankId);
        });
    } else {
        form.button('Edit Rank\n§8[Owner Only]', 'textures/ui/lock_color', () => {
            player.sendMessage(editCheck.reason ?? '§cOnly the Server Owner can edit this rank.');
            void showRankActionPanel(player, rankId);
        });
    }

    if (deleteCheck.allowed) {
        form.button('§4Delete Rank', 'textures/ui/trash', () => {
            void showRankDeleteConfirmPanel(player, rankId);
        });
    } else {
        form.button('Delete Rank\n§8[Locked]', 'textures/ui/cancel', () => {
            player.sendMessage(deleteCheck.reason ?? '§cCannot delete a locked core system rank.');
            void showRankActionPanel(player, rankId);
        });
    }

    form.addBackButton(async () => {
        await showRankSystemConfigPanel(player);
    });

    await form.show(player);
}

export async function showRankDeleteConfirmPanel(player: mc.Player, rankId: string): Promise<void> {
    const deleteCheck = canDeleteRankDefinition(player, rankId);
    if (!deleteCheck.allowed) {
        player.sendMessage(deleteCheck.reason ?? '§cCannot delete this rank.');
        return showRankActionPanel(player, rankId);
    }

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

    if (!isNew) {
        const editCheck = canEditRankDefinition(player, rankId);
        if (!editCheck.allowed) {
            player.sendMessage(editCheck.reason ?? '§cYou cannot edit this rank.');
            return showRankActionPanel(player, rankId);
        }
    }

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
    const availableGroups = Object.keys(config.permissionGroups).join(', ');

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

    modal.textField('id', 'Rank ID (Unique, lowercase alphanumeric)', 'e.g. architect', rank.id);
    modal.textField('name', 'Display Name', 'e.g. Architect', rank.name);
    modal.textField('priority', 'Priority (Lower = Higher Rank; Owner=0, Admin=10, Mod=30)', 'e.g. 70', String(rank.priority));
    modal.textField('nametagPrefix', 'Nametag Prefix', 'e.g. §3Architect', rank.nametagPrefix ?? rank.chatFormatting?.prefixText ?? '');
    modal.textField('chatPrefixText', 'Chat Prefix Text', 'e.g. §3Architect', rank.chatFormatting?.prefixText ?? rank.nametagPrefix ?? '');
    modal.textField('chatNameColor', 'Chat Name Color Code', 'e.g. §3', rank.chatFormatting?.nameColor ?? '§7');
    modal.textField('chatMessageColor', 'Chat Message Color Code', 'e.g. §f', rank.chatFormatting?.messageColor ?? '§f');
    modal.textField('shopBuyMultiplier', 'Shop Buy Multiplier (e.g. 0.8 = 20% off)', '1.0', String(rank.shopMultiplier?.buy ?? 1));
    modal.textField('shopSellMultiplier', 'Shop Sell Multiplier (e.g. 1.2 = 20% bonus)', '1.0', String(rank.shopMultiplier?.sell ?? 1));
    modal.textField('groups', `Permission Groups (Available: ${availableGroups})`, 'e.g. default, builder', rank.groups.join(', '));
    modal.textField('allow', 'Allowed Permissions (e.g. cmd.gmc, cmd.kick, bypass.spawnprotection)', 'e.g. cmd.gmc, cmd.gms', rank.allow.join(', '));
    modal.textField('deny', 'Denied Permissions (comma-separated)', 'e.g. cmd.rtp', rank.deny.join(', '));
    modal.textField('tagCondition', 'Auto-Assign Vanilla Tag (Optional)', 'e.g. architect', initialTagValue);
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
        id: response.id.trim().toLowerCase(),
        name: response.name.trim() || response.id.trim(),
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

    const newId = draftState.id;
    if (newId === '') {
        player.sendMessage('§cError: Rank ID cannot be empty.');
        return showRankEditorPanel(player, rankId, draftState);
    }

    if (!isNew && rankId && isProtectedSystemRank(rankId) && newId !== rankId) {
        player.sendMessage(`§cError: Cannot change the ID of core system rank '${rankId}'.`);
        draftState.id = rankId;
        return showRankEditorPanel(player, rankId, draftState);
    }

    if (config.rankDefinitions.some((r) => r.id === newId && r.id !== rankId)) {
        player.sendMessage(`§cError: Rank ID '${newId}' already exists.`);
        return showRankEditorPanel(player, rankId, draftState);
    }

    const securityValidation = validateRankDefinitionEdits(
        player,
        {
            id: newId,
            priority: draftState.priority,
            groups: draftState.groups,
            allow: draftState.allow,
            deny: draftState.deny
        },
        rankId
    );

    if (!securityValidation.valid) {
        player.sendMessage(securityValidation.error ?? '§cSecurity validation failed.');
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
    rank.priority = rankId === 'owner' ? 0 : draftState.priority;
    rank.nametagPrefix = draftState.nametagPrefix;
    rank.chatFormatting = draftState.chatFormatting;
    rank.shopMultiplier = draftState.shopMultiplier;
    rank.groups = rankId === 'owner' ? ['default', 'vip', 'builder', 'helper', 'mod', 'admin', 'owner'] : draftState.groups;
    rank.allow = rankId === 'owner' ? ['*'] : draftState.allow;
    rank.deny = rankId === 'owner' ? [] : draftState.deny;
    rank.conditions = rankId === 'owner' ? [{ type: 'hasTag', value: 'owner' }] : finalConditions;

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
