import * as mc from '@minecraft/server';
import { ModalFormData, ActionFormData, ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { config as defaultConfig } from '../../config.default.js';
import { restartAnnouncer } from '../../modules/commands/announcement.js';
import { initializeSpawnProtection } from '../../modules/detections/spawnProtection.js';
import * as bountyManager from '../bountyManager.js';
import { getConfig, updateMultipleConfig, resetConfigSection } from '../configManager.js';
import {
    getKitsConfig,
    saveKitsConfig,
    getShopConfig,
    getEconomyConfig,
    saveEconomyConfig,
    getXrayConfig,
    saveXrayConfig,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    RanksConfig
} from '../configurations.js';
import { economyConfig as defaultEconomyConfig } from '../economyConfig.default.js';
import { floatingTextManager } from '../floatingTextManager.js';
import * as helpfulLinksManager from '../helpfulLinksManager.js';
import { items as allItems } from '../itemsConfig.default.js';
import { createKit, deleteKit, getAllKits, updateKitSettings, renameKit } from '../kitAdminManager.js';
import { addItemToKit, updateItemInKit } from '../kitItemsManager.js';
import { errorLog } from '../logger.js';
import { setValueByPath } from '../objectUtils.js';
import { getPlayer, loadPlayerData, setLockState, getAllPlayerNameIdMap, PlayerData } from '../playerDataManager.js';
import * as rankDb from '../rankDb.js';
import * as rankManager from '../rankManager.js';
import { RankDefinition } from '../ranksConfig.default.js';
import * as reportManager from '../reportManager.js';
import * as rulesManager from '../rulesManager.js';
import * as shopAdminManager from '../shopAdminManager.js';
import * as shopManager from '../shopManager.js';
import { spawnConfig as defaultSpawnConfig } from '../spawnConfig.default.js';
import { showPanel } from '../uiManager.js';
import * as utils from '../utils.js';
import { xrayConfig as defaultXrayConfig } from '../xrayConfig.default.js';

import { uiActionFunctions } from './actionRegistry.js';
import { showConfirmationDialog } from './components.js';
import { getVisiblePlayerActionItems, getMenuItems } from './panelBuilder.js';
import { panelDefinitions, configPanelSchema, ConfigSetting, UIContext } from './panelRegistry.js';
import { getVisibleConfigSystems, itemsPerPage, configHandlers, getPaginatedItems } from './uiUtils.js';

const allDefaultConfigs: Record<string, object> = {
    main: defaultConfig,
    spawn: defaultSpawnConfig,
    economy: defaultEconomyConfig,
    xray: defaultXrayConfig
};

export async function handleFormResponse(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const { selection, canceled, formValues } = response;
    const pData = getPlayer(player.id);
    if (!pData) {
        return;
    }

    if (panelId === 'floatingTextListPanel') {
        if (selection === 0) {
            // Back
            return showPanel(player, 'mainPanel', context);
        }
        if (selection === 1) {
            // Create New
            return showPanel(player, 'floatingTextCreatePanel', context);
        }
        const texts = floatingTextManager.getAllTexts();
        const selectedText = texts[selection - 2];
        if (selectedText) {
            return showPanel(player, 'floatingTextActionPanel', { ...context, id: selectedText.id });
        }
        return;
    }

    if (panelId === 'floatingTextActionPanel') {
        const { id } = context;
        try {
            switch (selection) {
                case 0: // Edit
                    return showPanel(player, 'floatingTextEditPanel', context);
                case 1: // Respawn
                    await floatingTextManager.respawnText(id);
                    player.sendMessage(`§aRespawned floating text: ${id}`);
                    break;
                case 2: // Despawn
                    await floatingTextManager.despawnText(id);
                    player.sendMessage(`§aDespawned floating text: ${id}`);
                    break;
                case 3: // Delete
                    await floatingTextManager.deleteText(player, id);
                    break; // The deleteText function sends its own success message.
                case 4: // Back
                    break;
            }
        } catch (error) {
            errorLog(`[UIManager] Error in floatingTextActionPanel for ID '${id}':`, error);
            player.sendMessage('§cAn error occurred. Please check the logs.');
        }
        // Always refresh the list panel, even on error or 'Back'
        return showPanel(player, 'floatingTextListPanel', context);
    }

    if (panelId === 'teamMainPanel') {
        const { getTeamByPlayer } = await import('../teamManager.js');

        const team = getTeamByPlayer(player.id);

        if (selection === 0) {
            return showPanel(player, 'mainPanel', context);
        }

        if (team) {
            const isOwner = team.ownerId === player.id;

            const isAdmin = team.admins.includes(player.id);
            const isOwnerOrAdmin = isOwner || isAdmin;

            // Members button is index 1 (after back)
            // Manage Team is next if owner/admin
            // Settings is next
            // Leave is next

            let btnIndex = 1;

            if (selection === btnIndex) {
                // Members
                return showPanel(player, 'teamMembersPanel', context);
            }
            btnIndex++;

            if (isOwnerOrAdmin) {
                if (selection === btnIndex) {
                    // Manage
                    return showPanel(player, 'teamManagePanel', context);
                }
                btnIndex++;
            }

            if (selection === btnIndex) {
                // Settings
                return showPanel(player, 'teamSettingsPanel', context);
            }
            btnIndex++;

            if (selection === btnIndex) {
                // Leave
                if (isOwner) {
                    player.sendMessage(
                        '§cOwners cannot leave their team. You must transfer ownership or delete the team.'
                    );
                } else {
                    showConfirmationDialog(player, {
                        title: 'Leave Team',
                        body: 'Are you sure you want to leave the team?',
                        confirmButtonText: '§cYes, Leave',
                        cancelButtonText: 'No',
                        onConfirm: async () => {
                            const { kickMember } = await import('../teamManager.js');
                            // Kick self
                            kickMember(team.id, player.id);
                            player.sendMessage('§aYou have left the team.');
                            showPanel(player, 'teamMainPanel', context);
                        },
                        onCancel: () => showPanel(player, 'teamMainPanel', context)
                    });
                }
                return;
            }
        } else {
            // No Team
            if (selection === 1) {
                // Create
                return showPanel(player, 'teamCreatePanel', context);
            }
            if (selection === 2) {
                // Join
                return showPanel(player, 'teamJoinPanel', context);
            }
        }
        return;
    }

    if (panelId === 'teamCreatePanel') {
        if (canceled) {
            return showPanel(player, 'teamMainPanel', context);
        }
        const [name] = (response as ModalFormResponse).formValues as string[];
        if (!name) {
            player.sendMessage('§cTeam name is required.');
            return showPanel(player, panelId, context);
        }

        const { createTeam } = await import('../teamManager.js');
        const result = createTeam(player, name);
        player.sendMessage(result.message || '§cUnknown error.');
        return showPanel(player, 'teamMainPanel', context);
    }

    if (panelId === 'teamJoinPanel') {
        if (selection === 0) {
            return showPanel(player, 'teamMainPanel', context);
        }
        if (selection === 1) {
            return showPanel(player, 'teamInvitesPanel', context);
        }
        if (selection === 2) {
            return showPanel(player, 'teamSearchPanel', context);
        }
        if (selection === 3) {
            return showPanel(player, 'teamBrowserPanel', context);
        }
        return;
    }

    if (panelId === 'teamSearchPanel') {
        if (canceled) {
            return showPanel(player, 'teamJoinPanel', context);
        }
        const [idStr] = (response as ModalFormResponse).formValues as string[];
        const teamId = parseInt(idStr);
        if (isNaN(teamId)) {
            player.sendMessage('§cInvalid Team ID.');
            return showPanel(player, panelId, context);
        }

        // Confirm Application
        const { getTeam, applyToTeam } = await import('../teamManager.js');
        const team = getTeam(teamId);
        if (!team) {
            player.sendMessage('§cTeam not found.');
            return showPanel(player, panelId, context);
        }

        showConfirmationDialog(player, {
            title: `Apply to ${team.name}?`,
            body: `Do you want to send a join request to ${team.name}?`,
            confirmButtonText: '§aApply',
            cancelButtonText: 'Cancel',
            onConfirm: () => {
                const result = applyToTeam(player, teamId);
                player.sendMessage(result.message || '§cUnknown error.');
                showPanel(player, 'teamJoinPanel', context);
            },
            onCancel: () => showPanel(player, 'teamJoinPanel', context)
        });
        return;
    }

    if (panelId === 'teamInvitesPanel') {
        const pData = getPlayer(player.id) as PlayerData;
        const invites = pData.pendingInvites || [];

        if (selection === 0) {
            return showPanel(player, 'teamJoinPanel', context);
        } // Back

        if (invites.length === 0) {
            return;
        } // Body text only

        const denyAllIndex = invites.length + 1;

        if (selection === denyAllIndex) {
            const { updatePlayerData } = await import('../playerDataManager.js');
            updatePlayerData(player.id, (d: PlayerData) => (d.pendingInvites = []));
            player.sendMessage('§aCleared all pending invites.');
            return showPanel(player, panelId, context);
        }

        const inviteIndex = selection - 1;
        if (inviteIndex >= 0 && inviteIndex < invites.length) {
            const invite = invites[inviteIndex];
            // Options: Accept, Deny
            const { acceptInvite, denyInvite } = await import('../teamManager.js');

            const form = new ActionFormData()
                .title(`Invite: ${invite.teamName}`)
                .button('§aAccept Invite', 'textures/ui/check')
                .button('§cDeny Invite', 'textures/ui/cancel');

            const res = await utils.uiWait(player, form);
            if (!res.canceled) {
                if (res.selection === 0) {
                    // Accept
                    const result = acceptInvite(player, invite.teamId);
                    player.sendMessage(result.message || '§cUnknown error.');
                    if (result.success) {
                        return showPanel(player, 'teamMainPanel', context);
                    }
                } else {
                    // Deny
                    const result = denyInvite(player.id, invite.teamId);
                    player.sendMessage(result.message || '§cUnknown error.');
                }
            }
            return showPanel(player, panelId, context);
        }
        return;
    }

    if (panelId === 'teamBrowserPanel') {
        const { getAllTeams } = await import('../teamManager.js');
        const page = context.page || 1;
        const teams = getAllTeams().sort((a, b) => b.members.length - a.members.length);
        const paginatedTeams = getPaginatedItems(teams, page);

        if (selection === 0) {
            return showPanel(player, 'teamJoinPanel', context);
        }

        const selectionIndex = selection - 1;

        if (selectionIndex < paginatedTeams.length) {
            // Apply to selected team
            const team = paginatedTeams[selectionIndex];
            const { applyToTeam } = await import('../teamManager.js');

            showConfirmationDialog(player, {
                title: `Apply to ${team.name}?`,
                body: `Do you want to send a join request to ${team.name}?`,
                confirmButtonText: '§aApply',
                cancelButtonText: 'Cancel',
                onConfirm: () => {
                    const result = applyToTeam(player, team.id);
                    player.sendMessage(result.message || '§cUnknown error.');
                    showPanel(player, panelId, context);
                },
                onCancel: () => showPanel(player, panelId, context)
            });
            return;
        }

        // Pagination logic
        let buttonIndex = selectionIndex - paginatedTeams.length;
        const totalPages = Math.ceil(teams.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        if (hasPrev && buttonIndex === 0) {
            return showPanel(player, panelId, { ...context, page: page - 1 });
        }
        if (hasPrev) {
            buttonIndex--;
        }
        if (hasNext && buttonIndex === 0) {
            return showPanel(player, panelId, { ...context, page: page + 1 });
        }

        return;
    }

    if (panelId === 'teamManagePanel') {
        const { getTeamByPlayer, deleteTeam } = await import('../teamManager.js');
        const team = getTeamByPlayer(player.id);
        if (!team) {
            return;
        }

        if (selection === 0) {
            return showPanel(player, 'teamMainPanel', context);
        }

        if (selection === 1) {
            // Invite Player
            return showPanel(player, 'playerListPanel', { ...context, fromPanel: 'teamManagePanel' });
        }

        if (selection === 2) {
            return showPanel(player, 'teamRequestsPanel', context);
        }

        if (selection === 3) {
            // Manage Members
            return showPanel(player, 'teamMembersPanel', { ...context, mode: 'manage' });
        }

        if (selection === 4) {
            // Team Home
            return showPanel(player, 'teamHomePanel', context);
        }

        if (selection === 5) {
            // Delete Team (Owner Only)
            showConfirmationDialog(player, {
                title: 'Delete Team?',
                body: '§cWARNING: This will disband the team and cannot be undone.',
                confirmButtonText: '§cDELETE',
                cancelButtonText: 'Cancel',
                onConfirm: () => {
                    deleteTeam(team.id);
                    player.sendMessage('§aTeam deleted.');
                    showPanel(player, 'mainPanel', {});
                },
                onCancel: () => showPanel(player, panelId, context)
            });
            return;
        }
        return;
    }

    if (panelId === 'teamHomePanel') {
        if (selection === 0) {
            return showPanel(player, 'teamManagePanel', context);
        }

        const { getTeamByPlayer, setTeamHome, deleteTeamHome } = await import('../teamManager.js');
        const team = getTeamByPlayer(player.id);
        if (!team) {
            return;
        }

        const isOwner = team.ownerId === player.id;

        const isAdmin = team.admins.includes(player.id);
        const canManage = isOwner || isAdmin;

        let btnIndex = 1;

        if (team.home) {
            if (selection === btnIndex) {
                // Teleport
                const { x, y, z, dimensionId } = team.home;
                const targetDimension = dimensionId
                    ? (await import('@minecraft/server')).world.getDimension(dimensionId)
                    : player.dimension;
                if (targetDimension) {
                    player.teleport({ x, y, z }, { dimension: targetDimension });
                    player.sendMessage('§aTeleported to team home.');
                } else {
                    player.sendMessage('§cInvalid dimension for team home.');
                }
                return;
            }
            btnIndex++;
        }

        if (canManage) {
            if (selection === btnIndex) {
                // Update Location
                setTeamHome(team.id, player.location, player.dimension.id);
                player.sendMessage('§aTeam home updated to your current location.');
                return showPanel(player, panelId, context);
            }
            btnIndex++;

            if (team.home) {
                if (selection === btnIndex) {
                    // Delete Home
                    deleteTeamHome(team.id);
                    player.sendMessage('§aTeam home deleted.');
                    return showPanel(player, panelId, context);
                }
            }
        }
        return;
    }

    if (panelId === 'teamRequestsPanel') {
        const { getTeamByPlayer, acceptApplication, denyApplication } = await import('../teamManager.js');
        const team = getTeamByPlayer(player.id);
        if (!team) {
            return;
        }

        if (selection === 0) {
            return showPanel(player, 'teamManagePanel', context);
        }

        const appIndex = selection - 1;
        if (appIndex >= 0 && appIndex < team.applications.length) {
            const app = team.applications[appIndex];

            const form = new ActionFormData()
                .title(`App: ${app.playerName}`)
                .button('§aAccept', 'textures/ui/check')
                .button('§cDeny', 'textures/ui/cancel');

            const res = await utils.uiWait(player, form);
            if (!res.canceled) {
                if (res.selection === 0) {
                    // Accept
                    const result = acceptApplication(team.id, app.playerId);
                    player.sendMessage(result.message || '§cUnknown error.');
                } else {
                    // Deny
                    const result = denyApplication(team.id, app.playerId);
                    player.sendMessage(result.message || '§cUnknown error.');
                }
            }
            return showPanel(player, panelId, context);
        }
        return;
    }

    if (panelId === 'teamSettingsPanel') {
        if (canceled) {
            return showPanel(player, 'teamMainPanel', context);
        }

        const { getTeamByPlayer, setTeamOpenStatus } = await import('../teamManager.js');
        const { updatePlayerData } = await import('../playerDataManager.js');

        const team = getTeamByPlayer(player.id);
        if (!team) {
            return showPanel(player, 'teamMainPanel', context);
        }

        const isOwner = team.ownerId === player.id;

        const isAdmin = team.admins.includes(player.id);
        const canManage = isOwner || isAdmin;

        const autoTp = (response as ModalFormResponse).formValues[0];

        updatePlayerData(player.id, (d: PlayerData) => {
            if (!d.teamSettings) {
                d.teamSettings = { autoTpAccept: false };
            }
            d.teamSettings.autoTpAccept = autoTp as boolean;
        });

        if (canManage && formValues.length > 1) {
            const allowRequests = formValues[1];
            setTeamOpenStatus(team.id, allowRequests as boolean);
        }

        player.sendMessage('§aSettings updated.');
        return showPanel(player, 'teamMainPanel', context);
    }

    if (panelId === 'teamMembersPanel') {
        if (selection === 0) {
            return showPanel(player, 'teamMainPanel', context);
        }

        const { getTeamByPlayer, kickMember, promoteMember, demoteMember, transferOwnership } = await import(
            '../teamManager.js'
        );
        const team = getTeamByPlayer(player.id);
        if (!team) {
            return;
        }

        const memberIndex = selection - 1;
        if (memberIndex >= 0 && memberIndex < team.members.length) {
            const memberId = team.members[memberIndex];

            // Self-interaction check?
            if (memberId === player.id) {
                return showPanel(player, panelId, context);
            }

            const isOwner = team.ownerId === player.id;

            const isAdmin = team.admins.includes(player.id);

            // If viewing, maybe show profile? For now, if managing mode or high rank, show actions.
            if (isOwner || isAdmin) {
                const targetIsOwner = team.ownerId === memberId;

                const targetIsAdmin = team.admins.includes(memberId);

                // Access control
                if (isAdmin && (targetIsOwner || targetIsAdmin)) {
                    player.sendMessage('§cYou cannot modify this member.');
                    return showPanel(player, panelId, context);
                }

                const form = new ActionFormData().title('Manage Member');
                form.button('Kick Member', 'textures/ui/cancel');
                if (isOwner) {
                    if (targetIsAdmin) {
                        form.button('Demote to Member', 'textures/ui/arrow_down');
                    } else {
                        form.button('Promote to Admin', 'textures/ui/arrow_up');
                    }

                    form.button('Transfer Ownership', 'textures/ui/op');
                }

                const res = await utils.uiWait(player, form);
                if (res.canceled) {
                    return showPanel(player, panelId, context);
                }

                if (res.selection === 0) {
                    // Kick
                    const result = kickMember(team.id, memberId);
                    player.sendMessage(result.message || '§cUnknown error.');
                } else if (res.selection === 1) {
                    // Promote/Demote
                    if (isOwner) {
                        if (targetIsAdmin) {
                            const result = demoteMember(team.id, memberId);
                            player.sendMessage(result.message || '§cUnknown error.');
                        } else {
                            const result = promoteMember(team.id, memberId);
                            player.sendMessage(result.message || '§cUnknown error.');
                        }
                    }
                } else if (res.selection === 2) {
                    // Transfer
                    showConfirmationDialog(player, {
                        title: 'Transfer Ownership?',
                        body: 'You will become a regular member.',
                        confirmButtonText: '§cConfirm',
                        cancelButtonText: 'Cancel',
                        onConfirm: () => {
                            const result = transferOwnership(team.id, memberId);
                            player.sendMessage(result.message || '§cUnknown error.');
                            showPanel(player, panelId, context);
                        },
                        onCancel: () => showPanel(player, panelId, context)
                    });
                    return;
                }
                return showPanel(player, panelId, context);
            }
        }
        return;
    }

    if (panelId === 'xrayOresPanel') {
        if (selection === 0) {
            // Back
            return showPanel(player, 'config_xray', context);
        }
        if (selection === 1) {
            // Add New Ore
            return showPanel(player, 'addXrayOrePanel', context);
        }
        const xrayConfig = getXrayConfig();
        // Use 'monitoredOreTypes' if 'monitoredOres' is not present (based on xrayConfig.ts structure)
        // Assuming structure is array for dynamic list in panel, but config is object.
        // The original JS code referenced monitoredOres array which implies a mismatch or transformation.
        // We will access it safely.
        const ores = xrayConfig.monitoredOres || [];
        const selectedOreIndex = selection - 2;
        if (selectedOreIndex >= 0 && selectedOreIndex < ores.length) {
            return showPanel(player, 'editXrayOrePanel', { ...context, oreIndex: selectedOreIndex });
        }
        return;
    }

    if (panelId === 'addXrayOrePanel') {
        if (canceled) {
            return showPanel(player, 'xrayOresPanel', context);
        }
        const [blockId, dimensionId, minYStr, maxYStr, oreName] = (response as ModalFormResponse).formValues as string[];
        const minY = parseInt(minYStr, 10);
        const maxY = parseInt(maxYStr, 10);
        if (blockId && dimensionId && !isNaN(minY) && !isNaN(maxY) && oreName) {
            const xrayConfig = getXrayConfig();
            if (!xrayConfig.monitoredOres) {
                xrayConfig.monitoredOres = [];
            }
            xrayConfig.monitoredOres.push({ blockId, dimensionId, minY, maxY, oreName });
            saveXrayConfig(xrayConfig);
            player.sendMessage('§2Successfully added new monitored ore.');
        } else {
            player.sendMessage('§cInvalid data. Please check all fields.');
        }
        return showPanel(player, 'xrayOresPanel', context);
    }

    if (panelId === 'editXrayOrePanel') {
        if (canceled) {
            return showPanel(player, 'xrayOresPanel', context);
        }
        const { oreIndex } = context;
        const [blockId, dimensionId, minYStr, maxYStr, oreName] = (response as ModalFormResponse).formValues as string[];
        const minY = parseInt(minYStr, 10);
        const maxY = parseInt(maxYStr, 10);
        if (blockId && dimensionId && !isNaN(minY) && !isNaN(maxY) && oreName) {
            const xrayConfig = getXrayConfig();
            if (xrayConfig.monitoredOres && xrayConfig.monitoredOres[oreIndex]) {
                xrayConfig.monitoredOres[oreIndex] = { blockId, dimensionId, minY, maxY, oreName };
                saveXrayConfig(xrayConfig);
                player.sendMessage('§2Successfully updated monitored ore.');
            }
        } else {
            player.sendMessage('§cInvalid data. Please check all fields.');
        }
        return showPanel(player, 'xrayOresPanel', context);
    }

    if (panelId === 'floatingTextEditPanel') {
        if (canceled) {
            return showPanel(player, 'floatingTextActionPanel', context);
        }
        const { id } = context;
        const [textContent, x, y, z, dimensionIndex, useExpiration, expirationMinutes] = (
            response as ModalFormResponse
        ).formValues as [
            string,
            string,
            string,
            string,
            number,
            boolean,
            string
        ];

        const dimensionIds = ['minecraft:overworld', 'minecraft:nether', 'minecraft:the_end'];
        const selectedDimension = dimensionIds[dimensionIndex] ?? 'minecraft:overworld';

        const updatedConfig = {
            text: textContent,
            location: { x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) },
            dimension: selectedDimension,
            expiresAt:
                useExpiration && Number(expirationMinutes) > 0 ? Date.now() + Number(expirationMinutes) * 60000 : null
        };
        floatingTextManager.updateText(id, updatedConfig);
        player.sendMessage(`§aSuccessfully updated floating text: ${id}`);
        return showPanel(player, 'floatingTextActionPanel', context);
    }

    if (panelId === 'floatingTextCreatePanel') {
        if (canceled) {
            return showPanel(player, 'floatingTextListPanel', context);
        }
        const [id, text] = (response as ModalFormResponse).formValues as string[];
        if (!id) {
            player.sendMessage('§cID cannot be empty.');
            return showPanel(player, 'floatingTextCreatePanel', context);
        }
        if (id.includes(' ')) {
            player.sendMessage('§cID cannot contain spaces. Please use a single word.');
            return showPanel(player, 'floatingTextCreatePanel', context);
        }
        if (floatingTextManager.createText(player, id, text)) {
            // Success message is sent by createText
        }
        return showPanel(player, 'floatingTextListPanel', context);
    }

    if (panelId === 'rulesManagementPanel') {
        const page = context.page || 1;
        const rules = rulesManager.getRules();

        // Back button
        if (selection === 0) {
            return showPanel(player, 'mainPanel', context);
        }
        // "Add Rule" button
        if (selection === 1) {
            return showPanel(player, 'addRulePanel', context);
        }

        const paginatedRules = getPaginatedItems(rules, page);
        const selectionIndex = selection - 2;

        // Handle rule selection
        if (selectionIndex < paginatedRules.length) {
            const ruleIndex = (page - 1) * itemsPerPage + selectionIndex;
            return showPanel(player, 'ruleActionPanel', { ...context, ruleIndex });
        }

        // Handle pagination
        let buttonIndex = selectionIndex - paginatedRules.length;
        const totalPages = Math.ceil(rules.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        if (rules.length > itemsPerPage) {
            if (hasPrev && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            if (hasPrev) {
                buttonIndex--;
            }

            if (hasNext && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
            if (hasNext) {
                buttonIndex--;
            }
        }
        return;
    }

    if (panelId === 'addRulePanel') {
        if (canceled) {
            return showPanel(player, 'rulesManagementPanel', context);
        }
        const [newRuleText] = (response as ModalFormResponse).formValues as string[];
        if (newRuleText) {
            rulesManager.addRule(newRuleText);
            player.sendMessage('§2Rule added successfully.');
        }
        return showPanel(player, 'rulesManagementPanel', context);
    }

    if (panelId === 'helpfulLinksManagementPanel') {
        const page = context.page || 1;
        const links = helpfulLinksManager.getHelpfulLinks();

        // Back button
        if (selection === 0) {
            return showPanel(player, 'mainPanel', context);
        }
        // Add Link button
        if (selection === 1) {
            return showPanel(player, 'addHelpfulLinkPanel', context);
        }

        const paginatedLinks = getPaginatedItems(links, page);
        const selectionIndex = selection - 2;

        // Handle link selection
        if (selectionIndex < paginatedLinks.length) {
            const linkIndex = (page - 1) * itemsPerPage + selectionIndex;
            return showPanel(player, 'helpfulLinkActionPanel', { ...context, linkIndex });
        }

        // Handle pagination
        let buttonIndex = selectionIndex - paginatedLinks.length;
        const totalPages = Math.ceil(links.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        if (links.length > itemsPerPage) {
            if (hasPrev && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            if (hasPrev) {
                buttonIndex--;
            }

            if (hasNext && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
            if (hasNext) {
                buttonIndex--;
            }
        }
        return;
    }

    if (panelId === 'addHelpfulLinkPanel') {
        if (canceled) {
            return showPanel(player, 'helpfulLinksManagementPanel', context);
        }
        const [title, url] = (response as ModalFormResponse).formValues as string[];
        if (title && url) {
            helpfulLinksManager.addHelpfulLink(title, url);
            player.sendMessage('§2Link added successfully.');
        }
        return showPanel(player, 'helpfulLinksManagementPanel', context);
    }

    if (panelId === 'helpfulLinkActionPanel') {
        const { linkIndex } = context;
        if (selection === undefined) return;
        switch (selection) {
            case 0: {
                // Edit
                const links = helpfulLinksManager.getHelpfulLinks();
                const currentLink = links[linkIndex];
                const editForm = new ModalFormData()
                    .title('Edit Link')
                    .textField('Link Title', 'Enter the new title', { defaultValue: currentLink.title })
                    .textField('Link URL', 'Enter the new URL', { defaultValue: currentLink.url });
                const editResponse = await utils.uiWait(player, editForm);
                if (editResponse.canceled) {
                    return showPanel(player, 'helpfulLinkActionPanel', context);
                }
                const [newTitle, newUrl] = (editResponse as ModalFormResponse).formValues as string[];
                if (newTitle && newUrl) {
                    helpfulLinksManager.editHelpfulLink(linkIndex, newTitle, newUrl);
                    player.sendMessage('§2Link updated successfully.');
                }
                return showPanel(player, 'helpfulLinksManagementPanel', context);
            }
            case 1: // Move Up
                helpfulLinksManager.moveHelpfulLink(linkIndex, 'up');
                return showPanel(player, 'helpfulLinksManagementPanel', context);
            case 2: // Move Down
                helpfulLinksManager.moveHelpfulLink(linkIndex, 'down');
                return showPanel(player, 'helpfulLinksManagementPanel', context);
            case 3: {
                // Delete Link
                showConfirmationDialog(player, {
                    title: '§cConfirm Deletion',
                    body: 'Are you sure you want to delete this link?',
                    confirmButtonText: '§cYes, Delete',
                    cancelButtonText: '§2No, Cancel',
                    onConfirm: () => {
                        helpfulLinksManager.deleteHelpfulLink(linkIndex);
                        player.sendMessage('§2Link deleted successfully.');
                        showPanel(player, 'helpfulLinksManagementPanel', context);
                    },
                    onCancel: () => {
                        showPanel(player, 'helpfulLinksManagementPanel', context);
                    }
                });
                return;
            }
            case 4: // Back
                return showPanel(player, 'helpfulLinksManagementPanel', context);
        }
        return;
    }

    if (panelId === 'ruleActionPanel') {
        const { ruleIndex } = context;

        if (selection === undefined) return;
        switch (selection) {
            case 0: {
                // Edit Text
                const rules = rulesManager.getRules();
                const currentText = rules[ruleIndex];
                const editForm = new ModalFormData()
                    .title('Edit Rule Text')
                    .textField('Rule text', 'Enter the new text', { defaultValue: currentText });

                const editResponse = await utils.uiWait(player, editForm);
                if (editResponse.canceled) {
                    return showPanel(player, 'ruleActionPanel', context);
                }

                const [newText] = (editResponse as ModalFormResponse).formValues as string[];
                if (newText) {
                    rulesManager.editRule(ruleIndex, newText);
                    player.sendMessage('§2Rule updated successfully.');
                }
                return showPanel(player, 'rulesManagementPanel', context);
            }
            case 1: // Move Up
                rulesManager.moveRule(ruleIndex, 'up');
                return showPanel(player, 'rulesManagementPanel', context);
            case 2: // Move Down
                rulesManager.moveRule(ruleIndex, 'down');
                return showPanel(player, 'rulesManagementPanel', context);
            case 3: {
                // Delete Rule
                showConfirmationDialog(player, {
                    title: '§cConfirm Deletion',
                    body: 'Are you sure you want to delete this rule?',
                    confirmButtonText: '§cYes, Delete',
                    cancelButtonText: '§2No, Cancel',
                    onConfirm: () => {
                        rulesManager.deleteRule(ruleIndex);
                        player.sendMessage('§2Rule deleted successfully.');
                        showPanel(player, 'rulesManagementPanel', context);
                    },
                    onCancel: () => {
                        showPanel(player, 'rulesManagementPanel', context);
                    }
                });
                return;
            }
            case 4: // Back
                return showPanel(player, 'rulesManagementPanel', context);
        }
        return;
    }

    // --- Shop Panel Handlers ---
    if (panelId === 'shopMainPanel') {
        if (selection === 0) {
            return showPanel(player, 'mainPanel');
        }
        const shopConfig = getShopConfig();

        const validCategories = Object.keys(shopConfig.categories)
            .filter((categoryName: string) => {
                const category = shopConfig.categories[categoryName];
                const hasItems = Object.keys(category.items).length > 0;
                const hasSubCategories = Object.keys(category.subCategories).length > 0;
                return hasItems || hasSubCategories;
            })
            .sort();
        const selectedCategoryName = validCategories[selection - 1];
        if (selectedCategoryName) {
            return showPanel(player, `shopCategoryPanel_${selectedCategoryName}`, {
                ...context,
                categoryName: selectedCategoryName
            });
        }
        return;
    }

    if (panelId === 'configResetPanel') {
        const page = context.page || 1;
        const resettableSystems = [
            ...configPanelSchema
                .filter((c) => !c.id.startsWith('general_')) // General settings are not individually resettable via this panel
                .map((c) => ({ id: c.id, title: c.title, icon: c.icon })),
            { id: 'kits', title: '§l§dKit System§r', icon: 'textures/ui/inventory_icon' },
            { id: 'shop', title: '§l§2Shop System§r', icon: 'textures/items/emerald' },
            { id: 'ranks', title: '§l§4Rank System§r', icon: 'textures/ui/permissions_member_star.png' }
        ];
        resettableSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));

        const sortedSystems = resettableSystems;

        if (selection === 0) {
            // Back button
            return showPanel(player, 'configCategoryPanel', { ...context, page: 1 });
        }

        const paginatedSystems = getPaginatedItems(sortedSystems, page);
        const selectionIndex = selection - 1;

        if (selectionIndex < paginatedSystems.length) {
            const selectedSystem = paginatedSystems[selectionIndex];
            showConfirmationDialog(player, {
                title: `Confirm Reset: ${selectedSystem.title}`,
                body: `This action cannot be undone. Are you sure you want to reset the ${selectedSystem.title} configuration to its default values?`,
                confirmButtonText: '§cYes, Reset',
                cancelButtonText: '§2No, Cancel',
                onConfirm: async () => {
                    const finalConfirmForm = new ModalFormData()
                        .title('Final Confirmation')
                .textField(`Type "confirm" to reset ${selectedSystem.title}.`, 'Case-insensitive', { defaultValue: '' });

                    const finalConfirmResponse = await utils.uiWait(player, finalConfirmForm);

                    if (
                        finalConfirmResponse.canceled ||
                        ((finalConfirmResponse as ModalFormResponse).formValues?.[0] as string)
                            .trim()
                            .toLowerCase() !== 'confirm'
                    ) {
                        player.sendMessage('§cFinal confirmation failed. Reset canceled.');
                        return showPanel(player, 'configResetPanel', { ...context, page });
                    }

                    const result = await resetConfigSection(selectedSystem.id, player);
                    if (result.success) {
                        player.sendMessage(`§2${result.message}`);
                    } else {
                        player.sendMessage(
                            '§cFailed to reset the configuration. Please check the console for details.'
                        );
                        errorLog(
                            `[UIManager] Failed to reset config section '${selectedSystem.id}': ${result.message}`
                        );
                    }
                    return showPanel(player, 'configResetPanel', { ...context, page: 1 });
                },
                onCancel: () => {
                    player.sendMessage('§2Reset canceled.');
                    return showPanel(player, 'configResetPanel', { ...context, page });
                }
            });
            return;
        }

        let buttonIndex = selectionIndex - paginatedSystems.length;

        const totalPages = Math.ceil(resettableSystems.length / itemsPerPage);

        if (page >= totalPages) {
            if (buttonIndex === 0) {
                showConfirmationDialog(player, {
                    title: 'Confirm Reset All',
                    body: 'This action cannot be undone. Are you sure you want to reset ALL system configurations to their default values?',
                    confirmButtonText: '§cYes, Reset All',
                    cancelButtonText: '§2No, Cancel',
                    onConfirm: async () => {
                        const finalConfirmForm = new ModalFormData()
                            .title('Final Confirmation')
                            .textField('Type "confirm" to reset ALL systems.', 'Case-insensitive', { defaultValue: '' });

                        const finalConfirmResponse = await utils.uiWait(player, finalConfirmForm);

                        if (
                            finalConfirmResponse.canceled ||
                            (finalConfirmResponse.formValues?.[0] as string).trim().toLowerCase() !== 'confirm'
                        ) {
                            player.sendMessage('§cFinal confirmation failed. Reset canceled.');
                            return showPanel(player, 'configResetPanel', { ...context, page });
                        }

                        const result = await resetConfigSection('all', player);
                        if (result.success) {
                            player.sendMessage(`§2${result.message}`);
                        } else {
                            player.sendMessage(
                                '§cFailed to reset all configurations. Please check the console for details.'
                            );
                            errorLog(`[UIManager] Failed to reset all config sections: ${result.message}`);
                        }
                        return showPanel(player, 'configResetPanel', { ...context, page: 1 });
                    },
                    onCancel: () => {
                        player.sendMessage('§2Reset canceled.');
                        return showPanel(player, 'configResetPanel', { ...context, page });
                    }
                });
                return;
            }
            buttonIndex--;
        }

        // Handle pagination
        const hasPrev = page > 1;

        if (hasPrev && buttonIndex === 0) {
            return showPanel(player, panelId, { ...context, page: page - 1 });
        }
        if (buttonIndex >= 0) {
            // Should be next page
            return showPanel(player, panelId, { ...context, page: page + 1 });
        }

        return;
    }

    if (panelId.startsWith('shopCategoryPanel_') || panelId.startsWith('shopItemListPanel_')) {
        const isItemList = panelId.startsWith('shopItemListPanel_');
        const prefix = isItemList ? 'shopItemListPanel_' : 'shopCategoryPanel_';
        const rawId = panelId.replace(prefix, '');
        const parts = rawId.split('_');
        const categoryName = parts[0];
        const subCategoryName = isItemList ? parts.slice(1).join('_') : undefined;
        const page = context.page || 1;
        const view = context.view || 'shop';

        if (selection === 0) {
            // Back button
            const parentPanel = isItemList ? `shopCategoryPanel_${categoryName}` : 'shopMainPanel';
            return showPanel(player, parentPanel, { ...context, page: 1 });
        }

        // Reconstruct the list of entries that was shown to the player
        const shopConfig = getShopConfig();
        const category = shopConfig.categories[categoryName];
        let allEntries: { type: string }[] = [];
        if (isItemList && subCategoryName) {
            const subCategory = category.subCategories[subCategoryName];
            allEntries = Object.keys(subCategory.items).map((id) => ({ id, ...subCategory.items[id], type: 'item' }));
        } else {
            // shopCategoryPanel
            const subCategories = Object.keys(category.subCategories)
                .sort()
                .map((name) => ({ name, ...category.subCategories[name], type: 'subCategory' }));
            const items = Object.keys(category.items).map((id) => ({ id, ...category.items[id], type: 'item' }));
            allEntries = [...subCategories, ...items];
        }

        const paginatedEntries = getPaginatedItems(allEntries, page);
        const selectionIndex = selection - 1;

        // Handle pagination
        if (selectionIndex >= paginatedEntries.length) {
            let newPage = page;
            const totalPages = Math.ceil(allEntries.length / itemsPerPage);
            const hasPrev = page > 1;
            const hasNext = page < totalPages;
            const buttonIndex = selectionIndex - paginatedEntries.length;

            if (hasPrev && buttonIndex === 0) {
                newPage--;
            } else if (hasNext) {
                newPage++;
            }
            return showPanel(player, panelId, { ...context, page: newPage });
        }

        const selectedEntry = paginatedEntries[selectionIndex] as {
            type: string;
            name: string;
            id: string;
            buyPrice: number;
            sellPrice: number;
        };

        if (selectedEntry.type === 'subCategory') {
            return showPanel(player, `shopItemListPanel_${categoryName}_${selectedEntry.name}`, {
                ...context,
                categoryName,
                subCategoryName: selectedEntry.name,
                page: 1
            });
        }

        // It's an item
        const itemId = selectedEntry.id;
        const masterItem = allItems[itemId];
        const shopItem = selectedEntry;

        const canBuy = view !== 'sell' && shopItem.buyPrice > 0;
        const canSell = view !== 'buy' && shopItem.sellPrice > 0;

        if (!canBuy && !canSell) {
            player.sendMessage('§cThis item cannot be bought or sold currently.');
            return showPanel(player, panelId, context);
        }

        const modal = new ModalFormData().title(masterItem.displayName ?? itemId);
        let action;
        let hasDropdown = false;

        if (canBuy && canSell) {
            modal.textField('Amount', 'Enter the amount', { defaultValue: '1' });
            const options = [`Buy ($${shopItem.buyPrice})`, `Sell ($${shopItem.sellPrice})`];
            modal.dropdown('Action', options, 0);
            hasDropdown = true;
        } else if (canBuy) {
            modal.textField(`Amount to Buy (Price: $${shopItem.buyPrice})`, 'Enter a numeric value', {
                defaultValue: '1'
            });
            action = 'buy';
        } else {
            // canSell
            modal.textField(`Amount to Sell (Price: $${shopItem.sellPrice})`, 'Enter a numeric value', {
                defaultValue: '1'
            });
            action = 'sell';
        }

        const modalResponse = await utils.uiWait(player, modal);

        if (modalResponse.canceled) {
            return showPanel(player, panelId, context);
        }

        let amount;
        if (hasDropdown) {
            const [amountStr, actionIndex] = (modalResponse as ModalFormResponse).formValues as [string, number];
            amount = parseInt(amountStr, 10);
            const options = [`Buy ($${shopItem.buyPrice})`, `Sell ($${shopItem.sellPrice})`];
            const selectedActionString = options[actionIndex];
            action = selectedActionString.startsWith('Buy') ? 'buy' : 'sell';
        } else {
            const [amountStr] = (modalResponse as ModalFormResponse).formValues as [string];
            amount = parseInt(amountStr, 10);
        }

        if (isNaN(amount) || amount <= 0) {
            player.sendMessage('§cInvalid amount.');
            return showPanel(player, panelId, context);
        }

        let result;
        if (action === 'buy') {
            result = shopManager.buyItem(player, itemId, amount);
        } else {
            // action === 'sell'
            result = shopManager.sellItem(player, itemId, amount);
        }
        player.sendMessage(result.message);

        return showPanel(player, panelId, context); // Refresh the panel
    }

    // --- Admin Edit Shop Panel Handlers ---
    if (panelId.startsWith('shopAddItemPanel_')) {
        const { categoryName, page = 1 } = context;
        if (selection === 0) {
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
        }

        if (selection === 1) {
            // Add Custom Item
            const form = new ModalFormData()
                .title('Add Custom Item')
                .textField('Item ID (unique key)', 'e.g., custom_sword')
                .textField('Display Name', 'e.g., Sword of Awesome')
                .textField('Minecraft Item ID', 'e.g., minecraft:diamond_sword')
                .textField('Icon Path', 'e.g., textures/items/diamond_sword')
                .textField('Buy Price', '-1 to disable', { defaultValue: '-1' })
                .textField('Sell Price', '-1 to disable', { defaultValue: '-1' })
                .textField('Permission Level', 'e.g., 1024', { defaultValue: '1024' });
            const response = await utils.uiWait(player, form);
            if (response.canceled) {
                return showPanel(player, panelId, context);
            }
            const [customId, displayName, mcId, icon, buyPriceStr, sellPriceStr, permLevelStr] = (
                response as ModalFormResponse
            ).formValues as string[];
            const buyPrice = parseInt(buyPriceStr, 10);
            const sellPrice = parseInt(sellPriceStr, 10);
            const permissionLevel = parseInt(permLevelStr, 10);

            if (
                customId &&
                displayName &&
                mcId &&
                icon &&
                !isNaN(buyPrice) &&
                !isNaN(sellPrice) &&
                !isNaN(permissionLevel)
            ) {
                shopAdminManager.addCustomItemToConfig(customId, {
                    itemId: mcId,
                    icon,
                    buyPrice,
                    sellPrice,
                    displayName
                });
                shopAdminManager.setItem(categoryName, null, customId, {
                    buyPrice,
                    sellPrice,
                    permissionLevel,
                    icon,
                    displayName
                });
                player.sendMessage(`§2Successfully added custom item '${displayName}'.`);
            } else {
                player.sendMessage('§cInvalid custom item data.');
            }
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        }

        const allPossibleItems = Object.keys(allItems);
        const paginatedItems = getPaginatedItems(allPossibleItems, page);
        const selectedItemId = paginatedItems[selection - 2];

        if (selectedItemId) {
            const masterItem = allItems[selectedItemId];
            const form = new ModalFormData()
                .title(`Add ${masterItem.displayName}`)
                .textField('Icon Path', 'e.g., textures/items/diamond_sword', { defaultValue: masterItem.icon })
                .textField('Buy Price', '-1 to disable', { defaultValue: `${masterItem.buyPrice}` })
                .textField('Sell Price', '-1 to disable', { defaultValue: `${masterItem.sellPrice}` })
                .textField('Permission Level', 'e.g., 1024', { defaultValue: '1024' });
            const response = await utils.uiWait(player, form);
            if (response.canceled) {
                return showPanel(player, panelId, context);
            }
            const [icon, buyPriceStr, sellPriceStr, permLevelStr] = (response as ModalFormResponse)
                .formValues as string[];
            const buyPrice = parseInt(buyPriceStr, 10);
            const sellPrice = parseInt(sellPriceStr, 10);
            const permissionLevel = parseInt(permLevelStr, 10);
            if (!isNaN(buyPrice) && !isNaN(sellPrice) && !isNaN(permissionLevel)) {
                const result = shopAdminManager.setItem(categoryName, null, selectedItemId, {
                    buyPrice,
                    sellPrice,
                    permissionLevel,
                    icon
                });
                player.sendMessage(result.message);
            }
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        }
        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(allPossibleItems.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        const buttonIndex = selection - 2 - paginatedItems.length;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId === 'shopManagementPanel') {
        const page = context.page || 1;
        if (selection === 0) {
            return showPanel(player, 'configCategoryPanel');
        }

        if (selection === 1) {
            const mainConfig = getConfig();
            const newStatus = !mainConfig.shop.enabled;
            updateMultipleConfig({ 'shop.enabled': newStatus });
            player.sendMessage(`§2Shop system has been ${newStatus ? 'enabled' : 'disabled'}.`);
            return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
        }

        if (selection === 2) {
            // Add Category
            const form = new ModalFormData()
                .title('Add Category')
                .textField('Category Name', 'Enter category name', { defaultValue: '' })
                .textField('Icon', 'Enter icon texture path', { defaultValue: '' });
            const response = await utils.uiWait(player, form);
            if (response.canceled) {
                return showPanel(player, panelId, context);
            }
            const [name, icon] = (response as ModalFormResponse).formValues as string[];
            if (name) {
                const result = shopAdminManager.addCategory(name, icon);
                player.sendMessage(result.message);
            }
            return showPanel(player, panelId, { ...context, page: 1 });
        }

        const shopConfig = getShopConfig();
        const categories = Object.keys(shopConfig.categories).sort();
        const paginatedCategories = getPaginatedItems(categories, page);
        const selectedCategoryName = paginatedCategories[selection - 3];

        if (selectedCategoryName) {
            return showPanel(player, `shopAdminCategoryPanel_${selectedCategoryName}`, {
                categoryName: selectedCategoryName
            });
        }
        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(categories.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        const buttonIndex = selection - 3 - paginatedCategories.length;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId.startsWith('shopAdminCategoryPanel_')) {
        const { categoryName, page = 1 } = context;
        if (selection === 0) {
            return showPanel(player, 'shopManagementPanel');
        }
        if (selection === 1) {
            // Add Item
            return showPanel(player, `shopAddItemPanel_${categoryName}`, context);
        }
        if (selection === 2) {
            // Add Subcategory
            const form = new ModalFormData()
                .title('Add Subcategory')
                .textField('Subcategory Name', 'Enter subcategory name', { defaultValue: '' })
                .textField('Icon', 'Enter icon texture path', { defaultValue: '' });
            const response = await utils.uiWait(player, form);
            if (response.canceled) {
                return showPanel(player, panelId, context);
            }
            const [name, icon] = (response as ModalFormResponse).formValues as string[];
            if (name) {
                const result = shopAdminManager.addSubCategory(categoryName, name, icon);
                player.sendMessage(result.message);
            }
            return showPanel(player, panelId, { ...context, page: 1 });
        }
        if (selection === 3) {
            // Edit Category
            return showPanel(player, `shopAdminCategoryActionPanel_${categoryName}`, context);
        }

        const shopConfig = getShopConfig();
        const category = shopConfig.categories[categoryName];
        const subCategories = Object.keys(category.subCategories)
            .sort()
            .map((name) => ({ name, ...category.subCategories[name], type: 'subCategory' }));
        const items = Object.keys(category.items).map((id) => ({ id, ...category.items[id], type: 'item' }));
        const allEntries = [...subCategories, ...items];
        const paginatedEntries = getPaginatedItems(allEntries, page);
        const selectedEntry = paginatedEntries[selection - 4] as {
            type: string;
            id: string;
            displayName: string;
            icon: string;
            buyPrice: number;
            sellPrice: number;
            permissionLevel: number;
            name: string;
        };

        if (selectedEntry) {
            if (selectedEntry.type === 'item') {
                const form = new ActionFormData()
                    .title('Edit Item')
                    .button('Edit', 'textures/ui/icon_setting')
                    .button('Delete', 'textures/ui/trash');
                const response = await utils.uiWait(player, form);
                if (response.canceled) {
                    return showPanel(player, panelId, context);
                }
                if (response.selection === 0) {
                    // Edit
                    const masterItem = allItems[selectedEntry.id] || {};
                    const editForm = new ModalFormData()
                        .title(`Edit Item: ${selectedEntry.id}`)
                        .textField('Display Name', 'e.g., Magical Sword', {
                            defaultValue: selectedEntry.displayName || masterItem.displayName
                        })
                        .textField('Minecraft Item ID', 'e.g., minecraft:diamond_sword', {
                            defaultValue: masterItem.itemId
                        })
                        .textField('Icon Path', 'e.g., textures/items/diamond_sword', {
                            defaultValue: selectedEntry.icon || masterItem.icon
                        })
                        .textField('Buy Price', '-1 to disable', { defaultValue: String(selectedEntry.buyPrice) })
                        .textField('Sell Price', '-1 to disable', { defaultValue: String(selectedEntry.sellPrice) })
                        .textField('Permission Level', 'e.g., 1024', {
                            defaultValue: String(selectedEntry.permissionLevel)
                        });

                    const editResponse = await utils.uiWait(player, editForm);
                    if (editResponse.canceled) {
                        return showPanel(player, panelId, context);
                    }

                    const [displayName, minecraftId, icon, buyPriceStr, sellPriceStr, permLevelStr] = (
                        editResponse as ModalFormResponse
                    ).formValues as string[];
                    const buyPrice = Number(buyPriceStr);
                    const sellPrice = Number(sellPriceStr);
                    const permissionLevel = Number(permLevelStr);

                    if (
                        displayName &&
                        minecraftId &&
                        icon &&
                        !isNaN(buyPrice) &&
                        !isNaN(sellPrice) &&
                        !isNaN(permissionLevel)
                    ) {
                        const result = shopAdminManager.updateShopItem(categoryName, null, selectedEntry.id, {
                            buyPrice,
                            sellPrice,
                            permissionLevel,
                            icon,
                            minecraftId,
                            displayName
                        });
                        player.sendMessage(result.message);
                    } else {
                        player.sendMessage('§cInvalid data. Please check all fields.');
                    }
                } else {
                    // Delete
                    const result = shopAdminManager.removeItem(categoryName, null, selectedEntry.id);
                    player.sendMessage(result.message);
                }
            } else {
                // subCategory
                return showPanel(player, `shopAdminSubCategoryItemPanel_${selectedEntry.name}`, {
                    ...context,
                    subCategoryName: selectedEntry.name
                });
            }
            return showPanel(player, panelId, { ...context, page: 1 });
        }
        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(allEntries.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        const buttonIndex = selection - 4 - paginatedEntries.length;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId.startsWith('shopAdminCategoryActionPanel_')) {
        const categoryName = panelId.replace('shopAdminCategoryActionPanel_', '');

        if (selection === 0) {
            // Edit
            const shopConfig = getShopConfig();
            const category = shopConfig.categories[categoryName];
            const form = new ModalFormData()
                .title('Edit Category')
                .textField('Category Name', 'Enter new name', { defaultValue: categoryName })
                .textField('Icon', 'Enter icon texture path', { defaultValue: category.icon });
            const response = await utils.uiWait(player, form);
            if (response.canceled) {
                return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
            }
            const [newName, newIcon] = (response as ModalFormResponse).formValues as string[];
            if (newName) {
                const result = shopAdminManager.editCategory(categoryName, newName, newIcon);
                player.sendMessage(result.message);
            }
            return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
        }
        if (selection === 1) {
            // Delete
            showConfirmationDialog(player, {
                title: 'Confirm Deletion',
                body: 'Are you sure?',
                confirmButtonText: '§cYes, Delete',
                cancelButtonText: '§2No, Cancel',
                onConfirm: () => {
                    const result = shopAdminManager.deleteCategory(categoryName);
                    player.sendMessage(result.message);
                    return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
                },
                onCancel: () => {
                    return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
                }
            });
            return;
        }
        if (selection === 2) {
            // Back
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
        }
    }

    if (panelId.startsWith('shopAdminSubCategoryItemPanel_')) {
        const { categoryName, subCategoryName, page = 1 } = context;
        if (selection === 0) {
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
        }
        if (selection === 1) {
            // Add Item
            return showPanel(player, `shopAddItemPanel_${categoryName}`, { ...context, subCategoryName });
        }
        if (selection === 2) {
            // Edit Subcategory
            return showPanel(player, `shopAdminSubCategoryActionPanel_${subCategoryName}`, context);
        }

        const shopConfig = getShopConfig();
        const subCategory = shopConfig.categories[categoryName].subCategories[subCategoryName];
        const items = Object.keys(subCategory.items).map((id) => ({ id, ...subCategory.items[id], type: 'item' }));
        const paginatedItems = getPaginatedItems(items, page);
        const selectedItem = paginatedItems[selection - 3] as {
            id: string;
            displayName: string;
            icon: string;
            buyPrice: number;
            sellPrice: number;
            permissionLevel: number;
        };

        if (selectedItem) {
            const form = new ActionFormData()
                .title('Edit Item')
                .button('Edit', 'textures/ui/icon_setting')
                .button('Delete', 'textures/ui/trash');
            const response = await utils.uiWait(player, form);
            if (response.canceled) {
                return showPanel(player, panelId, context);
            }
            if (response.selection === 0) {
                // Edit
                const masterItem = allItems[selectedItem.id] || {};
                const editForm = new ModalFormData()
                    .title(`Edit Item: ${selectedItem.id}`)
                    .textField('Display Name', 'e.g., Magical Sword', {
                        defaultValue: selectedItem.displayName || masterItem.displayName
                    })
                    .textField('Minecraft Item ID', 'e.g., minecraft:diamond_sword', {
                        defaultValue: masterItem.itemId
                    })
                    .textField('Icon Path', 'e.g., textures/items/diamond_sword', {
                        defaultValue: selectedItem.icon || masterItem.icon
                    })
                    .textField('Buy Price', '-1 to disable', { defaultValue: String(selectedItem.buyPrice) })
                    .textField('Sell Price', '-1 to disable', { defaultValue: String(selectedItem.sellPrice) })
                    .textField('Permission Level', 'e.g., 1024', {
                        defaultValue: String(selectedItem.permissionLevel)
                    });

                const editResponse = await utils.uiWait(player, editForm);
                if (editResponse.canceled) {
                    return showPanel(player, panelId, context);
                }

                const [displayName, minecraftId, icon, buyPriceStr, sellPriceStr, permLevelStr] = (
                    editResponse as ModalFormResponse
                ).formValues as string[];
                const buyPrice = Number(buyPriceStr);
                const sellPrice = Number(sellPriceStr);
                const permissionLevel = Number(permLevelStr);

                if (
                    displayName &&
                    minecraftId &&
                    icon &&
                    !isNaN(buyPrice) &&
                    !isNaN(sellPrice) &&
                    !isNaN(permissionLevel)
                ) {
                    const result = shopAdminManager.updateShopItem(categoryName, subCategoryName, selectedItem.id, {
                        buyPrice,
                        sellPrice,
                        permissionLevel,
                        icon,
                        minecraftId,
                        displayName
                    });
                    player.sendMessage(result.message);
                } else {
                    player.sendMessage('§cInvalid data. Please check all fields.');
                }
            } else {
                // Delete
                const result = shopAdminManager.removeItem(categoryName, subCategoryName, selectedItem.id);
                player.sendMessage(result.message);
            }
            return showPanel(player, panelId, { ...context, page: 1 });
        }

        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(items.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        const buttonIndex = selection - 3 - paginatedItems.length;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId.startsWith('shopAdminSubCategoryActionPanel_')) {
        const subCategoryName = panelId.replace('shopAdminSubCategoryActionPanel_', '');
        const { categoryName } = context;
        if (selection === 0) {
            // Edit
            const shopConfig = getShopConfig();
            const subCategory = shopConfig.categories[categoryName].subCategories[subCategoryName];
            const form = new ModalFormData()
                .title('Edit Subcategory')
                .textField('Subcategory Name', 'Enter new name', { defaultValue: subCategoryName })
                .textField('Icon', 'Enter icon texture path', { defaultValue: subCategory.icon });
            const response = await utils.uiWait(player, form);
            if (response.canceled) {
                return showPanel(player, `shopAdminSubCategoryItemPanel_${subCategoryName}`, context);
            }
            const [newName, newIcon] = (response as ModalFormResponse).formValues as string[];
            if (newName) {
                const result = shopAdminManager.editSubCategory(categoryName, subCategoryName, newName, newIcon);
                player.sendMessage(result.message);
            }
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        }
        if (selection === 1) {
            // Delete
            showConfirmationDialog(player, {
                title: 'Confirm Deletion',
                body: 'Are you sure?',
                confirmButtonText: '§cYes, Delete',
                cancelButtonText: '§2No, Cancel',
                onConfirm: () => {
                    const result = shopAdminManager.deleteSubCategory(categoryName, subCategoryName);
                    player.sendMessage(result.message);
                    return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
                },
                onCancel: () => {
                    return showPanel(player, `shopAdminSubCategoryActionPanel_${subCategoryName}`, context);
                }
            });
            return;
        }
        if (selection === 2) {
            // Back
            return showPanel(player, `shopAdminSubCategoryItemPanel_${subCategoryName}`, context);
        }
    }

    if (panelId === 'kitManagementPanel') {
        const mainConfig = getConfig();
        const page = context.page || 1;

        // Handle Back button
        if (selection === 0) {
            return showPanel(player, 'configCategoryPanel');
        }

        // Handle global toggle button
        if (selection === 1) {
            const newStatus = !mainConfig.kits.enabled;
            updateMultipleConfig({ 'kits.enabled': newStatus });
            player.sendMessage(`§2Kit system has been ${newStatus ? 'enabled' : 'disabled'}.`);
            return showPanel(player, 'kitManagementPanel', { ...context, page: 1 }); // Reload
        }

        // Handle Create New Kit button
        if (selection === 2) {
            const form = new ModalFormData()
                .title('Create New Kit')
                .textField('Kit Name', 'Enter a unique name for the kit')
                .textField('Cooldown (seconds)', 'e.g., 3600', { defaultValue: '3600' })
                .textField('Permission Level', '0=Admin, 1024=Member', { defaultValue: '1024' })
                .textField('Price', 'Cost to claim', { defaultValue: '0' });

            const createResponse = await utils.uiWait(player, form);
            if (createResponse.canceled) {
                return showPanel(player, 'kitManagementPanel', context);
            }

            const [kitName, cooldownStr, permissionLevelStr, priceStr] = (createResponse as ModalFormResponse)
                .formValues as string[];
            const cooldown = Number(cooldownStr);
            const permissionLevel = Number(permissionLevelStr);
            const price = Number(priceStr);

            if (!kitName || isNaN(cooldown) || isNaN(permissionLevel) || isNaN(price)) {
                player.sendMessage('§cInvalid input. Please check your values.');
                return showPanel(player, 'kitManagementPanel', context);
            }

            const result = createKit(kitName, { cooldown, permissionLevel, price });
            player.sendMessage(result.message);

            if (result.success) {
                return showPanel(player, `kitActionMenu_${kitName}`, context);
            } else {
                return showPanel(player, 'kitManagementPanel', context);
            }
        }

        const allKits = getAllKits();
        const kitNames = Object.keys(allKits);
        const paginatedKits = getPaginatedItems(kitNames, page);
        const totalPages = Math.ceil(kitNames.length / itemsPerPage);

        const kitStartIndex = 3; // Adjusted for the new buttons
        const kitEndIndex = kitStartIndex + paginatedKits.length - 1;

        if (selection >= kitStartIndex && selection <= kitEndIndex) {
            const selectedKitName = paginatedKits[selection - kitStartIndex];
            return showPanel(player, `kitActionMenu_${selectedKitName}`, {});
        }

        // After kit items, check for pagination buttons
        let currentButtonIndex = kitEndIndex + 1;

        if (page > 1) {
            // Previous Page button exists
            if (selection === currentButtonIndex) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            currentButtonIndex++;
        }
        if (page < totalPages) {
            // Next Page button exists
            if (selection === currentButtonIndex) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
        }

        return; // Should not be reached
    }

    if (panelId.startsWith('kitSettingsPanel_')) {
        const kitName = panelId.replace('kitSettingsPanel_', ''); // This is the original (lowercase) name
        if (canceled) {
            return showPanel(player, `kitActionMenu_${kitName}`, context);
        }

        const [isEnabled, newKitName, description, icon, cooldownStr, permissionLevelStr, priceStr] = (
            response as ModalFormResponse
        ).formValues as [
            boolean,
            string,
            string,
            string,
            string,
            string,
            string
        ];

        let finalKitName = kitName;
        // Check if the name has changed (case-insensitive)
        if (newKitName.toLowerCase() !== kitName) {
            const renameResult = renameKit(kitName, newKitName);
            if (!renameResult.success) {
                player.sendMessage(`§c${renameResult.message}`);
                // Re-show the panel with the original name
                return showPanel(player, `kitSettingsPanel_${kitName}`, context);
            }
            player.sendMessage(`§2Kit '${kitName}' has been renamed to '${newKitName}'.`);
            finalKitName = newKitName.toLowerCase();
        }

        const newSettings = {
            enabled: isEnabled,
            description: description,
            icon: icon,
            cooldownSeconds: Number(cooldownStr),
            permissionLevel: Number(permissionLevelStr),
            price: Number(priceStr)
        };

        updateKitSettings(finalKitName, newSettings);

        player.sendMessage(`§2Successfully updated settings for kit '${finalKitName}'.`);
        return showPanel(player, `kitActionMenu_${finalKitName}`, context);
    }

    if (panelId.startsWith('kitActionMenu_')) {
        const kitName = panelId.replace('kitActionMenu_', '');

        switch (selection) {
            case 0: // Edit Settings
                return showPanel(player, `kitSettingsPanel_${kitName}`, context);
            case 1: // Edit Items
                return showPanel(player, `kitItemsPanel_${kitName}`, context);
            case 2: {
                // Delete Kit
                showConfirmationDialog(player, {
                    title: `Delete Kit: ${kitName}?`,
                    body: 'This action cannot be undone.',
                    confirmButtonText: '§cYes, delete this kit',
                    cancelButtonText: '§2No, go back',
                    onConfirm: () => {
                        deleteKit(kitName);
                        player.sendMessage(`§2Kit '${kitName}' has been deleted.`);
                        showPanel(player, 'kitManagementPanel', {});
                    },
                    onCancel: () => {
                        showPanel(player, `kitActionMenu_${kitName}`, context);
                    }
                });
                return;
            }
            case 3: // Back
                return showPanel(player, 'kitManagementPanel', {});
        }
        return;
    }

    if (panelId.startsWith('kitItemsPanel_')) {
        const kitName = panelId.replace('kitItemsPanel_', '');
        const allKits = getAllKits();
        const kit = allKits[kitName];
        const page = context.page || 1;

        if (selection === 0) {
            // Add New Item
            const form = new ModalFormData()
                .title('Add New Item')
                .textField('Item ID', 'e.g., minecraft:diamond', { defaultValue: '' })
                .textField('Amount', 'e.g., 16', { defaultValue: '' });

            const addResponse = await utils.uiWait(player, form);
            if (addResponse.canceled) {
                return showPanel(player, panelId, context);
            }

            const [typeId, amountStr] = (addResponse as ModalFormResponse).formValues as string[];
            const amount = Number(amountStr);

            if (!typeId || isNaN(amount) || amount <= 0) {
                player.sendMessage('§cInvalid item ID or amount.');
                return showPanel(player, panelId, context);
            }

            const result = addItemToKit(kitName, { typeId, amount });
            player.sendMessage(result.message);
            return showPanel(player, panelId, { ...context, page: 1 });
        }

        const paginatedItems = getPaginatedItems(kit.items, page);
        const itemStartIndex = 1;
        const itemEndIndex = itemStartIndex + paginatedItems.length - 1;

        if (selection >= itemStartIndex && selection <= itemEndIndex) {
            const selectedItemIndexInPage = selection - itemStartIndex;
            const selectedItemIndex = (page - 1) * itemsPerPage + selectedItemIndexInPage;
            const selectedItem = kit.items[selectedItemIndex];

            const form = new ModalFormData()
                .title('Edit Item')
                .textField('Item ID', 'e.g., minecraft:diamond', { defaultValue: selectedItem.typeId })
                .textField('Amount', 'Set to 0 to delete.', { defaultValue: String(selectedItem.amount) });

            const editResponse = await utils.uiWait(player, form);
            if (editResponse.canceled) {
                return showPanel(player, panelId, context);
            }

            const [typeId, amountStr] = (editResponse as ModalFormResponse).formValues as string[];
            const amount = Number(amountStr);

            if (!typeId || isNaN(amount)) {
                player.sendMessage('§cInvalid item ID or amount.');
                return showPanel(player, panelId, context);
            }

            const result = updateItemInKit(kitName, selectedItemIndex, { typeId, amount });
            player.sendMessage(result.message);
            return showPanel(player, panelId, { ...context, page: 1 }); // Go back to first page
        }

        // Handle pagination and back button
        let buttonIndex = itemEndIndex + 1;
        const totalPages = Math.ceil(kit.items.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        if (hasPrev) {
            if (selection === buttonIndex) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            buttonIndex++;
        }
        if (hasNext) {
            if (selection === buttonIndex) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
            buttonIndex++;
        }
        if (selection === buttonIndex) {
            // Back button
            return showPanel(player, `kitActionMenu_${kitName}`, context);
        }
        return;
    }

    if (panelId.startsWith('kitDetailPanel_')) {
        const kitName = panelId.replace('kitDetailPanel_', '');
        if (canceled) {
            return showPanel(player, 'kitManagementPanel', context);
        }

        // The last form value is the decorative item display, which we ignore.
        const [isEnabled, cooldownStr, permissionLevelStr] = (response as ModalFormResponse).formValues as [
            boolean,
            string,
            string
        ];
        const cooldown = Number(cooldownStr);
        const permissionLevel = Number(permissionLevelStr);

        if (isNaN(cooldown) || cooldown < 0) {
            player.sendMessage('§cInvalid cooldown. Please enter a non-negative number.');
            return showPanel(player, panelId, context); // Re-show the detail panel
        }
        if (isNaN(permissionLevel) || permissionLevel < 0) {
            player.sendMessage('§cInvalid permission level. Please enter a non-negative number.');
            return showPanel(player, panelId, context);
        }

        const kitsConfig = getKitsConfig();
        if (kitsConfig.kitDefinitions[kitName]) {
            kitsConfig.kitDefinitions[kitName].enabled = isEnabled;
            kitsConfig.kitDefinitions[kitName].cooldownSeconds = cooldown;
            kitsConfig.kitDefinitions[kitName].permissionLevel = permissionLevel;
            saveKitsConfig(kitsConfig);
            player.sendMessage(`§2Successfully updated kit '${kitName}'.`);
        }

        return showPanel(player, 'kitManagementPanel', context); // Go back to the list
    }

    if (panelId === 'commandSystemPanel') {
        const page = context.page || 1;

        if (selection === 0) {
            // Back button
            // Reset page to 1 when going back to the main category panel to prevent page number leakage
            return showPanel(player, 'configCategoryPanel', { ...context, page: 1 });
        }

        const config = getConfig();
        const commandSettings = config.commandSettings || {};

        const allCommands = Object.keys(commandSettings)
            .filter((cmd: string) => !cmd.startsWith('_'))
            .sort();

        const paginatedCommands = getPaginatedItems(allCommands, page);
        const selectionIndex = selection - 1;

        if (selectionIndex < paginatedCommands.length) {
            const commandName = paginatedCommands[selectionIndex];
            return showPanel(player, 'commandSettingsPanel', { ...context, commandName });
        }

        // Handle pagination
        let buttonIndex = selectionIndex - paginatedCommands.length;
        const totalPages = Math.ceil(allCommands.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        if (allCommands.length > itemsPerPage) {
            if (hasPrev && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            if (hasPrev) {
                buttonIndex--;
            }

            if (hasNext && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
        }
        return;
    }

    if (panelId === 'commandSettingsPanel') {
        if (canceled) {
            return showPanel(player, 'commandSystemPanel', context);
        }

        const { commandName } = context;
        const [isEnabled, permissionLevelStr] = (response as ModalFormResponse).formValues as [boolean, string];
        const permissionLevel = parseInt(permissionLevelStr, 10);

        if (isNaN(permissionLevel)) {
            player.sendMessage('§cInvalid permission level. Please enter a number.');
            return showPanel(player, 'commandSettingsPanel', context);
        }

        updateMultipleConfig({
            [`commandSettings.${commandName}.enabled`]: isEnabled,
            [`commandSettings.${commandName}.permissionLevel`]: permissionLevel
        });

        // Sync with xray config if this is the xraynotify command
        if (commandName === 'xraynotify') {
            try {
                const xrayConfig = getXrayConfig();
                xrayConfig.notifications.alertPermissionLevel = permissionLevel;
                saveXrayConfig(xrayConfig);
            } catch (e) {
                errorLog(`Failed to sync xraynotify permission to X-Ray config: ${e}`);
            }
        }

        player.sendMessage(`§2Successfully updated settings for '${commandName}'.`);
        return showPanel(player, 'commandSystemPanel', context);
    }

    if (
        panelId === 'bountyListPanel' ||
        panelId === 'reportListPanel' ||
        panelId === 'playerManagementPanel' ||
        panelId === 'playerListPanel'
    ) {
        const page = context.page || 1;

        if (selection === 0) {
            return showPanel(player, 'mainPanel');
        }

        let allItems: unknown[] = [];
        if (panelId === 'bountyListPanel') {
            allItems = Array.from(bountyManager.getAllBounties().values()).sort((a, b) => b.amount - a.amount);
        } else if (panelId === 'reportListPanel') {
            allItems = reportManager
                .getAllReports()
                .filter((r) => r.status === 'open' || r.status === 'assigned')
                .sort((a, b) => a.timestamp - b.timestamp);
        } else if (panelId === 'playerManagementPanel') {
            allItems = Array.from(getAllPlayerNameIdMap().entries()).sort((a, b) => a[0].localeCompare(b[0]));
        } else if (panelId === 'playerListPanel') {
            const onlinePlayers = Array.from((await import('@minecraft/server')).world.getAllPlayers());
            allItems = onlinePlayers.sort((a, b) => a.name.localeCompare(b.name));
        }

        const paginatedItems = getPaginatedItems(allItems, page);
        const totalPages = Math.ceil(allItems.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        const itemStartIndex = hasPrev ? 2 : 1;
        const itemEndIndex = itemStartIndex + paginatedItems.length - 1;

        // Handle Previous button click
        if (hasPrev && selection === 1) {
            return showPanel(player, panelId, { ...context, page: page - 1 });
        }

        // Handle Item click
        if (selection >= itemStartIndex && selection <= itemEndIndex) {
            const selectedItemIndex = selection - itemStartIndex;
            const selectedItem = paginatedItems[selectedItemIndex];

            if (panelId === 'bountyListPanel') {
                return showPanel(player, panelId, context); // No action yet
            }
            if (panelId === 'reportListPanel') {
                return showPanel(player, 'reportActionsPanel', { ...context, targetReport: selectedItem });
            }
            if (panelId === 'playerManagementPanel') {
                const [selectedName, selectedId] = selectedItem as [string, string];
                const targetData = loadPlayerData(selectedId);
                const contextName = targetData ? targetData.name : selectedName;
                return showPanel(player, 'playerActionsPanel', {
                    ...context,
                    targetPlayerName: contextName,
                    targetPlayerId: selectedId,
                    fromPanel: panelId,
                    targetData
                });
            }
            if (panelId === 'playerListPanel') {
                const targetData = getPlayer((selectedItem as mc.Player).id);
                return showPanel(player, 'playerActionsPanel', {
                    ...context,
                    targetPlayerName: (selectedItem as mc.Player).name,
                    targetPlayerId: (selectedItem as mc.Player).id,
                    fromPanel: panelId,
                    targetData
                });
            }
        }

        // Handle Next button click
        const nextButtonIndex = itemEndIndex + 1;
        if (hasNext && selection === nextButtonIndex) {
            return showPanel(player, panelId, { ...context, page: page + 1 });
        }
        return showPanel(player, panelId, context); // Fallback
    }

    if (panelId.startsWith('rankActionMenu_')) {
        const rankId = panelId.replace('rankActionMenu_', '');
        const rank = rankManager.getRankById(rankId);

        if (!rank) {
            player.sendMessage('§cRank not found.');
            return showPanel(player, 'rankManagementPanel', context);
        }

        switch (selection) {
            case 0: // Edit Rank
                return showPanel(player, 'editRankPanel', { ...context, rankId: rank.id });
            case 1: {
                // Delete Rank
                showConfirmationDialog(player, {
                    title: `§cDelete ${rank.name}?`,
                    body: 'This action cannot be undone.',
                    confirmButtonText: '§cYes, Delete Rank',
                    cancelButtonText: '§2No, Keep Rank',
                    onConfirm: () => {
                        const result = rankDb.deleteRank(rank.id);
                        player.sendMessage(result.message);
                        if (result.success) {
                            rankManager.reloadRanks();
                        }
                        return showPanel(player, 'rankManagementPanel', { ...context, page: 1 });
                    },
                    onCancel: () => {
                        return showPanel(player, `rankActionMenu_${rank.id}`, context);
                    }
                });
                return;
            }
            case 2: // Back
                return showPanel(player, 'rankManagementPanel', context);
        }
        return;
    }

    if (panelId === 'rankSettingsPanel') {
        if (canceled) {
            return showPanel(player, 'rankManagementPanel', context);
        }

        const { updateAllPlayerRanks } = await import('../main.js');
        const [nameTagStyleIndex] = (response as ModalFormResponse).formValues as number[];
        const nameTagStyles = ['above', 'before', 'after', 'under'];
        const selectedStyle = nameTagStyles[nameTagStyleIndex];

        updateMultipleConfig({
            'ranks.nameTagStyle': selectedStyle
        });
        updateAllPlayerRanks();
        player.sendMessage('§2Rank nametag settings updated. All player nametags have been refreshed.');
        return showPanel(player, 'rankManagementPanel', context);
    }

    if (panelId === 'rankManagementPanel') {
        const page = context.page || 1;
        // Back button
        if (selection === 0) {
            return showPanel(player, 'configCategoryPanel');
        }
        // Settings button
        if (selection === 1) {
            return showPanel(player, 'rankSettingsPanel', context);
        }
        // Add New Rank button
        if (selection === 2) {
            return showPanel(player, 'addRankPanel', context);
        }

        const allRanks = rankManager.getAllRanks().sort((a, b) => a.permissionLevel - b.permissionLevel);
        const paginatedRanks = getPaginatedItems(allRanks, page);
        const totalPages = Math.ceil(allRanks.length / itemsPerPage);

        const rankStartIndex = 3; // Adjusted for Back, Settings, and Add Rank buttons
        const rankEndIndex = rankStartIndex + paginatedRanks.length - 1;

        if (selection >= rankStartIndex && selection <= rankEndIndex) {
            const selectedRank = paginatedRanks[selection - rankStartIndex];
            const isSpecialRank = selectedRank.conditions.some(
                (c: { type: string }) => c.type === 'isOwner' || c.type === 'default'
            );

            if (isSpecialRank) {
                return showPanel(player, 'editRankPanel', { ...context, rankId: selectedRank.id });
            } else {
                return showPanel(player, `rankActionMenu_${selectedRank.id}`, { ...context, rankId: selectedRank.id });
            }
        }

        // Handle pagination
        let currentButtonIndex = rankEndIndex + 1;
        if (page > 1) {
            // Previous Page
            if (selection === currentButtonIndex) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            currentButtonIndex++;
        }
        if (page < totalPages) {
            // Next Page
            if (selection === currentButtonIndex) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
        }
        return;
    }

    if (panelId === 'mobDropsSystemPanel') {
        const { page = 1 } = context;
        if (selection === 0) {
            // Back
            return showPanel(player, 'economyPanel', context);
        }
        if (selection === 1) {
            // Add New Mob
            return showPanel(player, 'addMobDropPanel', context);
        }

        const economyConfig = getEconomyConfig();
        const mobDrops = economyConfig.mobMoney || {};
        const mobIds = Object.keys(mobDrops).sort();
        const paginatedMobIds = getPaginatedItems(mobIds, page);
        const selectionIndex = selection - 2;

        if (selectionIndex < paginatedMobIds.length) {
            const selectedMobId = paginatedMobIds[selectionIndex];
            return showPanel(player, 'editMobDropPanel', { ...context, mobId: selectedMobId });
        }

        // Handle pagination
        let newPage = page;
        const hasPrev = page > 1;
        const buttonIndex = selectionIndex - paginatedMobIds.length;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId === 'addMobDropPanel') {
        if (canceled) {
            return showPanel(player, 'mobDropsSystemPanel', context);
        }
        const [mobId, amountStr] = (response as ModalFormResponse).formValues as string[];
        const amount = Number(amountStr);
        if (!mobId || isNaN(amount)) {
            player.sendMessage('§cInvalid mob ID or amount.');
            return showPanel(player, 'addMobDropPanel', context);
        }
        const economyConfig = getEconomyConfig();
        economyConfig.mobMoney[mobId] = amount;
        saveEconomyConfig(economyConfig);
        player.sendMessage(`§2Successfully added mob drop for ${mobId}.`);
        return showPanel(player, 'mobDropsSystemPanel', { ...context, page: 1 });
    }

    if (panelId === 'editMobDropPanel') {
        const { mobId } = context;
        if (selection === 0) {
            // Edit Amount
            const form = new ModalFormData()
                .title(`Edit ${mobId}`)
                .textField('Amount', 'Enter the new amount', {
                    defaultValue: String(getEconomyConfig().mobMoney[mobId])
                });
            const response = await utils.uiWait(player, form);
            if (response.canceled) {
                return showPanel(player, 'mobDropsSystemPanel', context);
            }
            const [amountStr] = response.formValues as string[];
            const amount = Number(amountStr);
            if (isNaN(amount)) {
                player.sendMessage('§cInvalid amount.');
                return showPanel(player, 'editMobDropPanel', context);
            }
            const economyConfig = getEconomyConfig();
            economyConfig.mobMoney[mobId] = amount;
            saveEconomyConfig(economyConfig);
            player.sendMessage(`§2Successfully updated mob drop for ${mobId}.`);
            return showPanel(player, 'mobDropsSystemPanel', { ...context, page: 1 });
        }
        if (selection === 1) {
            // Delete
            const economyConfig = getEconomyConfig();
            delete economyConfig.mobMoney[mobId];
            saveEconomyConfig(economyConfig);
            player.sendMessage(`§2Successfully deleted mob drop for ${mobId}.`);
            return showPanel(player, 'mobDropsSystemPanel', { ...context, page: 1 });
        }
        if (selection === 2) {
            // Back
            return showPanel(player, 'mobDropsSystemPanel', context);
        }
    }

    if (panelId === 'addRankPanel') {
        if (canceled) {
            return showPanel(player, 'rankManagementPanel', context);
        }

        const [name, id, permLevelStr, nameColor, chatColor, prefix] = formValues as string[];
        const permissionLevel = parseInt(permLevelStr, 10);

        if (!name || !id || isNaN(permissionLevel)) {
            player.sendMessage('§cRank Name, ID, and Permission Level are required.');
            return showPanel(player, panelId, context);
        }
        if (permissionLevel === 0) {
            player.sendMessage('§cPermission level 0 is reserved for the Owner rank.');
            return showPanel(player, panelId, context);
        }
        if (rankManager.getRankById(id)) {
            player.sendMessage(`§cRank ID '${id}' already exists.`);
            return showPanel(player, panelId, context);
        }

        const newRank: RankDefinition = {
            id,
            name,
            permissionLevel,
            chatFormatting: {
                prefixText: prefix,
                nameColor: nameColor,
                messageColor: chatColor
            },
            nametagPrefix: prefix, // Assuming prefix is used for nametag as well
            conditions: [{ type: 'hasTag', value: id }]
        };

        const result = rankDb.addRank(newRank);
        player.sendMessage(result.message);

        if (result.success) {
            rankManager.reloadRanks();
            return showPanel(player, 'rankManagementPanel', { ...context, page: 1 });
        } else {
            return showPanel(player, panelId, context);
        }
    }

    if (panelId === 'editRankPanel') {
        const rank = rankManager.getRankById(context.rankId);
        if (!rank) {
            player.sendMessage('§cRank not found.');
            return showPanel(player, 'rankManagementPanel', context);
        }
        const isSpecialRank = rank.conditions.some(
            (c: { type: string }) => c.type === 'isOwner' || c.type === 'default'
        );

        if (canceled) {
            const fromPanel = isSpecialRank ? 'rankManagementPanel' : `rankActionMenu_${rank.id}`;
            return showPanel(player, fromPanel, context);
        }

        const [name, id, permLevelStr, nameColor, chatColor, prefix, nametagPrefix] = formValues as string[];
        const permissionLevel = parseInt(permLevelStr, 10);

        if (!name) {
            player.sendMessage('§cRank Name cannot be empty.');
            return showPanel(player, panelId, context);
        }
        if (isSpecialRank && (id !== rank.id || permissionLevel !== rank.permissionLevel)) {
            player.sendMessage('§cCannot change the ID or Permission Level of a special rank.');
            return showPanel(player, panelId, context);
        }
        if (!isSpecialRank && permissionLevel === 0) {
            player.sendMessage('§cPermission level 0 is reserved for the Owner rank.');
            return showPanel(player, panelId, context);
        }

        const updatedData: Partial<RankDefinition> = {
            name,
            id,
            permissionLevel,
            chatFormatting: {
                prefixText: prefix,
                nameColor: nameColor,
                messageColor: chatColor
            },
            nametagPrefix: nametagPrefix
        };

        const result = rankDb.updateRank(rank.id, updatedData);
        player.sendMessage(result.message);

        if (result.success) {
            rankManager.reloadRanks();
            // After editing, the rank ID might have changed. We need to use the new ID.
            const newRankId = isSpecialRank ? rank.id : id;
            const fromPanel = isSpecialRank ? 'rankManagementPanel' : `rankActionMenu_${newRankId}`;
            const newContext = { ...context, rankId: newRankId, page: 1 };
            return showPanel(player, fromPanel, newContext);
        } else {
            return showPanel(player, panelId, context);
        }
    }

    if (panelId === 'configCategoryPanel') {
        const page = context.page || 1;
        if (selection === 0) {
            return showPanel(player, 'mainPanel');
        }

        const sortedSystems = getVisibleConfigSystems(pData);
        const paginatedSystems = getPaginatedItems(sortedSystems, page);
        const selectionIndex = selection - 1;

        if (selectionIndex < paginatedSystems.length) {
            const selectedSystem = paginatedSystems[selectionIndex];
            return showPanel(player, selectedSystem.id, {});
        }

        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(sortedSystems.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        const buttonIndex = selectionIndex - paginatedSystems.length;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId.startsWith('config_')) {
        const categoryId = panelId.replace('config_', '');
        const category = configPanelSchema.find((c) => c.id === categoryId);
        if (!category) {
            return;
        }

        const configSource = category.configSource || 'main';
        const handler = configHandlers[configSource];
        if (!handler) {
            errorLog(`[UIManager] No config handler found for source: ${configSource}`);
            return;
        }

        const { getValueFromPath } = await import('../objectUtils.js');

        const newValues = formValues as (string | number | boolean)[];
        let validationFailed = false;

        const processAndValidate = (setting: ConfigSetting, value: string | number | boolean) => {
            if (setting.type === 'toggle') {
                return !!value;
            }
            if (setting.type === 'dropdown') {
                // For the logLevel dropdown, the selected index is the value.
                if (setting.key === 'logLevel') {
                    return value;
                }
                return setting.options![value as number];
            }

            // If a textField is empty, fallback to the default value.
            if (setting.type === 'textField' && (value as string).trim() === '') {
                const defaultConfig = allDefaultConfigs[configSource];
                const defaultValue = getValueFromPath(defaultConfig, setting.key);
                return defaultValue ?? ''; // Fallback to empty string if default is not found
            }

            const isNumericField =
                setting.key.includes('Seconds') ||
                setting.key.includes('Balance') ||
                setting.key.includes('maxHomes') ||
                setting.key.includes('Interval') ||
                setting.key.includes('Radius') ||
                setting.key.endsWith('.x') ||
                setting.key.endsWith('.y') ||
                setting.key.endsWith('.z');

            if (setting.type === 'textField' && isNumericField) {
                // For coordinate fields, an empty string should be treated as null (not set).
                if (
                    (value as string).trim() === '' &&
                    (setting.key.endsWith('.x') || setting.key.endsWith('.y') || setting.key.endsWith('.z'))
                ) {
                    return null;
                }

                const numValue = Number(value);
                if (isNaN(numValue)) {
                    player.sendMessage(`§cInvalid number provided for ${setting.label}. Changes not saved.`);
                    validationFailed = true;
                    return value; // Return original invalid value to prevent further errors
                }
                return numValue;
            }
            return value;
        };

        if (configSource === 'main') {
            const updates: Record<string, unknown> = {};
            category.settings.forEach((setting, index) => {
                if (validationFailed) {
                    return;
                }
                const newValue = processAndValidate(setting, newValues[index]);
                if (!validationFailed) {
                    updates[setting.key] = newValue;
                }
            });
            if (validationFailed) {
                return showPanel(player, panelId);
            }
            handler.save(updates);
        } else {
            const configToSave = handler.get();
            category.settings.forEach((setting, index) => {
                if (validationFailed) {
                    return;
                }
                const newValue = processAndValidate(setting, newValues[index]);
                if (!validationFailed) {
                    setValueByPath(configToSave, setting.key, newValue);
                }
            });
            if (validationFailed) {
                return showPanel(player, panelId);
            }
            handler.save(configToSave);

            // If the spawn config was just updated, re-initialize spawn protection
            // to apply the new settings immediately.
            if (configSource === 'spawn') {
                initializeSpawnProtection();
                player.sendMessage('§aSpawn protection system has been updated based on new settings.');
            }
        }

        player.sendMessage(`§2Successfully saved settings for ${category.title}§2.`);

        // Post-save actions for specific config panels
        if (categoryId === 'dimensionLock') {
            const [netherLock, endLock] = newValues;
            setLockState('nether', !!netherLock);
            setLockState('end', !!endLock);
            player.sendMessage('§aLive dimension lock states have been updated to match config.');
        }
        if (categoryId === 'announcements') {
            restartAnnouncer();
            player.sendMessage('§2Announcement system has been updated with new settings.');
        }
        if (categoryId === 'xray') {
            // Sync alertPermissionLevel with command permission
            // category.settings is in order of configPanelSchema. We find the index of alertPermissionLevel.
            const permSettingIndex = category.settings.findIndex((s) => s.key === 'notifications.alertPermissionLevel');
            if (permSettingIndex !== -1) {
                const newPermLevel = Number(newValues[permSettingIndex]);
                if (!isNaN(newPermLevel)) {
                    updateMultipleConfig({
                        'commandSettings.xraynotify.permissionLevel': newPermLevel
                    });
                }
            }
        }

        // Dynamic redirect: Find which panel links to this config panel
        const parentPanelId =
            Object.keys(panelDefinitions).find(
                (pid) =>
                    panelDefinitions[pid].items &&
                    panelDefinitions[pid].items.some((item) => item.actionValue === panelId)
            ) || 'configCategoryPanel';

        // Ensure we return to the correct page if the parent supports pagination
        const { page } = context;
        return showPanel(player, parentPanelId, { ...context, page });
    }

    if (panelId === 'playerActionsPanel') {
        const visibleItems = getVisiblePlayerActionItems(context, pData.permissionLevel);
        const selectedItem = visibleItems[selection];
        if (!selectedItem) {
            return;
        }

        if (selectedItem.id === '__back__') {
            return showPanel(player, context.fromPanel || 'mainPanel', context);
        }

        if (selectedItem.actionType === 'openPanel') {
            return showPanel(player, selectedItem.actionValue, context);
        }

        const actionFunction = uiActionFunctions[selectedItem.actionValue];
        if (actionFunction) {
            const shouldReload = await actionFunction(player, context, panelId);
            if (shouldReload) {
                showPanel(player, panelId, context);
            }
        }
        return;
    }

    const panelDef = panelDefinitions[panelId];
    const menuItems = getMenuItems(panelDef, pData.permissionLevel);
    const selectedItem = menuItems[selection];
    if (!selectedItem) {
        return;
    }

    if (selectedItem.id === '__back__') {
        return showPanel(player, selectedItem.actionValue, context);
    }
    if (selectedItem.actionType === 'openPanel') {
        return showPanel(player, selectedItem.actionValue, context);
    }
    if (selectedItem.actionType === 'functionCall') {
        const actionFunction = uiActionFunctions[selectedItem.actionValue];
        if (actionFunction) {
            const shouldReload = await actionFunction(player, context, panelId);
            if (shouldReload) {
                showPanel(player, panelId, context);
            }
        }
    }
}
