import { getConfig } from '@core/configManager.js';
import { getPlayerFromCache } from '@core/playerCache.js';
import { loadPlayerData } from '@core/playerDataManager.js';
import { getPlayerRank } from '@core/rankManager.js';
import { getPlayerIcon } from '@core/utils/ui.js';
import * as teamManager from '@features/team/manager.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';

export async function showTeamMainPanel(player: mc.Player): Promise<void> {
    const team = teamManager.getTeamByPlayer(player.id);
    const form = new ActionFormBuilder().title(team ? team.name : 'Teams');

    if (team) {
        form.button(`Members (${team.members.length})`, 'textures/ui/multiplayer_glyph_color', async () => {
            await showTeamMembersPanel(player, 1);
        });

        form.button('Leave Team', 'textures/ui/cancel', async () => {
            const res = teamManager.leaveTeam(player);
            player.sendMessage(res.message ?? (res.success ? 'Success' : 'Failed'));
            await showTeamMainPanel(player);
        });

        if (team.ownerId === player.id) {
            form.button('Manage Team', 'textures/ui/settings_glyph_color_2x', async () => {
                await showTeamManagePanel(player);
            });
        }

        form.button('Deposit Money', 'textures/items/gold_ingot', async () => {
            await showTeamDepositPanel(player);
        });

        if (team.home) {
            form.button('Teleport to Home', 'textures/ui/portalBg', () => {
                teamManager.teleportToTeamHome(player);
            });
        }
    } else {
        const pData = loadPlayerData(player.id);
        const invites = pData?.pendingInvites ?? [];
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
        const { showMainPanel } = await import('@core/ui/panels/mainPanel.js');
        await showMainPanel(player);
    });

    await form.show(player);
}

export async function showTeamMembersPanel(player: mc.Player, page: number = 1): Promise<void> {
    const team = teamManager.getTeamByPlayer(player.id);
    if (!team) {
        await showTeamMainPanel(player);
        return;
    }

    const form = new ActionFormBuilder().title('Members');

    const isOwner = team.ownerId === player.id;

    form.addPaginatedButtons(
        team.members,
        page,
        (member, formBuilder) => {
            const isOnline = getPlayerFromCache(member) !== undefined;
            const status = isOnline ? '§aOnline' : '§cOffline';
            const role = team.ownerId === member ? '§6Owner' : '§7Member';

            formBuilder.button(`${loadPlayerData(member)?.name ?? member}\n${status} §r- ${role}`, 'textures/ui/permissions_member_star', async () => {
                if (isOwner && member !== player.id) {
                    await showTeamMemberActionPanel(player, member, loadPlayerData(member)?.name ?? member);
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
    if (!team || team.ownerId !== player.id) {
        await showTeamMembersPanel(player, 1);
        return;
    }

    const form = new ActionFormBuilder()
        .title(`Manage ${targetName}`)
        .button('Kick Member', 'textures/ui/cancel', async () => {
            const res = teamManager.kickMember(team.id, targetId);
            player.sendMessage(res.message ?? 'Done');
            await showTeamMembersPanel(player, 1);
        })
        .button('Transfer Ownership', 'textures/ui/op', async () => {
            const res = teamManager.transferOwnership(team.id, targetId);
            player.sendMessage(res.message ?? 'Done');
            await showTeamMainPanel(player);
        });

    form.addBackButton(async () => {
        await showTeamMembersPanel(player, 1);
    });

    await form.show(player);
}

export async function showTeamManagePanel(player: mc.Player): Promise<void> {
    const team = teamManager.getTeamByPlayer(player.id);
    if (!team || team.ownerId !== player.id) {
        await showTeamMainPanel(player);
        return;
    }

    const form = new ActionFormBuilder()
        .title('Manage Team')
        .button('Settings', 'textures/ui/settings_glyph_color_2x', async () => {
            await showTeamSettingPanel(player);
        })
        .button(`Join Requests (${team.applications.length})`, 'textures/ui/user_icon', async () => {
            await showTeamRequestsPanel(player, 1);
        })
        .button('Manage Home', 'textures/ui/portalBg', async () => {
            await showTeamHomePanel(player);
        });

    form.addBackButton(async () => {
        await showTeamMainPanel(player);
    });

    await form.show(player);
}

export async function showTeamSettingPanel(player: mc.Player): Promise<void> {
    const team = teamManager.getTeamByPlayer(player.id);
    if (!team || team.ownerId !== player.id) return;

    const modal = new ModalFormBuilder<{ open: boolean }>().title('Team Settings').toggle('open', 'Open to Requests', !!team.open);

    const res = await modal.show(player);
    if (res) {
        teamManager.setTeamOpenStatus(team.id, res.open);
    }
    await showTeamManagePanel(player);
}

export async function showTeamRequestsPanel(player: mc.Player, page: number = 1): Promise<void> {
    const team = teamManager.getTeamByPlayer(player.id);
    if (!team || team.ownerId !== player.id) {
        await showTeamManagePanel(player);
        return;
    }

    const form = new ActionFormBuilder().title('Join Requests');

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
    if (!team || team.ownerId !== player.id) {
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
    if (!team || team.ownerId !== player.id) {
        await showTeamManagePanel(player);
        return;
    }

    const form = new ActionFormBuilder().title('Manage Home').button('Set Home Here', 'textures/ui/plus', async () => {
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
    const modal = new ModalFormBuilder<{ name: string }>().title('Create Team').textField('name', 'Team Name', 'Enter team name');

    const res = await modal.show(player);
    if (res && isNonEmptyString(res.name)) {
        const result = teamManager.createTeam(player, res.name);
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
    if (!team) return;

    const modal = new ModalFormBuilder<{ amount: string }>().title('Deposit Money').textField('amount', 'Amount', '1000');

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

export async function showTeamJoinPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder()
        .title('Join Team')
        .button('Search Team', 'textures/ui/magnifyingGlass', async () => {
            await showTeamSearchPanel(player);
        })
        .button('Browse Teams', 'textures/ui/multiplayer_glyph_color', async () => {
            await showTeamBrowserPanel(player, 1);
        });

    form.addBackButton(async () => {
        await showTeamMainPanel(player);
    });

    await form.show(player);
}

export async function showTeamSearchPanel(player: mc.Player): Promise<void> {
    const modal = new ModalFormBuilder<{ teamName: string }>().title('Search Team').textField('teamName', 'Team Name (exact)', 'Name');

    const res = await modal.show(player);
    if (res && isNonEmptyString(res.teamName)) {
        const allTeams = teamManager.getAllTeam();
        const lowerTeamName = res.teamName.toLowerCase();
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
            formBuilder.button(`Invite from Team ID: ${invite.teamId}\nClick to Manage`, 'textures/ui/invite_base', async () => {
                await showTeamInviteActionPanel(player, invite.teamId);
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

export async function showTeamInviteActionPanel(player: mc.Player, teamId: number): Promise<void> {
    const form = new ActionFormBuilder()
        .title('Manage Invite')
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
