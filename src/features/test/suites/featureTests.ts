import { getConfig } from '@core/config/configManager.js';
import * as configs from '@core/config/configurations.js';
import { getAnticheatConfig } from '@core/config/configurations.js';
import { getAllPlayerNameIdMap, getOrCreatePlayer, handlePlayerLeave } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { getProtectionFlags } from '@core/events/protectionService.js';
import { getAllRanks, getRankById } from '@core/permissions/rankManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { featureRegistry } from '@core/services/featureRegistry.js';
import { deepClone, deepMerge, getValueFromPath, isDeepEqual, setValueByPath } from '@core/utils/objectUtils.js';
import { getPunishmentLogs } from '@features/anticheat/logManager.js';
import { getBounty, incrementBounty, removeBounty } from '@features/economy/bountyManager.js';
import { parseRankOverrides } from '@features/economy/shop/utils.js';
import { getEffectiveBorderForDimension, getWorldBorder, setEndBorder, setOverworldBorder, updateWorldBorderConfig } from '@features/essentials/worldBorderManager.js';
import { evaluateRpsRound } from '@features/games/rps/manager.js';
import { evaluateTicTacToeBoard } from '@features/games/tictactoe/manager.js';
import { addPunishment, getPunishment, removePunishment } from '@features/moderation/punishmentManager.js';
import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { addTest, assert } from '../testRunner.js';

const SUITE_NAME = 'features';

export function registerFeatureTests() {
    addTest(SUITE_NAME, 'All 14 Configuration Managers are initialized and return valid objects', () => {
        assert.ok(getConfig(), 'Main config missing');
        assert.ok(configs.getEconomyConfig(), 'Economy config missing');
        assert.ok(configs.getShopConfig(), 'Shop config missing');
        assert.ok(configs.getRanksConfig(), 'Ranks config missing');
        assert.ok(configs.getXrayConfig(), 'X-Ray config missing');
        assert.ok(configs.getTeamConfig(), 'Team config missing');
        assert.ok(configs.getFriendConfig(), 'Friend config missing');
        assert.ok(configs.getSidebarConfig(), 'Sidebar config missing');
        assert.ok(configs.getAuctionHouseConfig(), 'AuctionHouse config missing');
        assert.ok(configs.getDailyRewardsConfig(), 'DailyRewards config missing');
        assert.ok(configs.getWorldProtectionConfig(), 'WorldProtection config missing');
        assert.ok(configs.getGamesConfig(), 'Games config missing');
        assert.ok(configs.getWordleConfig(), 'Wordle config missing');
        assert.ok(getAnticheatConfig(), 'Anticheat config missing');
    });

    addTest(SUITE_NAME, 'Feature Registry topological order satisfies all dependencies', () => {
        assert.ok(featureRegistry.length >= 15, `Expected >=15 features, got ${featureRegistry.length}`);
        const seen = new Set<string>();
        for (const feat of featureRegistry) {
            for (const dep of feat.dependencies) {
                assert.ok(seen.has(dep), `Feature '${feat.id}' loaded before its dependency '${dep}'`);
            }
            seen.add(feat.id);
        }

        // Core features must always report active
        assert.equal(isFeatureActive('essentials'), true, 'essentials must be active');
        assert.equal(isFeatureActive('mod'), true, 'mod must be active');
        assert.equal(isFeatureActive('ranks'), true, 'ranks must be active');
    });

    addTest(SUITE_NAME, 'Rank definitions contain locked owner and member ranks with valid priorities', () => {
        const allRanks = getAllRanks();
        assert.ok(allRanks.length >= 2, 'Should have at least owner and member ranks');

        const owner = getRankById('owner');
        const member = getRankById('member');
        assert.ok(owner, 'Owner rank must exist');
        assert.ok(member, 'Member rank must exist');
        assert.ok(owner!.priority < member!.priority, 'Owner priority number must be lower (higher rank) than member');
    });

    addTest(SUITE_NAME, 'ObjectUtils deepClone, deepMerge, isDeepEqual, and path accessors work accurately', () => {
        const original = { a: 1, nested: { b: [10, 20], c: 'hello' } };
        const cloned = deepClone(original);
        assert.ok(isDeepEqual(original, cloned), 'Cloned object should be deeply equal to original');

        setValueByPath(cloned, 'nested.c', 'world');
        assert.equal(getValueFromPath(cloned, 'nested.c'), 'world', 'setValueByPath should update nested property');
        assert.equal(original.nested.c, 'hello', 'Mutating clone must not mutate original');

        const merged = deepMerge({ a: 1, nested: { x: true, y: 1 } }, { nested: { y: 2, z: 3 } }) as Record<string, unknown>;
        assert.equal(getValueFromPath(merged, 'nested.x'), true, 'deepMerge should preserve existing nested keys');
        assert.equal(getValueFromPath(merged, 'nested.y'), 2, 'deepMerge should overwrite updated nested keys');
        assert.equal(getValueFromPath(merged, 'nested.z'), 3, 'deepMerge should add new nested keys');
    });

    addTest(SUITE_NAME, 'World Protection Service evaluates 3D bounding boxes accurately', () => {
        const worldConfig = configs.getWorldProtectionConfig();
        const originalZones = [...worldConfig.zones];

        try {
            worldConfig.zones.push({
                id: '__test_zone__',
                name: 'Test Zone',
                dimension: MinecraftDimensionTypes.Overworld,
                box: {
                    min: { x: 100, y: 50, z: 100 },
                    max: { x: 200, y: 100, z: 200 }
                },
                flags: {
                    preventPvP: true,
                    preventHostileDamage: false,
                    preventHostileMobSpawning: false,
                    preventBlockBreaking: true,
                    preventBlockPlacing: false,
                    preventExplosions: true,
                    preventBlockInteraction: false,
                    preventItemPickup: false,
                    preventFallDamage: true,
                    preventMagicDamage: false,
                    preventMobGriefing: false,
                    preventEntityInteraction: false,
                    preventProjectileUsage: false
                }
            });

            const insideFlags = getProtectionFlags({ x: 150, y: 64, z: 150 }, MinecraftDimensionTypes.Overworld);
            assert.equal(insideFlags.preventPvP, true, 'Inside zone should prevent PvP');
            assert.equal(insideFlags.preventBlockBreaking, true, 'Inside zone should prevent block breaking');
            assert.equal(insideFlags.preventFallDamage, true, 'Inside zone should prevent fall damage');

            const wrongDimFlags = getProtectionFlags({ x: 150, y: 64, z: 150 }, MinecraftDimensionTypes.Nether);
            assert.equal(wrongDimFlags.preventBlockBreaking, false, 'Different dimension should not match Overworld zone');
        } finally {
            worldConfig.zones = originalZones;
        }
    });

    addTest(SUITE_NAME, 'Punishment Manager handles concurrent ban and mute lifecycle cleanly', () => {
        const testPid = '__runtime_test_punish_pid__';
        try {
            addPunishment(testPid, 'TestTarget', { type: 'ban', expires: Date.now() + 60_000, reason: 'Runtime test ban' }, 'SystemTest');
            addPunishment(testPid, 'TestTarget', { type: 'mute', expires: Date.now() + 60_000, reason: 'Runtime test mute' }, 'SystemTest');

            const ban = getPunishment(testPid, 'ban');
            const mute = getPunishment(testPid, 'mute');
            assert.ok(ban && ban.reason === 'Runtime test ban', 'Ban should be active');
            assert.ok(mute && mute.reason === 'Runtime test mute', 'Mute should be active concurrently');

            removePunishment(testPid, 'ban');
            assert.equal(getPunishment(testPid, 'ban'), undefined, 'Ban should be removed');
            assert.ok(getPunishment(testPid, 'mute'), 'Mute should remain after removing ban');
        } finally {
            removePunishment(testPid, 'ban');
            removePunishment(testPid, 'mute');
            const logs = getPunishmentLogs();
            for (let i = logs.length - 1; i >= 0; i--) {
                if (logs[i]?.playerName === 'TestTarget' && logs[i]?.adminName === 'SystemTest') {
                    logs.splice(i, 1);
                }
            }
        }
    });

    addTest(SUITE_NAME, 'Bounty Manager increments and removes bounties cleanly', () => {
        const testPid = '__runtime_test_bounty_pid__';
        try {
            getOrCreatePlayer({ id: testPid, name: 'TestBountyTarget' } as unknown as mc.Player);
            removeBounty(testPid);
            incrementBounty(testPid, 250);
            incrementBounty(testPid, 150);

            const b = getBounty(testPid);
            assert.ok(b, 'Bounty should exist');
            assert.equal(b!.amount, 400, 'Bounty amount should sum to 400');
        } finally {
            removeBounty(testPid);
            handlePlayerLeave(testPid);
            getAllPlayerNameIdMap().delete('testbountytarget');
            new StorageManager(`exe:player.${testPid}`).delete();
            assert.equal(getBounty(testPid), undefined, 'Bounty should be cleaned up');
        }
    });

    addTest(SUITE_NAME, 'Shop rank override parser handles multiple formats', () => {
        const parsed = parseRankOverrides('vip=0.8,1.2;donator=0.9,1.1');
        assert.ok(parsed, 'Parsed overrides should be defined');
        assert.equal(parsed!['vip']?.buy, 0.8, 'VIP buy multiplier should be 0.8');
        assert.equal(parsed!['vip']?.sell, 1.2, 'VIP sell multiplier should be 1.2');
        assert.equal(parsed!['donator']?.buy, 0.9, 'Donator buy multiplier should be 0.9');
    });

    addTest(SUITE_NAME, 'World Border links Overworld and Nether with 8:1 multiplier and keeps End independent', () => {
        const snapshot = getWorldBorder();
        try {
            setOverworldBorder(true, 8000, 160, -80);
            setEndBorder(false, 5000, 0, 0);

            const owBorder = getEffectiveBorderForDimension(MinecraftDimensionTypes.Overworld);
            const netherBorder = getEffectiveBorderForDimension(MinecraftDimensionTypes.Nether);
            const endBorder = getEffectiveBorderForDimension(MinecraftDimensionTypes.TheEnd);

            assert.equal(owBorder.enabled, true, 'Overworld border should be enabled');
            assert.equal(owBorder.radius, 8000, 'Overworld radius should be 8000');
            assert.equal(netherBorder.enabled, true, 'Nether border should follow Overworld enabled state');
            assert.equal(netherBorder.radius, 1000, 'Nether radius should be 1000 (8000 / 8)');
            assert.equal(netherBorder.centerX, 20, 'Nether centerX should scale by 1/8 (160 / 8 = 20)');
            assert.equal(netherBorder.centerZ, -10, 'Nether centerZ should scale by 1/8 (-80 / 8 = -10)');
            assert.equal(endBorder.enabled, false, 'End border should remain independent and disabled');
        } finally {
            updateWorldBorderConfig(snapshot);
        }
    });

    addTest(SUITE_NAME, 'Tic-Tac-Toe 3x3 evaluator detects rows, diagonals, and draws accurately', () => {
        const winRow = evaluateTicTacToeBoard(['X', 'X', 'X', 'O', 'O', '', '', '', '']);
        assert.equal(winRow.winner, 'X', 'Should detect top row X win');
        assert.deepEqual(winRow.winningLine, [0, 1, 2], 'Winning line should be [0, 1, 2]');

        const winDiag = evaluateTicTacToeBoard(['O', 'X', 'X', '', 'O', 'X', '', '', 'O']);
        assert.equal(winDiag.winner, 'O', 'Should detect diagonal O win');

        const drawBoard = evaluateTicTacToeBoard(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']);
        assert.equal(drawBoard.winner, undefined, 'Draw board should have no winner');
        assert.equal(drawBoard.isDraw, true, 'Should detect draw when all 9 squares are filled');
    });

    addTest(SUITE_NAME, 'Rock Paper Scissors evaluator resolves all matchups and draws', () => {
        assert.equal(evaluateRpsRound('rock', 'scissors'), 'p1', 'Rock should beat Scissors');
        assert.equal(evaluateRpsRound('paper', 'rock'), 'p1', 'Paper should beat Rock');
        assert.equal(evaluateRpsRound('scissors', 'paper'), 'p1', 'Scissors should beat Paper');
        assert.equal(evaluateRpsRound('rock', 'paper'), 'p2', 'Rock should lose to Paper');
        assert.equal(evaluateRpsRound('scissors', 'scissors'), 'draw', 'Identical moves should draw');
    });
}
