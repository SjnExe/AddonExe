import { getRanksConfig, saveRanksConfig } from '@core/configurations.js';
import { reloadRanks } from '@core/rankManager.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';
import { RankCondition, RankDefinition } from '../ranksConfig.js';
import { isDefined } from '@lib/guards.js';

export async function showRankSystemConfigPanel(player: mc.Player): Promise<void> {
    const config = getRanksConfig();
    const ranks = config.rankDefinitions;

    const form = new ActionFormBuilder().title('Ranks System Configuration');

    form.button('§2Create New Rank', 'textures/ui/color_plus', () => {
        void showRankEditorPanel(player);
    });

    for (const rank of ranks) {
        form.button(`§l${rank.name}§r\nID: ${rank.id}`, 'textures/ui/permissions_member_star', () => {
            void showRankActionPanel(player, rank.id);
        });
    }

    form.addBackButton(async () => {
        const { showConfigCategoryPanel } = await import('@core/ui/panels/configPanel.js');
        await showConfigCategoryPanel(player);
    });

    await form.show(player);
}

export async function showRankActionPanel(player: mc.Player, rankId: string): Promise<void> {
    const config = getRanksConfig();
    const existingRank = config.rankDefinitions.find((r) => r.id === rankId);
    if (!existingRank) {
        player.sendMessage(`§cError: Rank ${rankId} not found.`);
        return showRankSystemConfigPanel(player);
    }

    const form = new ActionFormBuilder().title(`Manage Rank: ${existingRank.name}`);

    form.button('Edit Rank', 'textures/ui/color_plus', () => {
        void showRankEditorPanel(player, rankId);
    });

    if (existingRank.locked) {
        form.button('Delete Rank\n§8[Locked]', 'textures/ui/cancel', () => {
            player.sendMessage(`§cCannot delete a locked core system rank.`);
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
    if (!existingRank) return showRankSystemConfigPanel(player);

    const form = new ActionFormBuilder().title(`Delete Rank: ${existingRank.name}`);
    form.body(`Are you sure you want to delete the rank '${existingRank.name}'?\nThis action cannot be undone.`);

    form.button('§4Confirm Delete', 'textures/ui/realms_red_x', () => {
        config.rankDefinitions = config.rankDefinitions.filter((r) => r.id !== rankId);
        saveRanksConfig(config);
        reloadRanks();
        player.sendMessage(`§aSuccessfully deleted rank '${existingRank.name}'.`);
        void showRankSystemConfigPanel(player);
    });

    form.button('Cancel', 'textures/ui/cancel', () => {
        void showRankActionPanel(player, rankId);
    });

    await form.show(player);
}

export async function showRankEditorPanel(player: mc.Player, rankId?: string, draftRank?: Partial<RankDefinition> & { conditionsRaw?: string }): Promise<void> {
    const config = getRanksConfig();
    const isNew = !isDefined(rankId);
    let rank: RankDefinition;

    if (draftRank) {
        rank = {
            id: draftRank.id || '',
            name: draftRank.name || '',
            priority: draftRank.priority ?? 100,
            permissionLevel: draftRank.permissionLevel ?? 10,
            conditions: draftRank.conditions || [],
            groups: draftRank.groups || ['default'],
            allow: draftRank.allow || [],
            deny: draftRank.deny || [],
            nametagPrefix: draftRank.nametagPrefix
        };
    } else if (isNew) {
        rank = {
            id: '',
            name: '',
            priority: 100,
            permissionLevel: 10,
            conditions: [],
            groups: ['default'],
            allow: [],
            deny: []
        };
    } else {
        const existingRank = config.rankDefinitions.find((r) => r.id === rankId);
        if (!existingRank) {
            player.sendMessage(`§cError: Rank ${rankId} not found.`);
            return showRankSystemConfigPanel(player);
        }
        // Deep clone to avoid direct mutation before save
        rank = JSON.parse(JSON.stringify(existingRank)) as RankDefinition;
    }

    const modal = new ModalFormBuilder<{
        id: string;
        name: string;
        priority: string;
        permissionLevel: string;
        nametagPrefix: string;
        groups: string;
        allow: string;
        deny: string;
        conditions: string;
    }>().title(isNew ? 'Create New Rank' : `Edit Rank: ${rank.name}`);

    modal.textField('id', 'Rank ID (Unique, alphanumeric)', 'e.g. custom_rank', rank.id);
    modal.textField('name', 'Display Name', 'e.g. Custom Rank', rank.name);
    modal.textField('priority', 'Priority (Lower = Higher Rank)', 'e.g. 50', String(rank.priority));
    modal.textField('permissionLevel', 'Permission Level (0-1000)', 'e.g. 10', String(rank.permissionLevel));
    modal.textField('nametagPrefix', 'Nametag Prefix', 'e.g. §bPrefix', rank.nametagPrefix || '');

    modal.textField('groups', 'Groups (comma separated)', 'e.g. default,mod', rank.groups.join(','));
    modal.textField('allow', 'Allowed Permissions (comma separated)', 'e.g. cmd.fly,ui.panel.mod', rank.allow.join(','));
    modal.textField('deny', 'Denied Permissions (comma separated)', 'e.g. cmd.ban', rank.deny.join(','));

    const conditionsJson = draftRank?.conditionsRaw ?? JSON.stringify(rank.conditions, null, 2);
    modal.textField('conditions', 'Conditions (JSON array)', '[]', conditionsJson);

    const response = await modal.show(player);
    if (!response) {
        return isNew ? showRankSystemConfigPanel(player) : showRankActionPanel(player, rankId);
    }

    const parsedPriority = Number.parseInt(response.priority, 10);
    const parsedPermissionLevel = Number.parseInt(response.permissionLevel, 10);

    const draftState = {
        id: response.id.trim(),
        name: response.name,
        priority: Number.isNaN(parsedPriority) ? 100 : parsedPriority,
        permissionLevel: Number.isNaN(parsedPermissionLevel) ? 10 : parsedPermissionLevel,
        nametagPrefix: response.nametagPrefix,
        groups: response.groups.split(',').map(s => s.trim()).filter(s => s.length > 0),
        allow: response.allow.split(',').map(s => s.trim()).filter(s => s.length > 0),
        deny: response.deny.split(',').map(s => s.trim()).filter(s => s.length > 0),
        conditions: rank.conditions,
        conditionsRaw: response.conditions
    };

    // Validation
    const newId = response.id.trim();
    if (newId === '') {
        player.sendMessage('§cError: Rank ID cannot be empty.');
        return showRankEditorPanel(player, rankId, draftState);
    }

    if (config.rankDefinitions.some((r) => r.id === newId && r.id !== rankId)) {
        player.sendMessage(`§cError: Rank ID '${newId}' already exists.`);
        return showRankEditorPanel(player, rankId, draftState);
    }

    let parsedConditions: RankCondition[];
    try {
        parsedConditions = JSON.parse(response.conditions) as RankCondition[];
        if (!Array.isArray(parsedConditions)) throw new Error('Must be an array');
    } catch (e: unknown) {
        player.sendMessage(`§cError parsing Conditions JSON: ${e instanceof Error ? e.message : String(e)}`);
        return showRankEditorPanel(player, rankId, draftState);
    }

    rank.id = newId;
    rank.name = draftState.name;
    rank.priority = draftState.priority;
    rank.permissionLevel = draftState.permissionLevel;
    rank.nametagPrefix = draftState.nametagPrefix;
    rank.groups = draftState.groups;
    rank.allow = draftState.allow;
    rank.deny = draftState.deny;
    rank.conditions = parsedConditions;

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

    player.sendMessage(`§aSuccessfully saved rank '${rank.name}'.`);
    await showRankSystemConfigPanel(player);
}
