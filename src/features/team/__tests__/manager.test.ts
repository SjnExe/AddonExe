import { beforeEach, describe, expect, it, mock } from 'bun:test';

mock.module('@minecraft/server', () => ({
    system: { runJob: mock() },
    world: {
        getDynamicProperty: mock(),
        setDynamicProperty: mock(),
        getDimension: mock()
    },
    Player: class {}
}));

mock.module('@core/configManager.js', () => ({
    getConfig: mock()
}));

mock.module('@core/configurations.js', () => ({
    getTeamConfig: mock()
}));

mock.module('@core/logger.js', () => ({
    debugLog: mock(),
    errorLog: mock()
}));

mock.module('@core/playerCache.js', () => ({
    getPlayerFromCache: mock()
}));

mock.module('@core/playerDataManager.js', () => ({
    getOrCreatePlayer: mock(),
    getPlayer: mock(),
    incrementPlayerBalance: mock(),
    updatePlayerData: mock()
}));

mock.module('@core/services/serviceLocator.js', () => ({
    serviceLocator: {
        getService: mock()
    }
}));

mock.module('@core/teleportLogic.js', () => ({
    startTeleportWarmup: mock()
}));

mock.module('@ui/PanelRouter.js', () => ({
    panelRouter: {
        register: mock()
    }
}));

import { getConfig } from '@core/configManager.js';
import { getTeamConfig } from '@core/configurations.js';
import { getOrCreatePlayer, getPlayer, incrementPlayerBalance, updatePlayerData } from '@core/playerDataManager.js';
import * as mc from '@minecraft/server';
import {
    acceptApplication,
    acceptInvite,
    applyToTeam,
    createTeam,
    deleteTeam,
    demoteMember,
    denyApplication,
    denyInvite,
    getAllTeam,
    getTeam,
    getTeamByPlayer,
    invitePlayer,
    kickMember,
    promoteMember,
    transferOwnership
} from '../manager.js';

describe('Team Manager', () => {
    let mockPlayers: Record<string, any> = {};

    function getMockPlayer(id: string) {
        if (!mockPlayers[id]) {
            mockPlayers[id] = {
                id: id,
                name: `Player_${id}`,
                balance: 100,
                teamId: undefined,
                pendingInvites: []
            };
        }
        return mockPlayers[id];
    }

    beforeEach(() => {
        mock.restore();

        // Clean up active teams from previous tests
        const allTeams = getAllTeam();
        for (const team of allTeams) {
            deleteTeam(team.id);
        }

        mockPlayers = {};

        (getTeamConfig as ReturnType<typeof mock>).mockReturnValue({
            enabled: true,
            nameMinLength: 3,
            nameMaxLength: 16,
            nameBlacklist: ['badword'],
            creationCost: 0,
            maxMembers: 10,
            requestExpirySeconds: 60,
            maxPlayerInvites: 5,
            maxApplications: 5,
            teleportWarmupSeconds: 3
        });

        (getConfig as ReturnType<typeof mock>).mockReturnValue({
            economy: { enabled: false }
        });

        (getOrCreatePlayer as ReturnType<typeof mock>).mockImplementation((p: any) => getMockPlayer(p.id));
        (getPlayer as ReturnType<typeof mock>).mockImplementation((id: string) => getMockPlayer(id));

        (updatePlayerData as ReturnType<typeof mock>).mockImplementation((id: string, cb: (data: any) => void) => {
            cb(getMockPlayer(id));
        });
    });

    describe('createTeam', () => {
        it('should fail if team system is disabled', () => {
            (getTeamConfig as ReturnType<typeof mock>).mockReturnValue({ enabled: false });
            const player = { id: 'player1' } as mc.Player;
            const result = createTeam(player, 'MyTeam');
            expect(result.success).toBe(false);
            expect(result.message).toContain('disabled');
        });

        it('should fail if player is already in a team', () => {
            getMockPlayer('player1').teamId = 1;
            const player = { id: 'player1' } as mc.Player;
            const result = createTeam(player, 'MyTeam');
            expect(result.success).toBe(false);
            expect(result.message).toContain('already in a team');
        });

        it('should fail with invalid name', () => {
            const player = { id: 'player1' } as mc.Player;

            // Too short
            let result = createTeam(player, 'ab');
            expect(result.success).toBe(false);

            // Invalid chars
            result = createTeam(player, 'MyTeam!');
            expect(result.success).toBe(false);

            // Blacklisted
            result = createTeam(player, 'SomeBadWordTeam');
            expect(result.success).toBe(false);
        });

        it('should handle economy cost if enabled', () => {
            (getTeamConfig as ReturnType<typeof mock>).mockReturnValue({
                enabled: true,
                nameMinLength: 3,
                nameMaxLength: 16,
                nameBlacklist: [],
                creationCost: 50
            });
            (getConfig as ReturnType<typeof mock>).mockReturnValue({
                economy: { enabled: true }
            });
            getMockPlayer('player1').balance = 40;

            const player = { id: 'player1' } as mc.Player;
            const result = createTeam(player, 'MyTeam');
            expect(result.success).toBe(false);
            expect(result.message).toContain('Insufficient funds');
        });

        it('should create team and deduct cost if economy enabled and sufficient funds', () => {
            (getTeamConfig as ReturnType<typeof mock>).mockReturnValue({
                enabled: true,
                nameMinLength: 3,
                nameMaxLength: 16,
                nameBlacklist: [],
                creationCost: 50
            });
            (getConfig as ReturnType<typeof mock>).mockReturnValue({
                economy: { enabled: true }
            });
            getMockPlayer('player1').balance = 100;

            const player = { id: 'player1' } as mc.Player;
            const result = createTeam(player, 'MyTeam');

            expect(result.success).toBe(true);
            expect(incrementPlayerBalance).toHaveBeenCalledWith('player1', -50);

            // Verify team exists
            const team = getTeamByPlayer('player1');
            expect(team).toBeDefined();
            expect(team?.name).toBe('MyTeam');
            expect(team?.ownerId).toBe('player1');
        });

        it('should fail if team name already exists', () => {
            const player1 = { id: 'player1' } as mc.Player;
            createTeam(player1, 'MyTeam');

            const player2 = { id: 'player2' } as mc.Player;
            getMockPlayer('player2').teamId = undefined; // mock next player isn't in team
            const result = createTeam(player2, 'myteam'); // duplicate name, different case

            expect(result.success).toBe(false);
            expect(result.message).toContain('already taken');
        });
    });

    describe('deleteTeam', () => {
        it('should delete a team and refund if economy enabled', () => {
            (getTeamConfig as ReturnType<typeof mock>).mockReturnValue({
                enabled: true,
                nameMinLength: 3,
                nameMaxLength: 16,
                nameBlacklist: [],
                creationCost: 50
            });
            (getConfig as ReturnType<typeof mock>).mockReturnValue({
                economy: { enabled: true }
            });

            const player = { id: 'player1' } as mc.Player;
            createTeam(player, 'MyTeam');

            const team = getTeamByPlayer('player1');
            expect(team).toBeDefined();

            const result = deleteTeam(team!.id);
            expect(result).toBe(true);
            expect(getTeam(team!.id)).toBeUndefined();

            // Expect incrementPlayerBalance to be called to refund
            expect(incrementPlayerBalance).toHaveBeenCalledWith('player1', 50);
        });

        it('should return false if team not found', () => {
            expect(deleteTeam(999)).toBe(false);
        });
    });

    describe('Member Management', () => {
        let teamId: number;

        beforeEach(() => {
            const player = { id: 'player1' } as mc.Player;
            createTeam(player, 'MyTeam');
            teamId = getTeamByPlayer('player1')!.id;

            const team = getTeam(teamId)!;
            team.members.push('player2', 'player3');
            team.admins.push('player2');
        });

        it('kickMember should remove member from team', () => {
            const result = kickMember(teamId, 'player3');
            expect(result.success).toBe(true);

            const team = getTeam(teamId)!;
            expect(team.members).not.toContain('player3');
        });

        it('kickMember should not kick owner', () => {
            const result = kickMember(teamId, 'player1');
            expect(result.success).toBe(false);
        });

        it('promoteMember should make member admin', () => {
            const result = promoteMember(teamId, 'player3');
            expect(result.success).toBe(true);
            const team = getTeam(teamId)!;
            expect(team.admins).toContain('player3');
        });

        it('demoteMember should remove admin status', () => {
            const result = demoteMember(teamId, 'player2');
            expect(result.success).toBe(true);
            const team = getTeam(teamId)!;
            expect(team.admins).not.toContain('player2');
        });

        it('transferOwnership should change owner', () => {
            const result = transferOwnership(teamId, 'player2');
            expect(result.success).toBe(true);
            const team = getTeam(teamId)!;
            expect(team.ownerId).toBe('player2');
            expect(team.admins).not.toContain('player2');
        });
    });

    describe('Invite System', () => {
        let teamId: number;

        beforeEach(() => {
            const player = { id: 'player1' } as mc.Player;
            createTeam(player, 'MyTeam');
            teamId = getTeamByPlayer('player1')!.id;
        });

        it('invitePlayer should add pending invite', () => {
            const result = invitePlayer(teamId, 'player2');
            expect(result.success).toBe(true);
            expect(getMockPlayer('player2').pendingInvites.length).toBe(1);
            expect(getMockPlayer('player2').pendingInvites[0].teamId).toBe(teamId);
        });

        it('acceptInvite should add player to team', () => {
            getMockPlayer('player2').pendingInvites = [{ teamId, timestamp: Date.now() }];
            const player2 = { id: 'player2' } as mc.Player;

            const result = acceptInvite(player2, teamId);
            expect(result.success).toBe(true);

            const team = getTeam(teamId)!;
            expect(team.members).toContain('player2');
            expect(getMockPlayer('player2').teamId).toBe(teamId);
            expect(getMockPlayer('player2').pendingInvites.length).toBe(0);
        });

        it('denyInvite should remove pending invite', () => {
            getMockPlayer('player2').pendingInvites = [{ teamId, timestamp: Date.now() }];
            const result = denyInvite('player2', teamId);
            expect(result.success).toBe(true);
            expect(getMockPlayer('player2').pendingInvites.length).toBe(0);
        });
    });

    describe('Application System', () => {
        let teamId: number;

        beforeEach(() => {
            const player = { id: 'player1' } as mc.Player;
            createTeam(player, 'MyTeam');
            teamId = getTeamByPlayer('player1')!.id;
        });

        it('applyToTeam should add application to team', () => {
            const player2 = { id: 'player2', name: 'PlayerTwo' } as mc.Player;
            const result = applyToTeam(player2, teamId);

            expect(result.success).toBe(true);
            const team = getTeam(teamId)!;
            expect(team.applications.length).toBe(1);
            expect(team.applications[0].playerId).toBe('player2');
        });

        it('applyToTeam should fail if team is closed', () => {
            const team = getTeam(teamId)!;
            team.open = false;

            const player2 = { id: 'player2', name: 'PlayerTwo' } as mc.Player;
            const result = applyToTeam(player2, teamId);
            expect(result.success).toBe(false);
        });

        it('acceptApplication should add player to team', () => {
            const team = getTeam(teamId)!;
            team.applications = [{ playerId: 'player2', playerName: 'PlayerTwo', timestamp: Date.now() }];

            const result = acceptApplication(teamId, 'player2');
            expect(result.success).toBe(true);
            expect(team.members).toContain('player2');
            expect(team.applications.length).toBe(0);
        });

        it('denyApplication should remove application', () => {
            const team = getTeam(teamId)!;
            team.applications = [{ playerId: 'player2', playerName: 'PlayerTwo', timestamp: Date.now() }];

            const result = denyApplication(teamId, 'player2');
            expect(result.success).toBe(true);
            expect(team.applications.length).toBe(0);
        });
    });
});
