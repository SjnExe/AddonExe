import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getPlayerFromCache } from '@core/playerCache.js';
import { getPlayer } from '@core/playerDataManager.js';
import { getStaticMenuItems } from '@core/ui/panelBuilder.js';
import { panelDefinitions } from '@core/ui/panelRegistry.js';
import { IPanelHandler, PanelItem, UIContext } from '@core/ui/types.js';
import { showPanel } from '@core/uiManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as teamManager from '../teamManager.js';

export class TeamPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId.startsWith('team');
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async getItems(player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[] | undefined> {
        const team = teamManager.getTeamByPlayer(player.id);

        // Base items (Back button)
        const def = panelDefinitions[panelId];
        const baseItems = isDefined(def) ? getStaticMenuItems(def, 1024) : [];

        if (panelId === 'teamMainPanel') {
            return this.getTeamMainPanelItems(player, team, baseItems);
        }

        if (panelId === 'teamMembersPanel') {
            return this.getTeamMembersPanelItems(team, baseItems);
        }

        if (panelId === 'teamMemberActionPanel') {
            return this.getTeamMemberActionPanelItems(player, team, context, baseItems);
        }

        if (panelId === 'teamManagePanel') {
            if (!isDefined(team)) return baseItems;
            return [
                ...baseItems,
                {
                    id: 'teamSettingsBtn',
                    text: 'Settings',
                    icon: 'textures/ui/settings_glyph_color_2x',
                    actionType: 'openPanel',
                    actionValue: 'teamSettingsPanel',
                    permissionLevel: 1024
                },
                {
                    id: 'teamRequestsBtn',
                    text: `Join Requests (${team.applications.length})`,
                    icon: 'textures/ui/user_icon',
                    actionType: 'openPanel',
                    actionValue: 'teamRequestsPanel',
                    permissionLevel: 1024
                },
                {
                    id: 'teamHomeManageBtn',
                    text: 'Manage Home',
                    icon: 'textures/ui/portal',
                    actionType: 'openPanel',
                    actionValue: 'teamHomePanel',
                    permissionLevel: 1024
                }
            ];
        }

        if (panelId === 'teamRequestsPanel') {
            if (!isDefined(team)) return baseItems;
            const reqItems = team.applications.map((app) => {
                const item: PanelItem = {
                    id: `req_${app.playerId}`,
                    text: `${app.playerName}\n§7${new Date(app.timestamp).toLocaleDateString()}`,
                    icon: 'textures/ui/steve_head',
                    actionType: 'openPanel',
                    actionValue: 'teamRequestActionPanel',
                    permissionLevel: 1024
                };
                return item;
            });
            return [...baseItems, ...reqItems];
        }

        if (panelId === 'teamRequestActionPanel') {
            const accept: PanelItem = {
                id: 'accept',
                text: 'Accept',
                icon: 'textures/ui/check',
                actionType: 'functionCall',
                actionValue: 'acceptTeamRequest',
                permissionLevel: 1024
            };
            const deny: PanelItem = {
                id: 'deny',
                text: 'Deny',
                icon: 'textures/ui/cancel',
                actionType: 'functionCall',
                actionValue: 'denyTeamRequest',
                permissionLevel: 1024
            };
            return [...baseItems, accept, deny];
        }

        if (panelId === 'teamHomePanel') {
            if (!isDefined(team)) return baseItems;
            const setHome: PanelItem = {
                id: 'setHome',
                text: 'Set Home (Here)',
                icon: 'textures/ui/op',
                actionType: 'functionCall',
                actionValue: 'setTeamHome',
                permissionLevel: 1024
            };
            const delHome: PanelItem = {
                id: 'delHome',
                text: 'Delete Home',
                icon: 'textures/ui/trash',
                actionType: 'functionCall',
                actionValue: 'deleteTeamHome',
                permissionLevel: 1024
            };
            const tpHome: PanelItem = {
                id: 'tpHome',
                text: 'Teleport Home',
                icon: 'textures/ui/portal',
                actionType: 'functionCall',
                actionValue: 'teamTpHome',
                permissionLevel: 1024
            };
            return [...baseItems, setHome, delHome, tpHome];
        }

        if (panelId === 'teamInvitesPanel') {
            const pData = getPlayer(player.id);
            if (!isDefined(pData) || !isDefined(pData.pendingInvites)) return baseItems;

            const inviteItems = pData.pendingInvites.map((inv) => {
                const item: PanelItem = {
                    id: `inv_${inv.teamId}`,
                    text: inv.teamName,
                    icon: 'textures/ui/mail_icon',
                    actionType: 'openPanel',
                    actionValue: 'teamInviteActionPanel',
                    permissionLevel: 1024
                };
                return item;
            });
            return [...baseItems, ...inviteItems];
        }

        if (panelId === 'teamInviteActionPanel') {
            const accept: PanelItem = {
                id: 'accept',
                text: 'Accept',
                icon: 'textures/ui/check',
                actionType: 'functionCall',
                actionValue: 'acceptTeamInvite',
                permissionLevel: 1024
            };
            const deny: PanelItem = {
                id: 'deny',
                text: 'Deny',
                icon: 'textures/ui/cancel',
                actionType: 'functionCall',
                actionValue: 'denyTeamInvite',
                permissionLevel: 1024
            };
            return [...baseItems, accept, deny];
        }

        if (panelId === 'teamBrowserPanel') {
            const allTeams = teamManager.getAllTeams().filter((t) => t.open);
            const browserItems = allTeams.slice(0, 50).map((t) => {
                const item: PanelItem = {
                    id: `team_${t.id}`,
                    text: `${t.name}\n§7Members: ${t.members.length}`,
                    icon: 'textures/ui/world_glyph_color',
                    actionType: 'functionCall',
                    actionValue: 'applyToTeam',
                    permissionLevel: 1024
                };
                return item;
            });
            return [...baseItems, ...browserItems];
        }

        return undefined;
    }

    private getTeamMainPanelItems(
        player: mc.Player,
        team: teamManager.TeamData | undefined,
        baseItems: PanelItem[]
    ): PanelItem[] {
        if (!isDefined(team)) {
            return [
                ...baseItems,
                {
                    id: 'teamCreateBtn',
                    text: 'Create Team',
                    icon: 'textures/ui/color_plus',
                    actionType: 'openPanel',
                    actionValue: 'teamCreatePanel',
                    permissionLevel: 1024
                },
                {
                    id: 'teamJoinBtn',
                    text: 'Join Team',
                    icon: 'textures/ui/magnifyingGlass',
                    actionType: 'openPanel',
                    actionValue: 'teamJoinPanel',
                    permissionLevel: 1024
                }
            ];
        }

        const isOwner = team.ownerId === player.id;
        const isAdmin = isOwner || team.admins.includes(player.id);

        const items: PanelItem[] = [
            ...baseItems,
            {
                id: 'teamMembersBtn',
                text: 'Members',
                icon: 'textures/ui/multiplayer',
                actionType: 'openPanel',
                actionValue: 'teamMembersPanel',
                permissionLevel: 1024
            },
            {
                id: 'teamInfoBtn',
                text: `§e${team.name}§r\n§7Balance: $${team.balance}`,
                icon: 'textures/ui/infobulb',
                actionType: 'functionCall',
                actionValue: 'noop',
                permissionLevel: 1024
            },
            {
                id: 'teamDepositBtn',
                text: 'Deposit',
                icon: 'textures/ui/gold_ingot',
                actionType: 'functionCall',
                actionValue: 'teamDeposit',
                permissionLevel: 1024
            }
        ];

        if (isDefined(team.home)) {
            items.push({
                id: 'teamTpHomeBtn',
                text: 'Teleport Home',
                icon: 'textures/ui/portal',
                actionType: 'functionCall',
                actionValue: 'teamTpHome',
                permissionLevel: 1024
            });
        }

        if (isAdmin) {
            items.push({
                id: 'teamManageBtn',
                text: 'Manage Team',
                icon: 'textures/ui/gear',
                actionType: 'openPanel',
                actionValue: 'teamManagePanel',
                permissionLevel: 1024
            });
        }

        items.push({
            id: 'teamLeaveBtn',
            text: 'Leave Team',
            icon: 'textures/ui/door',
            actionType: 'functionCall',
            actionValue: 'teamLeave',
            permissionLevel: 1024
        });

        return items;
    }

    private getTeamMembersPanelItems(team: teamManager.TeamData | undefined, baseItems: PanelItem[]): PanelItem[] {
        if (!isDefined(team)) return baseItems;

        const memberItems = team.members.map((memberId) => {
            const pData = getPlayer(memberId);
            const onlineP = getPlayerFromCache(memberId);
            const status = isDefined(onlineP) ? '§aOnline' : '§cOffline';
            let role = '§7Member';
            if (team.ownerId === memberId) {
                role = '§6Owner';
            } else if (team.admins.includes(memberId)) {
                role = '§eAdmin';
            }

            const item: PanelItem = {
                id: `member_${memberId}`,
                text: `${pData ? pData.name : 'Unknown'}\n${role} - ${status}`,
                icon: 'textures/ui/steve_head',
                actionType: 'openPanel',
                actionValue: 'teamMemberActionPanel',
                permissionLevel: 1024
            };
            return item;
        });
        return [...baseItems, ...memberItems];
    }

    private getTeamMemberActionPanelItems(
        player: mc.Player,
        team: teamManager.TeamData | undefined,
        context: UIContext,
        baseItems: PanelItem[]
    ): PanelItem[] {
        const targetId = context.targetPlayerId;
        if (!isNonEmptyString(targetId) || !isDefined(team)) return baseItems;

        const isMeOwner = team.ownerId === player.id;
        const isMeAdmin = isMeOwner || team.admins.includes(player.id);

        const isTargetOwner = team.ownerId === targetId;
        const isTargetAdmin = team.admins.includes(targetId);

        const items: PanelItem[] = [...baseItems];

        if (isMeAdmin && !isTargetOwner && targetId !== player.id) {
            items.push({
                id: 'kickMember',
                text: 'Kick Member',
                icon: 'textures/ui/cancel',
                actionType: 'functionCall',
                actionValue: 'kickTeamMember',
                permissionLevel: 1024
            });
        }

        if (isMeOwner && targetId !== player.id) {
            if (isTargetAdmin) {
                items.push({
                    id: 'demoteMember',
                    text: 'Demote Admin',
                    icon: 'textures/ui/down_arrow',
                    actionType: 'functionCall',
                    actionValue: 'demoteTeamMember',
                    permissionLevel: 1024
                });
            } else {
                items.push({
                    id: 'promoteMember',
                    text: 'Promote to Admin',
                    icon: 'textures/ui/up_arrow',
                    actionType: 'functionCall',
                    actionValue: 'promoteTeamMember',
                    permissionLevel: 1024
                });
            }
            items.push({
                id: 'transferOwnership',
                text: 'Transfer Ownership',
                icon: 'textures/ui/crown',
                actionType: 'functionCall',
                actionValue: 'transferTeamOwnership',
                permissionLevel: 1024
            });
        }

        return items;
    }

    async handleResponse(
        player: mc.Player,
        panelId: string,
        response: ActionFormResponse,
        context: UIContext
    ): Promise<void> {
        if (response.canceled || response.selection === undefined) return;

        let items = await this.getItems(player, panelId, context);
        if (!isDefined(items)) {
            const def = panelDefinitions[panelId];
            if (isDefined(def)) {
                items = getStaticMenuItems(def, 1024);
            } else {
                return;
            }
        }

        const selectedItem = items[response.selection];
        if (!isDefined(selectedItem)) return;

        if (selectedItem.id === '__back__') {
            // Handled automatically via openPanel usually
        }

        if (selectedItem.actionType === 'openPanel') {
            const newContext = { ...context };
            if (panelId === 'teamMembersPanel' && selectedItem.id.startsWith('member_')) {
                newContext.targetPlayerId = selectedItem.id.replace('member_', '');
                newContext.selectedItemId = newContext.targetPlayerId;
            }
            if (panelId === 'teamRequestsPanel' && selectedItem.id.startsWith('req_')) {
                newContext.targetPlayerId = selectedItem.id.replace('req_', '');
                newContext.selectedItemId = newContext.targetPlayerId;
            }
            if (panelId === 'teamInvitesPanel' && selectedItem.id.startsWith('inv_')) {
                newContext.selectedItemId = selectedItem.id.replace('inv_', '');
            }

            return showPanel(player, selectedItem.actionValue, newContext);
        } else {
            await this.handleTeamAction(player, selectedItem.actionValue, context, selectedItem.id);
        }
    }

    private async handleTeamAction(
        player: mc.Player,
        actionValue: string,
        context: UIContext,
        selectedItemId?: string
    ): Promise<void> {
        if (actionValue === 'noop') return;

        switch (actionValue) {
            case 'teamLeave': {
                const res = teamManager.leaveTeam(player);
                let msg = 'Failed';
                if (res.message !== undefined) {
                    msg = res.message;
                } else if (res.success) {
                    msg = 'Success';
                }
                player.sendMessage(msg);
                return showPanel(player, 'teamMainPanel', context);
            }
            case 'teamTpHome': {
                teamManager.teleportToTeamHome(player);
                return;
            }
            case 'setTeamHome': {
                const team = teamManager.getTeamByPlayer(player.id);
                if (team) {
                    const res = teamManager.setTeamHome(team.id, player.location, player.dimension.id);
                    let msg = 'Done';
                    if (res.message !== undefined) msg = res.message;
                    player.sendMessage(msg);
                }
                return showPanel(player, 'teamHomePanel', context);
            }
            case 'deleteTeamHome': {
                const team = teamManager.getTeamByPlayer(player.id);
                if (team) {
                    const res = teamManager.deleteTeamHome(team.id);
                    let msg = 'Done';
                    if (res.message !== undefined) msg = res.message;
                    player.sendMessage(msg);
                }
                return showPanel(player, 'teamHomePanel', context);
            }
            case 'acceptTeamRequest': {
                const team = teamManager.getTeamByPlayer(player.id);
                if (team && isNonEmptyString(context.targetPlayerId)) {
                    const res = teamManager.acceptApplication(team.id, context.targetPlayerId);
                    let msg = 'Done';
                    if (res.message !== undefined) msg = res.message;
                    player.sendMessage(msg);
                }
                return showPanel(player, 'teamRequestsPanel', context);
            }
            case 'denyTeamRequest': {
                const team = teamManager.getTeamByPlayer(player.id);
                if (team && isNonEmptyString(context.targetPlayerId)) {
                    const res = teamManager.denyApplication(team.id, context.targetPlayerId);
                    let msg = 'Done';
                    if (res.message !== undefined) msg = res.message;
                    player.sendMessage(msg);
                }
                return showPanel(player, 'teamRequestsPanel', context);
            }
            case 'acceptTeamInvite': {
                const targetId = isNonEmptyString(selectedItemId) ? selectedItemId : context.selectedItemId;
                if (isNonEmptyString(targetId) && targetId.startsWith('inv_')) {
                    const teamId = Number.parseInt(targetId.replace('inv_', ''));
                    const res = teamManager.acceptInvite(player, teamId);
                    let msg = 'Done';
                    if (res.message !== undefined) msg = res.message;
                    player.sendMessage(msg);
                }
                return showPanel(player, 'teamMainPanel', context);
            }
            case 'denyTeamInvite': {
                const targetId = isNonEmptyString(selectedItemId) ? selectedItemId : context.selectedItemId;
                if (isNonEmptyString(targetId) && targetId.startsWith('inv_')) {
                    const teamId = Number.parseInt(targetId.replace('inv_', ''));
                    const res = teamManager.denyInvite(player.id, teamId);
                    let msg = 'Done';
                    if (res.message !== undefined) msg = res.message;
                    player.sendMessage(msg);
                }
                return showPanel(player, 'teamInvitesPanel', context);
            }
            case 'applyToTeam': {
                const targetId = isNonEmptyString(selectedItemId) ? selectedItemId : context.selectedItemId;
                if (isNonEmptyString(targetId) && targetId.startsWith('team_')) {
                    const teamId = Number.parseInt(targetId.replace('team_', ''));
                    const res = teamManager.applyToTeam(player, teamId);
                    let msg = 'Done';
                    if (res.message !== undefined) msg = res.message;
                    player.sendMessage(msg);
                }
                return showPanel(player, 'teamBrowserPanel', context);
            }
            case 'teamDeposit': {
                return this.handleDeposit(player, context);
            }
            default: {
                player.sendMessage(`§cAction ${actionValue} not mapped.`);
                return;
            }
        }
    }

    async buildModal(
        player: mc.Player,
        panelId: string,
        context: UIContext
    ): Promise<ActionFormData | ModalFormData | undefined | void> {
        if (panelId === 'teamCreatePanel') {
            const form = new ModalFormData().title('Create Team').textField('Team Name', 'Enter team name');

            const res = await showModal(player, form);
            if (res.canceled) {
                await showPanel(player, 'teamMainPanel', context);
                return;
            }

            const [name] = res.formValues as [string];
            if (!isNonEmptyString(name)) {
                player.sendMessage('§cName required.');
                await showPanel(player, 'teamCreatePanel', context);
                return;
            }

            const result = teamManager.createTeam(player, name);
            player.sendMessage(result.message ?? 'Done');
            await (result.success
                ? showPanel(player, 'teamMainPanel', context)
                : showPanel(player, 'teamCreatePanel', context));
            return;
        }

        if (panelId === 'teamSettingsPanel') {
            const team = teamManager.getTeamByPlayer(player.id);
            if (!team) return undefined;

            const form = new ModalFormData()
                .title('Team Settings')
                .toggle('Open to Requests', { defaultValue: !!team.open });

            const res = await showModal(player, form);
            if (res.canceled) {
                await showPanel(player, 'teamManagePanel', context);
                return;
            }

            const [isOpen] = res.formValues as [boolean];
            teamManager.setTeamOpenStatus(team.id, isOpen);
            await showPanel(player, 'teamManagePanel', context);
            return;
        }

        if (panelId === 'teamSearchPanel') {
            const form = new ModalFormData().title('Search Team').textField('Team Name (exact)', 'Name');

            const res = await showModal(player, form);
            if (res.canceled) {
                await showPanel(player, 'teamJoinPanel', context);
                return;
            }

            // Search logic ignored for now
            player.sendMessage('Search not implemented yet, showing browser.');
            await showPanel(player, 'teamBrowserPanel', context);
            return;
        }

        return undefined;
    }

    async handleDeposit(player: mc.Player, context: UIContext) {
        const team = teamManager.getTeamByPlayer(player.id);
        if (!team) return;

        const form = new ModalFormData().title('Deposit Money').textField('Amount', '1000');

        const res = await showModal(player, form);
        if (res.canceled) {
            await showPanel(player, 'teamMainPanel', context);
            return;
        }

        const [amountStr] = res.formValues as [string];
        const amount = Number.parseFloat(amountStr);
        // Implement deposit logic here or in manager
        player.sendMessage(`Deposit logic for ${amount} pending implementation.`);
        await showPanel(player, 'teamMainPanel', context);
    }
}

async function showModal(player: mc.Player, form: ModalFormData): Promise<ModalFormResponse> {
    const { uiWait } = await import('@core/utils.js');
    const res = await uiWait(player, form);
    return res as ModalFormResponse;
}
