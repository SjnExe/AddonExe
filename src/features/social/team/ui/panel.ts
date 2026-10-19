import { getConfig } from '@core/config/configManager.js';
import { getTeamConfig } from '@core/config/configurations.js';
import { getAllPlayersFromCache, getPlayerFromCache } from '@core/data/playerCache.js';
import { getOrCreatePlayer, getPlayerIdByName, getPlayerNameById, loadPlayerData } from '@core/data/playerDataManager.js';
import { getPlayerRank } from '@core/permissions/rankManager.js';
import { formatCurrency } from '@core/utils/index.js';
import { getPlayerIcon } from '@core/utils/ui.js';
import * as teamManager from '@features/social/team/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';

export async function showTeamMainPanel(player: mc.Player): Promise<void> {
    const team = teamManager.getTeamByPlayer(player.id);
    const pData = getOrCreatePlayer(player);
    const teamCfg = getTeamConfig();
    const form = new ActionFormBuilder().title(team ? team.name : 'Teams');

    if (team) {
        const isStaff = teamManager.isTeamAdminOrOwner(team, player.id);
        const isOwner = team.ownerId === player.id;
        const autoTp = pData.teamSettings?.autoTpAccept ?? false;
        const roleLabel = isOwner ? '§6Owner' : isStaff ? '§bAdmin' : '§7Member';

        form.body(
            [
                `§7Role: ${roleLabel} §8| §7Members: §f${team.members.length}/${teamCfg.maxMembers}`,
                `§7Team Bank: §a${formatCurrency(team.balance)} §8| §7Status: ${team.open ? '§aOpen' : '§cInvite Only'}`
            ].join('\n')
        );

        form.button(`Members (${team.members.length}/${teamCfg.maxMembers})`, 'textures/ui/multiplayer_glyph_color', async () => {
            await showTeamMembersPanel(player, 1);
        });

        if (team.home) {
            form.button('Teleport to Team Home', 'textures/ui/portalBg', () => {
                teamManager.teleportToTeamHome(player);
            });
        }

        form.button('Deposit Money', 'textures/items/gold_ingot', async () => {
            await showTeamDepositPanel(player);
        });

        if (isOwner && team.balance > 0) {
            form.button('Withdraw Money', 'textures/items/emerald', async () => {
                await showTeamWithdrawPanel(player);
            });
        }

        if (isStaff) {
            form.button('Manage Team', 'textures/ui/settings_glyph_color_2x', async () => {
                await showTeamManagePanel(player);
            });
        }

        form.button(autoTp ? '§2Auto-Accept Team TPA: ON' : '§7Auto-Accept Team TPA: OFF', autoTp ? 'textures/ui/realms_green_check' : 'textures/ui/cancel', async () => {
            const next = teamManager.toggleTeamAutoTpAccept(player);
            player.sendMessage(`§aTeam Auto-TPA Accept is now ${next ? '§2ENABLED' : '§cDISABLED'}§a.`);
            await showTeamMainPanel(player);
        });

        if (!isOwner) {
            form.button('§cLeave Team', 'textures/ui/cancel', async () => {
                const res = teamManager.leaveTeam(player);
                player.sendMessage(res.message ?? (res.success ? '§aLeft team.' : '§cFailed'));
                await showTeamMainPanel(player);
            });
        }
    } else {
        const invites = pData.pendingInvites ?? [];
        form.body(`§7Creation Cost: §6${formatCurrency(teamCfg.creationCost)} §8| §7Pending Invites: §e${invites.length}`);

        form.button('Create Team', 'textures/ui/color_plus', async () => {
            await showTeamCreatePanel(player);
        });

        form.button('Join Team', 'textures/ui/magnifyingGlass', async () => {
            await showTeamJoinPanel(player);
        });

        if (invites.length > 0) {
            form.button(`Invites (${invites.length})`, 'textures/ui/invite_base', async () => {
                await showTeamInvitesPanel(player, 1);
            });
        }
    }

    form.addBackButton(async () => {
        const { showSocialHub } = await import('@core/ui/panels/mainPanel.js');
        await showSocialHub(player);
    });

    await form.show(player);
}

export async function showTeamMembersPanel(player: mc.Player, page: number = 1): Promise<void> {
    const team = teamManager.getTeamByPlayer(player.id);
    if (!team) {
        await showTeamMainPanel(player);
        return;
    }

    const form = new ActionFormBuilder().title('Team Members');
    const canManage = teamManager.isTeamAdminOrOwner(team, player.id);

    form.addPaginatedButtons(
        team.members,
        page,
        (memberId, formBuilder) => {
            const isOnline = getPlayerFromCache(memberId) !== undefined;
            const status = isOnline ? '§aOnline' : '§cOffline';
            const role = team.ownerId === memberId ? '§6Owner' : team.admins.includes(memberId) ? '§bAdmin' : '§7Member';
            const displayName = getPlayerNameById(memberId) ?? loadPlayerData(memberId)?.name ?? memberId;

            formBuilder.button(`${displayName}\n${status} §r- ${role}`, 'textures/ui/permissions_member_star', async () => {
                if (canManage && memberId !== player.id && memberId !== team.ownerId) {
                    await showTeamMemberActionPanel(player, memberId, displayName);
                } else {
                    await showTeamMembersPanel(player, page);
                }
            });
        },
        async (newPage) => {
            await showTeamMembersPanel(player, newPage);
        }
    );

    form.addBackButton(async () => {
        await showTeamMainPanel(player);
    });

    await form.show(player);
}

export async function showTeamMemberActionPanel(player: mc.Player, targetId: string, targetName: string): Promise<void> {
    const team = teamManager.getTeamByPlayer(player.id);
    if (!team || !teamManager.isTeamAdminOrOwner(team, player.id)) {
        await showTeamMembersPanel(player, 1);
        return;
    }

    const isOwner = team.ownerId === player.id;
    const isTargetAdmin = team.admins.includes(targetId);

    const form = new ActionFormBuilder().title(`Manage ${targetName}`);

    if (isOwner) {
        if (isTargetAdmin) {
            form.button('Demote to Member', 'textures/ui/minus', async () => {
                const res = teamManager.demoteMember(team.id, targetId);
                player.sendMessage(res.message ?? '§aDemoted member.');
                await showTeamMembersPanel(player, 1);
            });
        } else {
            form.button('Promote to Team Admin', 'textures/ui/color_plus', async () => {
                const res = teamManager.promoteMember(team.id, targetId);
                player.sendMessage(res.message ?? '§aPromoted member.');
                await showTeamMembersPanel(player, 1);
            });
        }

        form.button('Transfer Ownership', 'textures/ui/op', async () => {
            await showConfirmationDialog(player, {
                title: 'Transfer Team Ownership',
                body: `Are you sure you want to transfer ownership of ${team.name}§r to ${targetName}?`,
                onConfirm: async () => {
                    const res = teamManager.transferOwnership(team.id, targetId);
                    player.sendMessage(res.message ?? '§aOwnership transferred.');
                    await showTeamMainPanel(player);
                },
                onCancel: async () => {
                    await showTeamMemberActionPanel(player, targetId, targetName);
                }
            });
        });
    }

    if (isOwner || !isTargetAdmin) {
        form.button('§cKick Member', 'textures/ui/cancel', async () => {
            const res = teamManager.kickMember(team.id, targetId);
            player.sendMessage(res.message ?? '§aMember kicked.');
            await showTeamMembersPanel(player, 1);
        });
    }

    form.addBackButton(async () => {
        await showTeamMembersPanel(player, 1);
    });

    await form.show(player);
}

export async function showTeamManagePanel(player: mc.Player): Promise<void> {
    const team = teamManager.getTeamByPlayer(player.id);
    if (!team || !teamManager.isTeamAdminOrOwner(team, player.id)) {
        await showTeamMainPanel(player);
        return;
    }

    const isOwner = team.ownerId === player.id;

    const form = new ActionFormBuilder()
        .title('Manage Team')
        .button('Invite Player', 'textures/ui/color_plus', async () => {
            await showTeamInvitePlayerModal(player);
        })
        .button(`Join Requests (${team.applications.length})`, 'textures/ui/user_icon', async () => {
            await showTeamRequestsPanel(player, 1);
        })
        .button('Manage Team Home', 'textures/ui/portalBg', async () => {
            await showTeamHomePanel(player);
        })
        .button('Team Settings', 'textures/ui/settings_glyph_color_2x', async () => {
            await showTeamSettingPanel(player);
        });

    if (isOwner) {
        form.button('§4Disband Team', 'textures/ui/trash', async () => {
            await showConfirmationDialog(player, {
                title: 'Disband Team',
                body: `Are you sure you want to permanently delete team '${team.name}§r'?`,
                confirmButtonText: '§4Disband',
                onConfirm: async () => {
                    teamManager.deleteTeam(team.id);
                    player.sendMessage('§aTeam disbanded.');
                    await showTeamMainPanel(player);
                },
                onCancel: async () => {
                    await showTeamManagePanel(player);
                }
            });
        });
    }

    form.addBackButton(async () => {
        await showTeamMainPanel(player);
    });

    await form.show(player);
}

export async function showTeamInvitePlayerModal(player: mc.Player): Promise<void> {
    const team = teamManager.getTeamByPlayer(player.id);
    if (!team || !teamManager.isTeamAdminOrOwner(team, player.id)) {
        await showTeamMainPanel(player);
        return;
    }

    const onlineCandidates = getAllPlayersFromCache()
        .filter((p) => !team.members.includes(p.id))
        .map((p) => p.name);

    onlineCandidates.unshift('-- Type Name Below --');

    const modal = new CustomFormBuilder<{ dropdownName: string; manualName: string }>('Invite Player to Team')
        .dropdown('dropdownName', 'Select Online Player', onlineCandidates, 0)
        .textField('manualName', 'Or Type Player Name', 'Player Name', '')
        .submitButton('Send Invite');

    const res = await modal.show(player);
    if (res) {
        const chosen = isNonEmptyString(res.manualName.trim()) ? res.manualName.trim() : res.dropdownName !== '-- Type Name Below --' ? res.dropdownName : '';
        if (isNonEmptyString(chosen)) {
            const targetId = getPlayerIdByName(chosen);
            if (!isNonEmptyString(targetId)) {
                player.sendMessage('§cPlayer not found.');
            } else {
                const inviteRes = teamManager.invitePlayer(team.id, targetId);
                player.sendMessage(inviteRes.message ?? (inviteRes.success ? '§aInvite sent.' : '§cFailed to invite.'));
            }
        }
    }

    await showTeamManagePanel(player);
}

export async function showTeamSettingPanel(player: mc.Player): Promise<void> {
    const team = teamManager.getTeamByPlayer(player.id);
    if (!team || !teamManager.isTeamAdminOrOwner(team, player.id)) {
        return;
    }

    const modal = new CustomFormBuilder<{ open: boolean }>('Team Settings').toggle('open', 'Open to Join Applications', !!team.open).submitButton('Save Settings');

    const res = await modal.show(player);
    if (res) {
        const updateRes = teamManager.setTeamOpenStatus(team.id, res.open);
        if (updateRes.message) {
            player.sendMessage(updateRes.message);
        }
    }
    await showTeamManagePanel(player);
}

export async function showTeamRequestsPanel(player: mc.Player, page: number = 1): Promise<void> {
    const team = teamManager.getTeamByPlayer(player.id);
    if (!team || !teamManager.isTeamAdminOrOwner(team, player.id)) {
        await showTeamManagePanel(player);
        return;
    }

    const form = new ActionFormBuilder().title('Join Requests');

    if (team.applications.length === 0) {
        form.body('No pending join applications.');
    }

    form.addPaginatedButtons(
        team.applications,
        page,
        (app, formBuilder) => {
            const onlineP = getPlayerFromCache(app.playerId);
            let rankText = '';
            let icon = 'textures/ui/permissions_member_star';
            if (onlineP) {
                const targetRank = getPlayerRank(onlineP, getConfig());
                rankText = targetRank.chatFormatting?.prefixText ? `§r[${targetRank.chatFormatting.prefixText}]` : `§r[${targetRank.name}]`;
                icon = getPlayerIcon(onlineP);
            }

            formBuilder.button(`${app.playerName} §8${new Date(app.timestamp).toLocaleDateString()}\n${rankText}`, icon, async () => {
                await showTeamRequestActionPanel(player, app.playerId, app.playerName);
            });
        },
        async (newPage) => {
            await showTeamRequestsPanel(player, newPage);
        }
    );

    form.addBackButton(async () => {
        await showTeamManagePanel(player);
    });

    await form.show(player);
}

export async function showTeamRequestActionPanel(player: mc.Player, targetId: string, targetName: string): Promise<void> {
    const team = teamManager.getTeamByPlayer(player.id);
    if (!team || !teamManager.isTeamAdminOrOwner(team, player.id)) {
        await showTeamRequestsPanel(player, 1);
        return;
    }

    const form = new ActionFormBuilder()
        .title(`Request: ${targetName}`)
        .button('Accept', 'textures/ui/realms_green_check', async () => {
            const res = teamManager.acceptApplication(team.id, targetId);
            player.sendMessage(res.message ?? 'Done');
            await showTeamRequestsPanel(player, 1);
        })
        .button('Deny', 'textures/ui/cancel', async () => {
            const res = teamManager.denyApplication(team.id, targetId);
            player.sendMessage(res.message ?? 'Done');
            await showTeamRequestsPanel(player, 1);
        });

    form.addBackButton(async () => {
        await showTeamRequestsPanel(player, 1);
    });

    await form.show(player);
}

export async function showTeamHomePanel(player: mc.Player): Promise<void> {
    const team = teamManager.getTeamByPlayer(player.id);
    if (!team || !teamManager.isTeamAdminOrOwner(team, player.id)) {
        await showTeamManagePanel(player);
        return;
    }

    const form = new ActionFormBuilder().title('Manage Team Home').button('Set Home Here', 'textures/ui/plus', async () => {
        const res = teamManager.setTeamHome(team.id, player.location, player.dimension.id);
        player.sendMessage(res.message ?? 'Done');
        await showTeamHomePanel(player);
    });

    if (team.home) {
        form.button('Delete Home', 'textures/ui/trash', async () => {
            const res = teamManager.deleteTeamHome(team.id);
            player.sendMessage(res.message ?? 'Done');
            await showTeamHomePanel(player);
        });
    }

    form.addBackButton(async () => {
        await showTeamManagePanel(player);
    });

    await form.show(player);
}

export async function showTeamCreatePanel(player: mc.Player): Promise<void> {
    const modal = new CustomFormBuilder<{ name: string }>('Create Team').textField('name', 'Team Name', 'Enter team name', '').submitButton('Create Team');

    const res = await modal.show(player);
    if (res && isNonEmptyString(res.name)) {
        const result = teamManager.createTeam(player, res.name.trim());
        player.sendMessage(result.message ?? 'Done');
        if (result.success) {
            await showTeamMainPanel(player);
            return;
        }
    } else if (res) {
        player.sendMessage('§cName required.');
    }
    await showTeamMainPanel(player);
}

export async function showTeamDepositPanel(player: mc.Player): Promise<void> {
    const team = teamManager.getTeamByPlayer(player.id);
    if (!team) {
        return;
    }

    const modal = new CustomFormBuilder<{ amount: string }>('Deposit Money').textField('amount', 'Amount', '1000', '1000').submitButton('Deposit');

    const res = await modal.show(player);
    if (res && isNonEmptyString(res.amount)) {
        const amount = Number.parseFloat(res.amount);
        if (!Number.isNaN(amount) && amount > 0) {
            const depositRes = teamManager.depositToTeam(player, amount);
            player.sendMessage(depositRes.message ?? (depositRes.success ? '§aDeposit successful.' : '§cDeposit failed.'));
        } else {
            player.sendMessage('§cInvalid amount.');
        }
    }
    await showTeamMainPanel(player);
}

export async function showTeamWithdrawPanel(player: mc.Player): Promise<void> {
    const team = teamManager.getTeamByPlayer(player.id);
    if (!team || team.ownerId !== player.id) {
        return;
    }

    const modal = new CustomFormBuilder<{ amount: string }>(`Withdraw (Bank: ${formatCurrency(team.balance)})`)
        .textField('amount', 'Amount to Withdraw', '100', String(team.balance))
        .submitButton('Withdraw');

    const res = await modal.show(player);
    if (res && isNonEmptyString(res.amount)) {
        const amount = Number.parseFloat(res.amount);
        const withdrawRes = teamManager.withdrawFromTeam(player, amount);
        player.sendMessage(withdrawRes.message ?? (withdrawRes.success ? '§aWithdrawal successful.' : '§cWithdrawal failed.'));
    }
    await showTeamMainPanel(player);
}

export async function showTeamJoinPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder()
        .title('Join Team')
        .button('Search Team', 'textures/ui/magnifyingGlass', async () => {
            await showTeamSearchPanel(player);
        })
        .button('Browse Open Teams', 'textures/ui/multiplayer_glyph_color', async () => {
            await showTeamBrowserPanel(player, 1);
        });

    form.addBackButton(async () => {
        await showTeamMainPanel(player);
    });

    await form.show(player);
}

export async function showTeamSearchPanel(player: mc.Player): Promise<void> {
    const modal = new CustomFormBuilder<{ teamName: string }>('Search Team').textField('teamName', 'Team Name (exact)', 'Name', '').submitButton('Search');

    const res = await modal.show(player);
    if (res && isNonEmptyString(res.teamName)) {
        const allTeams = teamManager.getAllTeam();
        const lowerTeamName = res.teamName.trim().toLowerCase();
        const foundTeam = allTeams.find((t) => t.name.toLowerCase() === lowerTeamName);

        if (foundTeam) {
            const applyRes = teamManager.applyToTeam(player, foundTeam.id);
            player.sendMessage(applyRes.message ?? (applyRes.success ? '§aApplication sent.' : '§cFailed to apply.'));
        } else {
            player.sendMessage('§cTeam not found.');
        }
    } else if (res) {
        player.sendMessage('§cTeam name required.');
    }

    await showTeamJoinPanel(player);
}

export async function showTeamBrowserPanel(player: mc.Player, page: number = 1): Promise<void> {
    const allTeams = teamManager.getAllTeam().filter((t) => t.open);
    const form = new ActionFormBuilder().title('Open Teams');

    if (allTeams.length === 0) {
        form.body('There are currently no open teams.');
    }

    form.addPaginatedButtons(
        allTeams,
        page,
        (team, formBuilder) => {
            formBuilder.button(`${team.name}\nMembers: ${team.members.length}`, 'textures/ui/icon_recipe_nature', async () => {
                const applyRes = teamManager.applyToTeam(player, team.id);
                player.sendMessage(applyRes.message ?? (applyRes.success ? '§aApplication sent.' : '§cFailed to apply.'));
                await showTeamBrowserPanel(player, page);
            });
        },
        async (newPage) => {
            await showTeamBrowserPanel(player, newPage);
        }
    );

    form.addBackButton(async () => {
        await showTeamJoinPanel(player);
    });

    await form.show(player);
}

export async function showTeamInvitesPanel(player: mc.Player, page: number = 1): Promise<void> {
    const pData = loadPlayerData(player.id);
    const invites = pData?.pendingInvites ?? [];
    const form = new ActionFormBuilder().title('Team Invites');

    form.addPaginatedButtons(
        invites,
        page,
        (invite, formBuilder) => {
            const liveTeam = teamManager.getTeam(invite.teamId);
            const labelName = isDefined(liveTeam) ? liveTeam.name : invite.teamName || `Team #${invite.teamId}`;
            formBuilder.button(`${labelName}\n§7Click to Accept or Deny`, 'textures/ui/invite_base', async () => {
                await showTeamInviteActionPanel(player, invite.teamId, labelName);
            });
        },
        async (newPage) => {
            await showTeamInvitesPanel(player, newPage);
        }
    );

    form.addBackButton(async () => {
        await showTeamMainPanel(player);
    });

    await form.show(player);
}

export async function showTeamInviteActionPanel(player: mc.Player, teamId: number, teamName: string = 'Team'): Promise<void> {
    const form = new ActionFormBuilder()
        .title(`Invite: ${teamName}`)
        .button('Accept', 'textures/ui/realms_green_check', async () => {
            const res = teamManager.acceptInvite(player, teamId);
            player.sendMessage(res.message ?? 'Done');
            await showTeamMainPanel(player);
        })
        .button('Deny', 'textures/ui/cancel', async () => {
            const res = teamManager.denyInvite(player.id, teamId);
            player.sendMessage(res.message ?? 'Done');
            await showTeamInvitesPanel(player, 1);
        });

    form.addBackButton(async () => {
        await showTeamInvitesPanel(player, 1);
    });

    await form.show(player);
}
