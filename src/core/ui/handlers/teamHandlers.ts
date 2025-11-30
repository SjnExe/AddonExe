import * as mc from '@minecraft/server';
import { ActionFormResponse, ActionFormData, ModalFormResponse } from '@minecraft/server-ui';

import { PlayerData, getPlayer } from '../../playerDataManager.js';
import { showPanel } from '../../uiManager.js';
import * as utils from '../../utils.js';
import { showConfirmationDialog } from '../components.js';
import { UIContext } from '../panelRegistry.js';
import { itemsPerPage, getPaginatedItems } from '../uiUtils.js';

export async function handleTeamPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const selection = (response as ActionFormResponse).selection;
    const canceled = response.canceled;
    const formValues = (response as ModalFormResponse).formValues;
    const pData = getPlayer(player.id);

    if (panelId === 'teamMainPanel') {
        const { getTeamByPlayer } = await import('../../teamManager.js');

        const team = getTeamByPlayer(player.id);

        if (selection === 0) {
            return showPanel(player, 'mainPanel', context);
        }

        if (team) {
            const isOwner = team.ownerId === player.id;

            const isAdmin = team.admins.includes(player.id);
            const isOwnerOrAdmin = isOwner || isAdmin;

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
                        '§4Owners cannot leave their team. You must transfer ownership or delete the team.'
                    );
                } else {
                    showConfirmationDialog(player, {
                        title: 'Leave Team',
                        body: 'Are you sure you want to leave the team?',
                        confirmButtonText: '§4Yes, Leave',
                        cancelButtonText: 'No',
                        onConfirm: async () => {
                            const { kickMember } = await import('../../teamManager.js');
                            // Kick self
                            kickMember(team.id, player.id);
                            player.sendMessage('§2You have left the team.');
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
        const values = (response as ModalFormResponse).formValues;
        if (!values) return;

        const [name] = values as string[];
        if (!name) {
            player.sendMessage('§4Team name is required.');
            return showPanel(player, panelId, context);
        }

        const { createTeam } = await import('../../teamManager.js');
        const result = createTeam(player, name);
        player.sendMessage(result.message || '§4Unknown error.');
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
        const values = (response as ModalFormResponse).formValues;
        if (!values) return;

        const [idStr] = values as string[];
        const teamId = parseInt(idStr);
        if (isNaN(teamId)) {
            player.sendMessage('§4Invalid Team ID.');
            return showPanel(player, panelId, context);
        }

        // Confirm Application
        const { getTeam, applyToTeam } = await import('../../teamManager.js');
        const team = getTeam(teamId);
        if (!team) {
            player.sendMessage('§4Team not found.');
            return showPanel(player, panelId, context);
        }

        showConfirmationDialog(player, {
            title: `Apply to ${team.name}?`,
            body: `Do you want to send a join request to ${team.name}?`,
            confirmButtonText: '§2Apply',
            cancelButtonText: 'Cancel',
            onConfirm: () => {
                const result = applyToTeam(player, teamId);
                player.sendMessage(result.message || '§4Unknown error.');
                showPanel(player, 'teamJoinPanel', context);
            },
            onCancel: () => showPanel(player, 'teamJoinPanel', context)
        });
        return;
    }

    if (panelId === 'teamInvitesPanel') {
        const invites = (pData as PlayerData).pendingInvites || [];

        if (selection === 0) {
            return showPanel(player, 'teamJoinPanel', context);
        } // Back

        if (invites.length === 0) {
            return;
        } // Body text only

        const denyAllIndex = invites.length + 1;

        if (selection === denyAllIndex) {
            const { updatePlayerData } = await import('../../playerDataManager.js');
            updatePlayerData(player.id, (d: PlayerData) => (d.pendingInvites = []));
            player.sendMessage('§2Cleared all pending invites.');
            return showPanel(player, panelId, context);
        }

        if (typeof selection !== 'number') return;
        const inviteIndex = selection - 1;
        if (inviteIndex >= 0 && inviteIndex < invites.length) {
            const invite = invites[inviteIndex];
            // Options: Accept, Deny
            const { acceptInvite, denyInvite } = await import('../../teamManager.js');

            const form = new ActionFormData()
                .title(`Invite: ${invite.teamName}`)
                .button('§2Accept Invite', 'textures/ui/check')
                .button('§4Deny Invite', 'textures/ui/cancel');

            const res = await utils.uiWait(player, form);
            if (!res.canceled) {
                const resSelection = (res as ActionFormResponse).selection;
                if (resSelection === 0) {
                    // Accept
                    const result = acceptInvite(player, invite.teamId);
                    player.sendMessage(result.message || '§4Unknown error.');
                    if (result.success) {
                        return showPanel(player, 'teamMainPanel', context);
                    }
                } else {
                    // Deny
                    const result = denyInvite(player.id, invite.teamId);
                    player.sendMessage(result.message || '§4Unknown error.');
                }
            }
            return showPanel(player, panelId, context);
        }
        return;
    }

    if (panelId === 'teamBrowserPanel') {
        const { getAllTeams } = await import('../../teamManager.js');
        const page = context.page || 1;
        const teams = getAllTeams().sort((a, b) => b.members.length - a.members.length);
        const paginatedTeams = getPaginatedItems(teams, page);

        if (selection === 0) {
            return showPanel(player, 'teamJoinPanel', context);
        }

        if (typeof selection !== 'number') return;
        const selectionIndex = selection - 1;

        if (selectionIndex < paginatedTeams.length) {
            // Apply to selected team
            const team = paginatedTeams[selectionIndex];
            const { applyToTeam } = await import('../../teamManager.js');

            showConfirmationDialog(player, {
                title: `Apply to ${team.name}?`,
                body: `Do you want to send a join request to ${team.name}?`,
                confirmButtonText: '§2Apply',
                cancelButtonText: 'Cancel',
                onConfirm: () => {
                    const result = applyToTeam(player, team.id);
                    player.sendMessage(result.message || '§4Unknown error.');
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
        const { getTeamByPlayer, deleteTeam } = await import('../../teamManager.js');
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
                body: '§4WARNING: This will disband the team and cannot be undone.',
                confirmButtonText: '§4DELETE',
                cancelButtonText: 'Cancel',
                onConfirm: () => {
                    deleteTeam(team.id);
                    player.sendMessage('§2Team deleted.');
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

        const { getTeamByPlayer, setTeamHome, deleteTeamHome } = await import('../../teamManager.js');
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
                    player.sendMessage('§2Teleported to team home.');
                } else {
                    player.sendMessage('§4Invalid dimension for team home.');
                }
                return;
            }
            btnIndex++;
        }

        if (canManage) {
            if (selection === btnIndex) {
                // Update Location
                setTeamHome(team.id, player.location, player.dimension.id);
                player.sendMessage('§2Team home updated to your current location.');
                return showPanel(player, panelId, context);
            }
            btnIndex++;

            if (team.home) {
                if (selection === btnIndex) {
                    // Delete Home
                    deleteTeamHome(team.id);
                    player.sendMessage('§2Team home deleted.');
                    return showPanel(player, panelId, context);
                }
            }
        }
        return;
    }

    if (panelId === 'teamRequestsPanel') {
        const { getTeamByPlayer, acceptApplication, denyApplication } = await import('../../teamManager.js');
        const team = getTeamByPlayer(player.id);
        if (!team) {
            return;
        }

        if (selection === 0) {
            return showPanel(player, 'teamManagePanel', context);
        }

        const appIndex = selection && selection > 0 ? selection - 1 : -1;
        if (appIndex >= 0 && appIndex < team.applications.length) {
            const app = team.applications[appIndex];

            const form = new ActionFormData()
                .title(`App: ${app.playerName}`)
                .button('§2Accept', 'textures/ui/check')
                .button('§4Deny', 'textures/ui/cancel');

            const res = await utils.uiWait(player, form);
            if (!res.canceled) {
                const resSelection = (res as ActionFormResponse).selection;
                if (resSelection === 0) {
                    // Accept
                    const result = acceptApplication(team.id, app.playerId);
                    player.sendMessage(result.message || '§4Unknown error.');
                } else {
                    // Deny
                    const result = denyApplication(team.id, app.playerId);
                    player.sendMessage(result.message || '§4Unknown error.');
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

        const { getTeamByPlayer, setTeamOpenStatus } = await import('../../teamManager.js');
        const { updatePlayerData } = await import('../../playerDataManager.js');

        const team = getTeamByPlayer(player.id);
        if (!team) {
            return showPanel(player, 'teamMainPanel', context);
        }

        const isOwner = team.ownerId === player.id;

        const isAdmin = team.admins.includes(player.id);
        const canManage = isOwner || isAdmin;

        const autoTp = (response as ModalFormResponse).formValues?.[0];

        updatePlayerData(player.id, (d: PlayerData) => {
            if (!d.teamSettings) {
                d.teamSettings = { autoTpAccept: false };
            }
            d.teamSettings.autoTpAccept = autoTp as boolean;
        });

        if (canManage && formValues && formValues.length > 1) {
            const allowRequests = formValues[1];
            setTeamOpenStatus(team.id, allowRequests as boolean);
        }

        player.sendMessage('§2Settings updated.');
        return showPanel(player, 'teamMainPanel', context);
    }

    if (panelId === 'teamMembersPanel') {
        if (selection === 0) {
            return showPanel(player, 'teamMainPanel', context);
        }

        const { getTeamByPlayer, kickMember, promoteMember, demoteMember, transferOwnership } =
            await import('../../teamManager.js');
        const team = getTeamByPlayer(player.id);
        if (!team) {
            return;
        }

        if (typeof selection !== 'number') return;
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
                    player.sendMessage('§4You cannot modify this member.');
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

                const resSelection = (res as ActionFormResponse).selection;

                if (resSelection === 0) {
                    // Kick
                    const result = kickMember(team.id, memberId);
                    player.sendMessage(result.message || '§4Unknown error.');
                } else if (resSelection === 1) {
                    // Promote/Demote
                    if (isOwner) {
                        if (targetIsAdmin) {
                            const result = demoteMember(team.id, memberId);
                            player.sendMessage(result.message || '§4Unknown error.');
                        } else {
                            const result = promoteMember(team.id, memberId);
                            player.sendMessage(result.message || '§4Unknown error.');
                        }
                    }
                } else if (resSelection === 2) {
                    // Transfer
                    showConfirmationDialog(player, {
                        title: 'Transfer Ownership?',
                        body: 'You will become a regular member.',
                        confirmButtonText: '§4Confirm',
                        cancelButtonText: 'Cancel',
                        onConfirm: () => {
                            const result = transferOwnership(team.id, memberId);
                            player.sendMessage(result.message || '§4Unknown error.');
                            showPanel(player, panelId, context);
                        },
                        onCancel: () => showPanel(player, panelId, context)
                    });
                    return;
                }
                return showPanel(player, panelId, context);
            }
        }
        return showPanel(player, panelId, context);
    }
}
