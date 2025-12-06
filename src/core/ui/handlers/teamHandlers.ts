/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import * as teamManager from '../../../features/teams/teamManager.js';
import { getTeamConfig } from '../../configurations.js';
import { loadPlayerData } from '../../playerDataManager.js';
import { showPanel } from '../../uiManager.js';
import { showConfirmationDialog } from '../components.js';
import { UIContext } from '../panelRegistry.js';
import { getPaginatedItems, itemsPerPage } from '../uiUtils.js';

export async function handleTeamPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const selection = (response as ActionFormResponse).selection;

    if (panelId === 'teamMainPanel') {
        const { getTeamByPlayer } = await import('../../../features/teams/teamManager.js');
        const team = getTeamByPlayer(player.id);

        if (selection === 0) {
            return showPanel(player, 'mainPanel');
        }

        if (team) {
            // Member/Owner view
            switch (selection) {
                case 1:
                    return showPanel(player, 'teamMembersPanel');
                case 2:
                    return showPanel(player, 'teamManagePanel');
                case 3:
                    return showPanel(player, 'teamSettingsPanel');
                case 4:
                    // Leave Team
                    await showConfirmationDialog(player, {
                        title: 'Leave Team',
                        body: 'Are you sure you want to leave your team?',
                        confirmButtonText: '§4Leave',
                        cancelButtonText: 'Cancel',
                        onConfirm: () => {
                            const result = teamManager.leaveTeam(player);
                            player.sendMessage(result.message ?? "");
                            return showPanel(player, 'teamMainPanel');
                        },
                        onCancel: () => showPanel(player, 'teamMainPanel')
                    });
                    return;
            }
        } else {
            // Non-member view
            if (selection === 1) {
                return showPanel(player, 'teamCreatePanel');
            }
            if (selection === 2) {
                return showPanel(player, 'teamBrowserPanel');
            }
        }
        return;
    }

    if (panelId === 'teamCreatePanel') {
        if ((response as ModalFormResponse).canceled) {
            return showPanel(player, 'teamMainPanel');
        }
        const [teamName] = (response as ModalFormResponse).formValues || [];
        if (typeof teamName === 'string' && teamName.trim().length > 0) {
            const result = teamManager.createTeam(player, teamName.trim());
            player.sendMessage(result.message ?? "");
        } else {
            player.sendMessage('§4Invalid team name.');
        }
        return showPanel(player, 'teamMainPanel');
    }

    if (panelId === 'teamBrowserPanel') {
        const page = context.page || 1;
        const { getAllTeams } = await import('../../../features/teams/teamManager.js');
        // Re-filter teams logic here ideally, or assume list hasn't changed drastically
        let teams = getAllTeams();
        // Assuming simplistic check for now
        teams = teams.sort((a, b) => b.members.length - a.members.length);

        if (selection === 0) {
            return showPanel(player, 'teamMainPanel');
        }

        const paginatedTeams = getPaginatedItems(teams, page);
        const selectionIndex = typeof selection === 'number' ? selection - 1 : -1;

        // Handle pagination
        if (selectionIndex >= paginatedTeams.length) {
            let newPage = page;
            const totalPages = Math.ceil(teams.length / itemsPerPage);
            const hasPrev = page > 1;
            const hasNext = page < totalPages;
            const buttonIndex = selectionIndex - paginatedTeams.length;

            if (hasPrev && buttonIndex === 0) {
                newPage--;
            } else if (hasNext) {
                newPage++;
            }
            return showPanel(player, panelId, { ...context, page: newPage });
        }

        const selectedTeam = selectionIndex >= 0 ? paginatedTeams[selectionIndex] : undefined;
        if (selectedTeam) {
            // Join Request
            const result = teamManager.applyToTeam(player, selectedTeam.id);
            player.sendMessage(result.message ?? "");
            return showPanel(player, panelId, context);
        }
        return;
    }

    if (panelId === 'teamMembersPanel') {
        if (selection === 0) return showPanel(player, 'teamMainPanel');
        // Currently no action on member list click
        return showPanel(player, 'teamMainPanel');
    }

    if (panelId === 'teamManagePanel') {
        const { getTeamByPlayer, getTeam } = await import('../../../features/teams/teamManager.js');
        const { teamId } = context;
        // Logic to determine if managing own team or as admin
        // Simplified for brevity, assume own team if teamId not present or logic handled in builder
        let team = getTeamByPlayer(player.id);
        if (teamId) {
            // Admin managing other team
            team = getTeam(Number(teamId)) ?? null;
        }

        if (!team) return showPanel(player, 'teamMainPanel');

        const isOwner = team.ownerId === player.id;
        const isAdmin = team.admins.includes(player.id);
        // Assuming admin permissions checked in builder to render buttons

        if (selection === 0) {
            return showPanel(player, 'teamMainPanel');
        }

        // Actions depend on buttons rendered.
        // Standard order: Invite, Join Requests, Manage Members, Team Home, Delete
        // This is fragile if button order changes.
        // A better approach is to use ID-based actions if ActionFormData allowed it easily,
        // or strictly sync this with builder.

        // Re-deriving visible buttons logic:
        const canInvite = isOwner || isAdmin;
        const canHome = isOwner || isAdmin;
        const canDelete = isOwner; // Or server admin

        let actionIndex = 1;
        if (canInvite) {
            if (selection === actionIndex) return showPanel(player, 'playerSearchPanel', { context: 'teamInvite' });
            actionIndex++;
            if (selection === actionIndex) return showPanel(player, 'teamRequestsPanel', { teamId: team.id });
            actionIndex++;
            if (selection === actionIndex) return showPanel(player, 'teamMembersPanel'); // TODO: Add manage members subpanel
            actionIndex++;
        }
        if (canHome) {
            if (selection === actionIndex) return showPanel(player, 'teamHomePanel', { teamId: team.id });
            actionIndex++;
        }
        if (canDelete) {
            if (selection === actionIndex) {
                await showConfirmationDialog(player, {
                    title: 'Delete Team',
                    body: `Are you sure you want to delete ${team.name}?`,
                    confirmButtonText: '§4Delete',
                    cancelButtonText: 'Cancel',
                    onConfirm: () => {
                        const success = teamManager.deleteTeam(team.id); // Force unwrap as we checked
                        if (success) {
                            player.sendMessage('§aTeam deleted.');
                        } else {
                            player.sendMessage('§cFailed to delete team.');
                        }
                        return showPanel(player, 'teamMainPanel');
                    },
                    onCancel: () => showPanel(player, 'teamManagePanel', context)
                });
                return;
            }
        }
        return;
    }

    if (panelId === 'teamSettingsPanel') {
        if ((response as ModalFormResponse).canceled) return showPanel(player, 'teamMainPanel');
        const values = (response as ModalFormResponse).formValues;
        if (!values) return;

        const { getTeamByPlayer } = await import('../../../features/teams/teamManager.js');
        const team = getTeamByPlayer(player.id);

        const autoTp = values[0] as boolean;
        // Update player settings
        const { updatePlayerData } = await import('../../playerDataManager.js');
        updatePlayerData(player.id, (data) => {
            if (data.teamSettings) {
                data.teamSettings.autoTpAccept = autoTp;
            } else {
                data.teamSettings = { autoTpAccept: autoTp };
            }
        });

        if (team && (team.ownerId === player.id || team.admins.includes(player.id)) && values.length > 1) {
            const isOpen = values[1] as boolean;
            teamManager.updateTeamSetting(team.id, 'open', isOpen);
            player.sendMessage(`§aTeam settings updated.`);
        }
        return showPanel(player, 'teamMainPanel');
    }

    if (panelId === 'teamHomePanel') {
        const { getTeamByPlayer } = await import('../../../features/teams/teamManager.js');
        const team = getTeamByPlayer(player.id);
        if (!team) return showPanel(player, 'teamMainPanel');

        if (selection === 0) return showPanel(player, 'teamManagePanel');

        // Buttons: Teleport, Update, Delete (if exists)
        const hasHome = !!team.home;
        let index = 1;

        if (hasHome) {
            if (selection === index) {
                // Teleport
                teamManager.teleportToTeamHome(player);
                return;
            }
            index++;
        }

        // Manage perms
        const canManage = team.ownerId === player.id || team.admins.includes(player.id);
        if (canManage) {
            if (selection === index) {
                // Update
                const result = teamManager.setTeamHome(team.id, player.location, player.dimension.id);
                player.sendMessage(result.message ?? "");
                return showPanel(player, 'teamHomePanel');
            }
            index++;
            if (hasHome && selection === index) {
                // Delete
                const result = teamManager.deleteTeamHome(team.id);
                player.sendMessage(result.message ?? "");
                return showPanel(player, 'teamHomePanel');
            }
        }
    }

    if (panelId === 'teamRequestsPanel') {
        if (selection === 0) return showPanel(player, 'teamManagePanel');
        const { getTeamByPlayer } = await import('../../../features/teams/teamManager.js');
        const team = getTeamByPlayer(player.id);
        if (!team) return;

        // selection-1 is index in requests array
        if (typeof selection !== 'number') return;
        const request = team.applications[selection - 1];
        if (request) {
            await showConfirmationDialog(player, {
                title: 'Join Request',
                body: `Accept ${request.playerName} into the team?`,
                confirmButtonText: '§2Accept',
                cancelButtonText: '§4Deny',
                onConfirm: () => {
                    const res = teamManager.acceptApplication(team.id, request.playerId);
                    if (res.message) player.sendMessage(res.message ?? "");
                    return showPanel(player, 'teamRequestsPanel');
                },
                onCancel: () => {
                    const res = teamManager.denyApplication(team.id, request.playerId);
                    if (res.message) player.sendMessage(res.message ?? "");
                    return showPanel(player, 'teamRequestsPanel');
                }
            });
        }
    }

    if (panelId === 'teamInvitesPanel') {
        if (selection === 0) return showPanel(player, 'teamMainPanel');
        const pData = loadPlayerData(player.id);
        if (!pData || !pData.pendingInvites) return;

        const invites = pData.pendingInvites;
        if (invites.length === 0) return;

        if (selection === undefined) return;

        // If "Deny All" button is present (it is if invites > 0)
        // It's the last button.
        if (selection === invites.length + 1) {
            // Deny all logic? or just clear
            // Implement rejectAllInvites in teamManager or loop
            // For now, let's handle individual
            return;
        }

        const invite = invites[selection - 1];
        if (invite) {
            await showConfirmationDialog(player, {
                title: 'Team Invite',
                body: `Join team ${invite.teamName}?`,
                confirmButtonText: '§2Accept',
                cancelButtonText: '§4Decline',
                onConfirm: () => {
                    const res = teamManager.acceptInvite(player, invite.teamId);
                    player.sendMessage(res.message ?? "");
                    return showPanel(player, 'teamMainPanel');
                },
                onCancel: () => {
                    const res = teamManager.denyInvite(player.id, invite.teamId);
                    player.sendMessage(res.message ?? "");
                    return showPanel(player, 'teamInvitesPanel');
                }
            });
        }
    }

    // Config Panel for Teams (Admin)
    if (panelId === 'config_team') {
        if ((response as ModalFormResponse).canceled) return showPanel(player, 'configCategoryPanel', context);
        const values = (response as ModalFormResponse).formValues;
        if (!values) return;

        const config = getTeamConfig();
        const newConfig = { ...config };

        // Order must match panelBuilder config_team settings
        newConfig.enabled = values[0] as boolean;
        newConfig.maxMembers = Number(values[1]);
        newConfig.creationCost = Number(values[2]);
        newConfig.nameMinLength = Number(values[3]);
        newConfig.nameMaxLength = Number(values[4]);

        const { saveTeamConfig } = await import('../../configurations.js');
        saveTeamConfig(newConfig);
        player.sendMessage('§aTeam configuration saved.');
        return showPanel(player, 'configCategoryPanel', context);
    }
}
