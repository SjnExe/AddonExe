/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import * as teamManager from '../../../features/teams/teamManager.js';
import { getTeamConfig } from '../../configurations.js';
import { loadPlayerData } from '../../playerDataManager.js';
import { showPanel } from '../../uiManager.js';
import { showConfirmationDialog } from '../components.js';
import { getPanelItems } from '../panelBuilder.js';
import { UIContext } from '../panelRegistry.js';

export async function handleTeamPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const selection = (response as ActionFormResponse).selection;

    // Use HEADLESS BUILDER pattern for Action Forms
    if (typeof selection === 'number') {
        const items = await getPanelItems(player, panelId, context);
        if (selection >= 0 && selection < items.length) {
            const selectedItem = items[selection];

            // Basic Navigation
            if (selectedItem.actionType === 'openPanel') {
                return showPanel(player, selectedItem.actionValue, { ...context, page: 1 });
            }

            // Standard Back Button
            if (selectedItem.id === '__back__') {
                return showPanel(player, selectedItem.actionValue, { ...context, page: 1 });
            }

            // Pagination
            if (selectedItem.id === '__prev__') {
                const newPage = (context.page || 1) - 1;
                return showPanel(player, panelId, { ...context, page: newPage });
            }
            if (selectedItem.id === '__next__') {
                const newPage = (context.page || 1) + 1;
                return showPanel(player, panelId, { ...context, page: newPage });
            }

            // --- Team Function Calls ---

            if (selectedItem.actionValue === 'leaveTeam') {
                await showConfirmationDialog(player, {
                    title: 'Leave Team',
                    body: 'Are you sure you want to leave your team?',
                    confirmButtonText: '§4Leave',
                    cancelButtonText: 'Cancel',
                    onConfirm: () => {
                        const result = teamManager.leaveTeam(player);
                        player.sendMessage(result.message ?? '');
                        return showPanel(player, 'teamMainPanel');
                    },
                    onCancel: () => showPanel(player, 'teamMainPanel')
                });
                return;
            }

            if (selectedItem.actionValue === 'applyToTeam') {
                const teamId = Number(selectedItem.id);
                const result = teamManager.applyToTeam(player, teamId);
                player.sendMessage(result.message ?? '');
                return showPanel(player, panelId, context);
            }

            if (selectedItem.actionValue === 'deleteTeam') {
                const { getTeamByPlayer, getTeam } = await import('../../../features/teams/teamManager.js');
                const { teamId } = context;
                let team;
                if (teamId) team = getTeam(Number(teamId));
                else team = getTeamByPlayer(player.id);

                if (team) {
                    await showConfirmationDialog(player, {
                        title: 'Delete Team',
                        body: `Are you sure you want to delete ${team.name}?`,
                        confirmButtonText: '§4Delete',
                        cancelButtonText: 'Cancel',
                        onConfirm: () => {
                            const success = teamManager.deleteTeam(team.id);
                            if (success) {
                                player.sendMessage('§aTeam deleted.');
                            } else {
                                player.sendMessage('§cFailed to delete team.');
                            }
                            return showPanel(player, 'teamMainPanel');
                        },
                        onCancel: () => showPanel(player, 'teamManagePanel', context)
                    });
                }
                return;
            }

            if (selectedItem.actionValue === 'teleportHome') {
                teamManager.teleportToTeamHome(player);
                return;
            }

            if (selectedItem.actionValue === 'setHome') {
                const { getTeamByPlayer, getTeam } = await import('../../../features/teams/teamManager.js');
                const { teamId } = context;
                let team;
                if (teamId) team = getTeam(Number(teamId));
                else team = getTeamByPlayer(player.id);

                if (team) {
                    const result = teamManager.setTeamHome(team.id, player.location, player.dimension.id);
                    player.sendMessage(result.message ?? '');
                    return showPanel(player, 'teamHomePanel', context);
                }
                return;
            }

            if (selectedItem.actionValue === 'deleteHome') {
                const { getTeamByPlayer, getTeam } = await import('../../../features/teams/teamManager.js');
                const { teamId } = context;
                let team;
                if (teamId) team = getTeam(Number(teamId));
                else team = getTeamByPlayer(player.id);

                if (team) {
                    const result = teamManager.deleteTeamHome(team.id);
                    player.sendMessage(result.message ?? '');
                    return showPanel(player, 'teamHomePanel', context);
                }
                return;
            }

            if (selectedItem.actionValue === 'manageRequest') {
                const playerId = selectedItem.id;
                const { getTeamByPlayer, getTeam } = await import('../../../features/teams/teamManager.js');
                const { teamId } = context;
                let team;
                if (teamId) team = getTeam(Number(teamId));
                else team = getTeamByPlayer(player.id);

                if (team) {
                    const request = team.applications.find(a => a.playerId === playerId);
                    if (request) {
                        await showConfirmationDialog(player, {
                            title: 'Join Request',
                            body: `Accept ${request.playerName} into the team?`,
                            confirmButtonText: '§2Accept',
                            cancelButtonText: '§4Deny',
                            onConfirm: () => {
                                // @ts-expect-error - team.id guaranteed
                                const res = teamManager.acceptApplication(team.id, request.playerId);
                                if (res.message) player.sendMessage(res.message ?? '');
                                return showPanel(player, 'teamRequestsPanel', context);
                            },
                            onCancel: () => {
                                // @ts-expect-error - team.id guaranteed
                                const res = teamManager.denyApplication(team.id, request.playerId);
                                if (res.message) player.sendMessage(res.message ?? '');
                                return showPanel(player, 'teamRequestsPanel', context);
                            }
                        });
                    }
                }
                return;
            }

            if (selectedItem.actionValue === 'manageInvite') {
                // selectedItem.id is teamId
                const teamId = Number(selectedItem.id);
                const pData = loadPlayerData(player.id);
                const invite = pData?.pendingInvites?.find(i => i.teamId === teamId);

                if (invite) {
                    await showConfirmationDialog(player, {
                        title: 'Team Invite',
                        body: `Join team ${invite.teamName}?`,
                        confirmButtonText: '§2Accept',
                        cancelButtonText: '§4Decline',
                        onConfirm: () => {
                            const res = teamManager.acceptInvite(player, invite.teamId);
                            player.sendMessage(res.message ?? '');
                            return showPanel(player, 'teamMainPanel');
                        },
                        onCancel: () => {
                            const res = teamManager.denyInvite(player.id, invite.teamId);
                            player.sendMessage(res.message ?? '');
                            return showPanel(player, 'teamInvitesPanel');
                        }
                    });
                }
                return;
            }

            if (selectedItem.actionValue === 'denyAllInvites') {
                const pData = loadPlayerData(player.id);
                if (pData && pData.pendingInvites) {
                    for (const inv of [...pData.pendingInvites]) {
                        teamManager.denyInvite(player.id, inv.teamId);
                    }
                    player.sendMessage('§aAll invites denied.');
                }
                return showPanel(player, 'teamInvitesPanel');
            }
        }
    }

    // Modal Forms
    if (panelId === 'teamCreatePanel') {
        if ((response as ModalFormResponse).canceled) {
            return showPanel(player, 'teamMainPanel');
        }
        const [teamName] = (response as ModalFormResponse).formValues || [];
        if (typeof teamName === 'string' && teamName.trim().length > 0) {
            const result = teamManager.createTeam(player, teamName.trim());
            player.sendMessage(result.message ?? '');
        } else {
            player.sendMessage('§4Invalid team name.');
        }
        return showPanel(player, 'teamMainPanel');
    }

    if (panelId === 'teamSettingsPanel') {
        if ((response as ModalFormResponse).canceled) return showPanel(player, 'teamMainPanel');
        const values = (response as ModalFormResponse).formValues;
        if (!values) return;

        const { getTeamByPlayer } = await import('../../../features/teams/teamManager.js');
        const team = getTeamByPlayer(player.id);

        const autoTp = values[0] as boolean;
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

    // Config Panel for Teams (Admin)
    if (panelId === 'config_team') {
        if ((response as ModalFormResponse).canceled) return showPanel(player, 'configCategoryPanel', context);
        const values = (response as ModalFormResponse).formValues;
        if (!values) return;

        const config = getTeamConfig();
        const newConfig = { ...config };

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
