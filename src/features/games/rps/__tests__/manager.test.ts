import * as mc from '@minecraft/server';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { initializeConfigManager } from '@core/config/configManager.js';
import { addPlayerToCache, clearPlayerCache } from '@core/data/playerCache.js';
import { cleanupPlayerDataManager, getBalance, getOrCreatePlayer, setPlayerBalance } from '@core/data/playerDataManager.js';
import { _clearMatchmakingForTest } from '@features/games/matchmakingManager.js';
import { _clearRpsForTest, evaluateRpsRound, forfeitRpsMatch, initializeRps, startRpsBotMatch, startRpsMatch, submitRpsChoice } from '@features/games/rps/manager.js';

const createMockPlayer = (id: string, name: string) =>
    ({
        id,
        name,
        isValid: true,
        sendMessage: mock(),
        playSound: mock()
    }) as unknown as mc.Player;

describe('Rock Paper Scissors Manager', () => {
    beforeEach(async () => {
        await initializeConfigManager(false);
        clearPlayerCache();
        cleanupPlayerDataManager();
        _clearMatchmakingForTest();
        _clearRpsForTest();
        initializeRps();
    });

    it('evaluates all Rock Paper Scissors combinations accurately', () => {
        expect(evaluateRpsRound('rock', 'scissors')).toBe('p1');
        expect(evaluateRpsRound('paper', 'rock')).toBe('p1');
        expect(evaluateRpsRound('scissors', 'paper')).toBe('p1');
        expect(evaluateRpsRound('scissors', 'rock')).toBe('p2');
        expect(evaluateRpsRound('rock', 'paper')).toBe('p2');
        expect(evaluateRpsRound('paper', 'scissors')).toBe('p2');
        expect(evaluateRpsRound('rock', 'rock')).toBe('draw');
    });

    it('completes a Best-of-3 multiplayer match and pays out the wager to the winner', () => {
        const p1 = createMockPlayer('rps_p1', 'Alice');
        const p2 = createMockPlayer('rps_p2', 'Bob');
        addPlayerToCache(p1);
        addPlayerToCache(p2);
        getOrCreatePlayer(p1);
        getOrCreatePlayer(p2);
        setPlayerBalance(p1.id, 500);
        setPlayerBalance(p2.id, 500);

        const match = startRpsMatch(p1, p2, 100);
        expect(match).toBeDefined();
        expect(getBalance(p1.id)).toBe(400);
        expect(getBalance(p2.id)).toBe(400);

        // Round 1: Alice (rock) vs Bob (scissors) -> Alice 1-0
        const r1p1 = submitRpsChoice(match!.id, p1.id, 'rock');
        expect(r1p1.waitingForOpponent).toBe(true);
        const r1p2 = submitRpsChoice(match!.id, p2.id, 'scissors');
        expect(r1p2.roundResolved).toBe(true);
        expect(r1p2.matchEnded).toBe(false);
        expect(match!.p1Wins).toBe(1);

        // Round 2: Alice (paper) vs Bob (rock) -> Alice 2-0 (Wins Best of 3!)
        submitRpsChoice(match!.id, p1.id, 'paper');
        const r2p2 = submitRpsChoice(match!.id, p2.id, 'rock');
        expect(r2p2.matchEnded).toBe(true);
        expect(match!.status).toBe('won');
        expect(match!.winnerId).toBe(p1.id);
        expect(getBalance(p1.id)).toBe(600);
        expect(getBalance(p2.id)).toBe(400);
    });

    it('supports solo vs Bot matches and forfeits', () => {
        const p1 = createMockPlayer('rps_solo', 'SoloPlayer');
        addPlayerToCache(p1);
        getOrCreatePlayer(p1);

        const botMatch = startRpsBotMatch(p1);
        const res = submitRpsChoice(botMatch.id, p1.id, 'rock');
        expect(res.valid).toBe(true);
        expect(res.roundResolved).toBe(true);
        expect(botMatch.rounds.length).toBe(1);

        forfeitRpsMatch(botMatch.id, p1.id, 'closed UI');
        expect(botMatch.status).toBe('forfeit');
    });
});
