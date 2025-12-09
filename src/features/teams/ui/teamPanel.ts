import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getTeamConfig } from '@core/configurations.js';
import { getOrCreatePlayer, loadPlayerData, PlayerData } from '@core/playerDataManager.js';
import { showPanel } from '@core/uiManager.js';
import { formatCurrency } from '@core/utils.js';
import { handleUIAction } from '@ui/actions.js';
import { showConfirmationDialog } from '@ui/components.js';
import { PanelItem, UIContext } from '@ui/panelRegistry.js';
import { IPanelHandler } from '@ui/types.js';
import { getPaginatedItems, itemsPerPage } from '@ui/uiUtils.js';
import * as teamManager from '../teamManager.js';

export class TeamPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId.startsWith('team') || panelId === 'memberActionPanel' || panelId === 'config_team';
    }

    async getItems(player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        // Satisfy async requirement if no other await exists
        await Promise.resolve();

        const pData: PlayerData = getOrCreatePlayer(player);
        const permissionLevel = pData.permissionLevel;
        const items: PanelItem[] = [];

        // Helper to add back button if not using getStaticMenuItems
        const addBack = (target: string) => {
            items.push({
                id: '__back__',
                text: '§l§8< Back',
                icon: 'textures/gui/controls/left.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: target
            });
        };

        // Helper for pagination
        const addPagination = (totalItems: number) => {
            const page = (context.page as number) || 1;
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            if (page > 1) {
                items.push({
                    id: '__prev__',
                    text: '§6< Previous Page',
                    icon: 'textures/ui/arrow_left.png',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'prevPage'
                });
            }
            if (page < totalPages) {
                items.push({
                    id: '__next__',
                    text: '§6Next Page >',
                    icon: 'textures/ui/arrow_right.png',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'nextPage'
                });
            }
        };

        if (panelId === 'teamMainPanel') {
            addBack('mainPanel');
            const team = teamManager.getTeamByPlayer(player.id);
            const teamConfig = getTeamConfig();

            if (team) {
                const isOwnerOrAdmin = team.ownerId === player.id || team.admins.includes(player.id);
                items.push({
                    id: 'teamMembersPanel',
                    text: '§l§3Team Members',
                    icon: 'textures/ui/icon_multiplayer',
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'teamMembersPanel'
                });
                if (isOwnerOrAdmin) {
                    items.push({
                        id: 'teamManagePanel',
                        text: '§l§4Manage Team',
                        icon: 'textures/ui/op',
                        permissionLevel: 1024,
                        actionType: 'openPanel',
                        actionValue: 'teamManagePanel'
                    });
                }
                items.push({
                    id: 'teamSettingsPanel',
                    text: '§l§6Team Settings',
                    icon: 'textures/ui/icon_setting',
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'teamSettingsPanel'
                });
                items.push({
                    id: 'leaveTeam',
                    text: '§4Leave Team',
                    icon: 'textures/ui/cancel',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'leaveTeam'
                });
            } else {
                items.push({
                    id: 'createTeam',
                    text: `§l§2Create Team\n§r§6Cost: ${formatCurrency(teamConfig.creationCost)}`,
                    icon: 'textures/ui/color_plus',
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'teamCreatePanel'
                });
                items.push({
                    id: 'joinTeam',
                    text: '§l§9Join Team',
                    icon: 'textures/ui/world_glyph_color',
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'teamBrowserPanel'
                });
            }
            return items;
        }

        if (panelId === 'teamBrowserPanel') {
            addBack('teamMainPanel');
            let teams = teamManager.getAllTeams();
            // Filter if needed (e.g. only open teams)
            if (permissionLevel >= 1024) {
                teams = teams.filter((t) => t.open !== false);
            }
            teams.sort((a, b) => b.members.length - a.members.length);
            const paginated = getPaginatedItems(teams, (context.page as number) || 1);

            paginated.forEach((team) => {
                const ownerData = loadPlayerData(team.ownerId);
                items.push({
                    id: String(team.id),
                    text: `${team.name} §8(ID: ${team.id})\n§rOwner: ${ownerData?.name ?? 'Unknown'} | Members: ${team.members.length}`,
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'applyToTeam'
                });
            });
            addPagination(teams.length);
            return items;
        }

        if (panelId === 'teamMembersPanel') {
            addBack('teamMainPanel');
            const team = teamManager.getTeamByPlayer(player.id);
            if (team) {
                for (const memberId of team.members) {
                    const memData = loadPlayerData(memberId);
                    const onlineP = mc.world.getAllPlayers().find((p) => p.id === memberId);
                    const status = onlineP ? '§2(Online)' : '§8(Offline)';
                    let role = 'Member';
                    if (team.ownerId === memberId) role = '§4Owner';
                    else if (team.admins.includes(memberId)) role = '§2Admin';

                    items.push({
                        id: memberId,
                        text: `${role} §r${memData?.name ?? 'Unknown'}\n${status}`,
                        icon: 'textures/ui/icon_steve',
                        permissionLevel: 1024,
                        actionType: 'openPanel',
                        actionValue: 'memberActionPanel'
                    });
                }
            }
            return items;
        }

        if (panelId === 'memberActionPanel') {
            addBack('teamMembersPanel');
            const memberId = context.selectedItemId;
            if (!memberId) return items;

            const team = teamManager.getTeamByPlayer(player.id);
            const targetTeam = teamManager.getTeamByPlayer(memberId as string);

            if (team && targetTeam && team.id === targetTeam.id) {
                const isOwner = team.ownerId === player.id;
                const isAdmin = team.admins.includes(player.id);
                const targetIsOwner = team.ownerId === memberId;
                const targetIsAdmin = team.admins.includes(memberId as string);

                if ((isOwner || isAdmin) && !targetIsOwner) {
                    items.push({
                        id: 'kick',
                        text: '§4Kick Member',
                        icon: 'textures/ui/cancel',
                        permissionLevel: 1024,
                        actionType: 'functionCall',
                        actionValue: 'kickTeamMember'
                    });
                }
                if (isOwner) {
                    if (targetIsAdmin) {
                        items.push({
                            id: 'demote',
                            text: 'Demote to Member',
                            icon: 'textures/ui/arrow_down_icon',
                            permissionLevel: 1024,
                            actionType: 'functionCall',
                            actionValue: 'demoteTeamMember'
                        });
                    } else {
                        items.push({
                            id: 'promote',
                            text: 'Promote to Admin',
                            icon: 'textures/ui/arrow_up_icon',
                            permissionLevel: 1024,
                            actionType: 'functionCall',
                            actionValue: 'promoteTeamMember'
                        });
                    }
                    items.push({
                        id: 'transfer',
                        text: 'Transfer Ownership',
                        icon: 'textures/ui/op',
                        permissionLevel: 1024,
                        actionType: 'functionCall',
                        actionValue: 'transferTeamOwnership'
                    });
                }
            }
            return items;
        }

        if (panelId === 'teamManagePanel') {
            addBack('teamMainPanel');
            const { teamId } = context;
            let team;
            if (teamId && permissionLevel < 1024) {
                team = teamManager.getTeam(Number(teamId));
            } else {
                team = teamManager.getTeamByPlayer(player.id);
            }

            if (team) {
                const isOwner = team.ownerId === player.id;
                const isAdmin = team.admins.includes(player.id);
                const isServerAdmin = permissionLevel < 1024;

                if (isOwner || isAdmin || isServerAdmin) {
                    items.push({
                        id: 'invitePlayer',
                        text: '§l§2Invite Player',
                        icon: 'textures/ui/color_plus',
                        permissionLevel: 1024,
                        actionType: 'openPanel',
                        actionValue: 'playerSearchPanel'
                    });
                    items.push({
                        id: 'joinRequests',
                        text: `§l§6Join Requests §r(${team.applications.length})`,
                        icon: 'textures/ui/mail_icon',
                        permissionLevel: 1024,
                        actionType: 'openPanel',
                        actionValue: 'teamRequestsPanel'
                    });
                    items.push({
                        id: 'manageMembers',
                        text: '§l§3Manage Members',
                        icon: 'textures/ui/icon_multiplayer',
                        permissionLevel: 1024,
                        actionType: 'openPanel',
                        actionValue: 'teamMembersPanel'
                    });
                }
                if (isOwner || isAdmin) {
                    items.push({
                        id: 'teamHome',
                        text: '§l§5Team Home',
                        icon: 'textures/ui/icon_recipe_nature',
                        permissionLevel: 1024,
                        actionType: 'openPanel',
                        actionValue: 'teamHomePanel'
                    });
                }
                if (isOwner || isServerAdmin) {
                    items.push({
                        id: 'deleteTeam',
                        text: '§l§4Delete Team',
                        icon: 'textures/ui/trash',
                        permissionLevel: 1024,
                        actionType: 'functionCall',
                        actionValue: 'deleteTeam'
                    });
                }
            }
            return items;
        }

        if (panelId === 'teamHomePanel') {
            addBack('teamManagePanel');
            const team = teamManager.getTeamByPlayer(player.id);
            if (team) {
                if (team.home) {
                    items.push({
                        id: 'teleportHome',
                        text: '§l§2Teleport',
                        icon: 'textures/items/ender_pearl',
                        permissionLevel: 1024,
                        actionType: 'functionCall',
                        actionValue: 'teleportHome'
                    });
                }
                const canManage = team.ownerId === player.id || team.admins.includes(player.id);
                if (canManage) {
                    items.push({
                        id: 'setHome',
                        text: '§l§6Update Location',
                        icon: 'textures/ui/icon_recipe_nature',
                        permissionLevel: 1024,
                        actionType: 'functionCall',
                        actionValue: 'setHome'
                    });
                    if (team.home) {
                        items.push({
                            id: 'deleteHome',
                            text: '§l§4Delete Home',
                            icon: 'textures/ui/trash',
                            permissionLevel: 1024,
                            actionType: 'functionCall',
                            actionValue: 'deleteHome'
                        });
                    }
                }
            }
            return items;
        }

        if (panelId === 'teamRequestsPanel') {
            addBack('teamManagePanel');
            const team = teamManager.getTeamByPlayer(player.id);
            if (team && team.applications.length > 0) {
                team.applications.forEach((app) => {
                    items.push({
                        id: app.playerId,
                        text: app.playerName,
                        permissionLevel: 1024,
                        actionType: 'functionCall',
                        actionValue: 'manageRequest'
                    });
                });
            }
            return items;
        }

        if (panelId === 'teamInvitesPanel') {
            addBack('teamMainPanel');
            const invites = pData.pendingInvites || [];
            if (invites.length > 0) {
                invites.forEach((invite) => {
                    const date = new Date(invite.timestamp).toLocaleDateString();
                    items.push({
                        id: String(invite.teamId),
                        text: `${invite.teamName}\n§8Received: ${date}`,
                        permissionLevel: 1024,
                        actionType: 'functionCall',
                        actionValue: 'manageInvite'
                    });
                });
                items.push({
                    id: 'denyAll',
                    text: '§4Deny All Invites',
                    icon: 'textures/ui/cancel',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'denyAllInvites'
                });
            }
            return items;
        }

        return items;
    }

    async buildModal(player: mc.Player, panelId: string, _context: UIContext): Promise<ModalFormData | null> {
        // Satisfy async requirement
        await Promise.resolve();

        if (panelId === 'teamCreatePanel') {
            const teamConfig = getTeamConfig();
            return new ModalFormData()
                .title('Create Team')
                .textField('Team Name', `Enter name (${teamConfig.nameMinLength}-${teamConfig.nameMaxLength} chars)`);
        }

        if (panelId === 'teamSearchPanel') {
            return new ModalFormData().title('Search Team').textField('Team ID', 'Enter ID');
        }

        if (panelId === 'teamSettingsPanel') {
            const pData = getOrCreatePlayer(player);
            const team = teamManager.getTeamByPlayer(player.id);
            if (!team) return null;
            const canManage = team.ownerId === player.id || team.admins.includes(player.id);
            const form = new ModalFormData().title('Team Settings');
            form.toggle('Auto-Accept Team Teleport', { defaultValue: pData.teamSettings?.autoTpAccept ?? false });
            if (canManage) form.toggle('Allow Join Requests', { defaultValue: team.open ?? true });
            return form;
        }

        // Config Panel for Teams (Admin)
        if (panelId === 'config_team') {
            const config = getTeamConfig();
            return new ModalFormData()
                .title('Team Configuration')
                .toggle('Enabled', { defaultValue: config.enabled })
                .textField('Max Members', '10', { defaultValue: String(config.maxMembers) })
                .textField('Creation Cost', '500', { defaultValue: String(config.creationCost) })
                .textField('Min Name Length', '3', { defaultValue: String(config.nameMinLength) })
                .textField('Max Name Length', '16', { defaultValue: String(config.nameMaxLength) });
        }

        return null;
    }

    async handleResponse(
        player: mc.Player,
        panelId: string,
        response: ActionFormResponse | ModalFormResponse,
        context: UIContext
    ): Promise<void> {
        const selection = (response as ActionFormResponse).selection;
        const values = (response as ModalFormResponse).formValues;

        if (panelId === 'teamCreatePanel') {
            if ((response as ModalFormResponse).canceled) {
                return showPanel(player, 'teamMainPanel');
            }
            const [teamName] = values || [];
            if (typeof teamName === 'string' && teamName.trim().length > 0) {
                const result = teamManager.createTeam(player, teamName.trim());
                player.sendMessage(result.message ?? '');
            } else {
                player.sendMessage('§4Invalid team name.');
            }
            return showPanel(player, 'teamMainPanel');
        }

        if (panelId === 'teamSearchPanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'teamJoinPanel');
            const [searchId] = values || [];
            if (searchId) {
                const team = teamManager.getTeam(Number(searchId));
                if (team) {
                    player.sendMessage(`§aFound team: ${team.name}`);
                    // Trigger apply directly or show info?
                    // Showing apply dialog via function call
                    const result = teamManager.applyToTeam(player, team.id);
                    player.sendMessage(result.message ?? '');
                } else {
                    player.sendMessage('§cTeam not found.');
                }
            }
            return showPanel(player, 'teamJoinPanel');
        }

        if (panelId === 'teamSettingsPanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'teamMainPanel');
            if (!values) return;

            const team = teamManager.getTeamByPlayer(player.id);
            const autoTp = values[0] as boolean;
            const { updatePlayerData } = await import('@core/playerDataManager.js');
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

        if (panelId === 'config_team') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'configCategoryPanel', context);
            if (!values) return;

            const config = getTeamConfig();
            const newConfig = { ...config };

            newConfig.enabled = values[0] as boolean;
            newConfig.maxMembers = Number(values[1]);
            newConfig.creationCost = Number(values[2]);
            newConfig.nameMinLength = Number(values[3]);
            newConfig.nameMaxLength = Number(values[4]);

            const { saveTeamConfig } = await import('@core/configurations.js');
            saveTeamConfig(newConfig);
            player.sendMessage('§aTeam configuration saved.');
            return showPanel(player, 'configCategoryPanel', context);
        }

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];

                // --- Generic Handlers ---
                if (item.actionType === 'openPanel') {
                    return showPanel(player, item.actionValue, {
                        ...context,
                        page: 1,
                        selectedItemId: item.id,
                        id: item.id
                    });
                }

                if (item.actionValue === 'prevPage') {
                    return showPanel(player, panelId, {
                        ...context,
                        page: Math.max(1, ((context.page as number) || 1) - 1)
                    });
                }
                if (item.actionValue === 'nextPage') {
                    return showPanel(player, panelId, { ...context, page: ((context.page as number) || 1) + 1 });
                }

                // --- Custom Handlers ---

                if (item.actionValue === 'leaveTeam') {
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
                    return; // Handled
                }

                if (item.actionValue === 'applyToTeam') {
                    const teamId = Number(item.id);
                    const result = teamManager.applyToTeam(player, teamId);
                    player.sendMessage(result.message ?? '');
                    return showPanel(player, panelId, context);
                }

                if (item.actionValue === 'deleteTeam') {
                    const { teamId } = context;
                    let team;
                    if (teamId) team = teamManager.getTeam(Number(teamId));
                    else team = teamManager.getTeamByPlayer(player.id);

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

                // --- Generic Function Call Fallback ---
                if (item.actionType === 'functionCall') {
                    await handleUIAction(player, item.actionValue, {
                        ...context,
                        selectedItemId: item.id,
                        id: item.id
                    });
                    return;
                }
            }
        }
    }
}
