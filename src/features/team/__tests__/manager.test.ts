import * as mcMock from '@core/__tests__/__mocks__/minecraftMock.ts';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import defaultConfig from '../../../config.js';

import * as configManager from '@core/configManager.js';
import * as configurations from '@core/configurations.js';
import * as realPlayerDataManager from '@core/playerDataManager.js';

import { getConfig } from '@core/configManager.js';
import { getTeamConfig } from '@core/configurations.js';
import { incrementPlayerBalance } from '@core/playerDataManager.js';
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

    let runJobSpy: any;
    let getTeamConfigSpy: any;
    let getConfigSpy: any;
    let getOrCreatePlayerSpy: any;
    let getPlayerSpy: any;
    let incrementPlayerBalanceSpy: any;
    let updatePlayerDataSpy: any;

    function getMockPlayer(id: string) {
        if (!mockPlayers[id]) {
            mockPlayers[id] = {
                id: id,
                name: `Player_${id}`,
                balance: 100,
                teamId: undefined,
                pendingInvites: [],
                sendMessage: mock()
            };
        }
        return mockPlayers[id];
    }

    beforeEach(() => {
        runJobSpy = spyOn(mc.system, 'runJob');

        mockPlayers = {};

        // Clean up active teams from previous tests
        const allTeams = getAllTeam();
        for (const team of allTeams) {
            deleteTeam(team.id);
        }

        getTeamConfigSpy = spyOn(configurations, 'getTeamConfig').mockReturnValue({
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
        } as any);

        getConfigSpy = spyOn(configManager, 'getConfig').mockReturnValue({
            ...defaultConfig,
            economy: { enabled: false }
        } as any);

        getOrCreatePlayerSpy = spyOn(realPlayerDataManager, 'getOrCreatePlayer').mockImplementation((p: any) => getMockPlayer(p.id) as any);
        getPlayerSpy = spyOn(realPlayerDataManager, 'getPlayer').mockImplementation((id: string) => getMockPlayer(id) as any);
        incrementPlayerBalanceSpy = spyOn(realPlayerDataManager, 'incrementPlayerBalance');
        updatePlayerDataSpy = spyOn(realPlayerDataManager, 'updatePlayerData').mockImplementation((id: string, cb: (data: any) => void) => {
            cb(getMockPlayer(id));
        });
    });

    afterEach(() => {
        runJobSpy?.mockRestore();
        getTeamConfigSpy?.mockRestore();
        getConfigSpy?.mockRestore();
        getOrCreatePlayerSpy?.mockRestore();
        getPlayerSpy?.mockRestore();
        incrementPlayerBalanceSpy?.mockRestore();
        updatePlayerDataSpy?.mockRestore();
    });

    describe('createTeam', () => {
        it('should fail if team system is disabled', () => {
            (getTeamConfig as ReturnType<typeof mock>).mockReturnValue({ enabled: false });
            const player = { id: 'player1', sendMessage: mock() } as unknown as mc.Player;
            const result = createTeam(player, 'MyTeam');
            expect(result.success).toBe(false);
            expect(result.message).toContain('disabled');
        });

        it('should fail if player is already in a team', () => {
            getMockPlayer('player1').teamId = 1;
            const player = { id: 'player1', sendMessage: mock() } as unknown as mc.Player;
            const result = createTeam(player, 'MyTeam');
            expect(result.success).toBe(false);
            expect(result.message).toContain('already in a team');
        });

        it('should fail with invalid name', () => {
            const player = { id: 'player1', sendMessage: mock() } as unknown as mc.Player;

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

            const player = { id: 'player1', sendMessage: mock() } as unknown as mc.Player;
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

            const player = { id: 'player1', sendMessage: mock() } as unknown as mc.Player;
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
            const player1 = { id: 'player1', sendMessage: mock() } as unknown as mc.Player;
            createTeam(player1, 'MyTeam');

            const player2 = { id: 'player2', sendMessage: mock() } as unknown as mc.Player;
            getMockPlayer('player2').teamId = undefined; // mock next player isn't in team
            const result = createTeam(player2, 'myteam'); // duplicate name, different case

            expect(result.success).toBe(false);
            expect(result.message).toContain('already taken');
        });

        it('should avoid ID collision if persistent dynamic property already exists', () => {
            const originalGetDynamicProperty = (mc.world.getDynamicProperty as ReturnType<typeof mock>).getMockImplementation();
            (mc.world.getDynamicProperty as ReturnType<typeof mock>).mockImplementation((key: string) => {
                if (key === 'exe:team.1') {
                    return JSON.stringify({ id: 1, name: 'ExistingTeam' });
                }
                if (key === 'exe:allTeamIds') {
                    return JSON.stringify([1]);
                }
                return undefined;
            });

            try {
                const player1 = { id: 'player1', sendMessage: mock() } as unknown as mc.Player;
                const result = createTeam(player1, 'NewTeam');

                expect(result.success).toBe(true);
                const team = getTeamByPlayer('player1');
                expect(team).toBeDefined();
                expect(team?.id).toBeGreaterThan(1);
            } finally {
                if (originalGetDynamicProperty) {
                    (mc.world.getDynamicProperty as ReturnType<typeof mock>).mockImplementation(originalGetDynamicProperty);
                } else {
                    (mc.world.getDynamicProperty as ReturnType<typeof mock>).mockImplementation((key: string) => (mcMock.world.getDynamicProperty as any)(key));
                }
            }
        });

        it('benchmark: measures team creation performance under ID collisions', () => {
            const numActive = 2000;
            const extraDynamicPropertyCollisions = 500;
            const allIds = Array.from({ length: numActive }, (_, i) => i + 1);

            const originalGetDynamicProperty = (mc.world.getDynamicProperty as ReturnType<typeof mock>).getMockImplementation();
            (mc.world.getDynamicProperty as ReturnType<typeof mock>).mockImplementation((key: string) => {
                if (key === 'exe:allTeamIds') {
                    return JSON.stringify(allIds);
                }
                if (key.startsWith('exe:team.')) {
                    const parts = key.split('.');
                    const id = parseInt(parts[1], 10);
                    if (id <= numActive + extraDynamicPropertyCollisions) {
                        return JSON.stringify({ id, name: `Team${id}` });
                    }
                }
                return undefined;
            });

            try {
                // Populate activeTeam map up to numActive
                for (let i = 1; i <= numActive; i++) {
                    const p = { id: `p${i}`, sendMessage: mock() } as unknown as mc.Player;
                    createTeam(p, `Team${i}`);
                }

                // Simulate nextTeamId out of sync causing collisions into extraDynamicPropertyCollisions range
                const start = performance.now();
                const iterations = 20;
                for (let i = 0; i < iterations; i++) {
                    const player = { id: `benchPlayer${i}`, sendMessage: mock() } as unknown as mc.Player;
                    const res = createTeam(player, `BTeam${i}`);
                    expect(res.success).toBe(true);
                }
                const elapsed = performance.now() - start;
                console.log(`[BENCHMARK OPTIMIZED] Creating ${iterations} teams with ${extraDynamicPropertyCollisions} step collisions took ${elapsed.toFixed(2)}ms`);
            } finally {
                if (originalGetDynamicProperty) {
                    (mc.world.getDynamicProperty as ReturnType<typeof mock>).mockImplementation(originalGetDynamicProperty);
                } else {
                    (mc.world.getDynamicProperty as ReturnType<typeof mock>).mockImplementation((key: string) => (mcMock.world.getDynamicProperty as any)(key));
                }
            }
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

            const player = { id: 'player1', sendMessage: mock() } as unknown as mc.Player;
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
            const player = { id: 'player1', sendMessage: mock() } as unknown as mc.Player;
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
            const player = { id: 'player1', sendMessage: mock() } as unknown as mc.Player;
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
            const player2 = { id: 'player2', sendMessage: mock() } as unknown as mc.Player;

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
            const player = { id: 'player1', sendMessage: mock() } as unknown as mc.Player;
            createTeam(player, 'MyTeam');
            teamId = getTeamByPlayer('player1')!.id;
        });

        it('applyToTeam should add application to team', () => {
            const player2 = { id: 'player2', name: 'PlayerTwo', sendMessage: mock() } as unknown as mc.Player;
            const result = applyToTeam(player2, teamId);

            expect(result.success).toBe(true);
            const team = getTeam(teamId)!;
            expect(team.applications.length).toBe(1);
            expect(team.applications[0].playerId).toBe('player2');
        });

        it('applyToTeam should fail if team is closed', () => {
            const team = getTeam(teamId)!;
            team.open = false;

            const player2 = { id: 'player2', name: 'PlayerTwo', sendMessage: mock() } as unknown as mc.Player;
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
