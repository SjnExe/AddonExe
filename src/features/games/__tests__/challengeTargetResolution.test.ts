import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { initializeConfigManager } from '@core/config/configManager.js';
import { getGamesConfig, saveGamesConfig } from '@core/config/configurations.js';
import { addPlayerToCache, clearPlayerCache } from '@core/data/playerCache.js';
import { cleanupPlayerDataManager, getOrCreatePlayer } from '@core/data/playerDataManager.js';
import coinFlipCommand from '@features/games/coinflip/commands/coinflip.js';
import { initializeCoinFlip } from '@features/games/coinflip/manager.js';
import connect4Command from '@features/games/connect4/commands/connect4.js';
import { initializeConnect4 } from '@features/games/connect4/manager.js';
import { _clearMatchmakingForTest, initializeMatchmaking } from '@features/games/matchmakingManager.js';
import rpsCommand from '@features/games/rps/commands/rps.js';
import { initializeRps } from '@features/games/rps/manager.js';
import tttCommands from '@features/games/tictactoe/commands/tictactoe.js';
import { initializeTicTacToe } from '@features/games/tictactoe/manager.js';
import * as mc from '@minecraft/server';

const [tttCommand] = tttCommands;

const createMockPlayer = (id: string, name: string) => {
  const messages: string[] = [];
  const player = {
    id,
    name,
    isValid: true,
    location: { x: 0, y: 0, z: 0 },
    sendMessage: mock((msg: string) => {
      messages.push(msg);
    }),
    playSound: mock(),
    _messages: messages,
  };
  Object.setPrototypeOf(player, mc.Player.prototype);
  return player as unknown as mc.Player & { _messages: string[] };
};

describe('Game Challenge Target Resolution Deduplication', () => {
  let p1: ReturnType<typeof createMockPlayer>;
  let p2: ReturnType<typeof createMockPlayer>;

  beforeEach(async () => {
    await initializeConfigManager(false);
    clearPlayerCache();
    cleanupPlayerDataManager();
    _clearMatchmakingForTest();
    initializeMatchmaking();
    initializeTicTacToe();
    initializeRps();
    initializeCoinFlip();
    initializeConnect4();

    p1 = createMockPlayer('p1', 'Alice');
    p2 = createMockPlayer('p2', 'Bob');

    addPlayerToCache(p1);
    addPlayerToCache(p2);
    getOrCreatePlayer(p1);
    getOrCreatePlayer(p2);

    saveGamesConfig({
      ...getGamesConfig(),
      ticTacToe: {
        ...getGamesConfig().ticTacToe,
        requireFriends: false,
      },
    });
  });

  afterEach(() => {
    clearPlayerCache();
    cleanupPlayerDataManager();
    _clearMatchmakingForTest();
  });

  describe('Tic-Tac-Toe (/ttt)', () => {
    it('rejects self challenge via @s', async () => {
      await tttCommand.execute(p1, { actionOrFriend: '@s' });
      expect(p1._messages).toContain('§cYou cannot challenge yourself.');
    });

    it('rejects self challenge via username', async () => {
      await tttCommand.execute(p1, { actionOrFriend: 'Alice' });
      expect(p1._messages).toContain('§cYou cannot challenge yourself.');
    });

    it('rejects missing or offline player', async () => {
      await tttCommand.execute(p1, { actionOrFriend: 'UnknownPlayer' });
      expect(p1._messages).toContain('§cPlayer not found.');
    });

    it('rejects mass selectors @a and @e', async () => {
      await tttCommand.execute(p1, { actionOrFriend: '@a' });
      expect(p1._messages).toContain('§cSelectors @a and @e are disabled for this command.');
    });

    it('successfully challenges an online opponent', async () => {
      await tttCommand.execute(p1, { actionOrFriend: 'Bob' });
      expect(p1._messages.some((m) => m.includes('invitation to §eBob'))).toBe(true);
    });
  });

  describe('Rock Paper Scissors (/rps)', () => {
    it('rejects self challenge via @s', async () => {
      await rpsCommand.execute(p1, { actionOrFriend: '@s' });
      expect(p1._messages).toContain('§cYou cannot challenge yourself.');
    });

    it('rejects self challenge via username', async () => {
      await rpsCommand.execute(p1, { actionOrFriend: 'Alice' });
      expect(p1._messages).toContain('§cYou cannot challenge yourself.');
    });

    it('rejects missing or offline player', async () => {
      await rpsCommand.execute(p1, { actionOrFriend: 'UnknownPlayer' });
      expect(p1._messages).toContain('§cPlayer not found.');
    });

    it('rejects mass selector @a', async () => {
      await rpsCommand.execute(p1, { actionOrFriend: '@a' });
      expect(p1._messages).toContain('§cSelectors @a and @e are disabled for this command.');
    });

    it('successfully challenges an online opponent', async () => {
      await rpsCommand.execute(p1, { actionOrFriend: 'Bob' });
      expect(p1._messages.some((m) => m.includes('invitation to §eBob'))).toBe(true);
    });
  });

  describe('Coin Flip (/coinflip)', () => {
    it('rejects self challenge via @s', async () => {
      await coinFlipCommand.execute(p1, { sideOrTarget: '@s' });
      expect(p1._messages).toContain('§cYou cannot challenge yourself.');
    });

    it('rejects self challenge via username', async () => {
      await coinFlipCommand.execute(p1, { sideOrTarget: 'Alice' });
      expect(p1._messages).toContain('§cYou cannot challenge yourself.');
    });

    it('rejects missing or offline player', async () => {
      await coinFlipCommand.execute(p1, { sideOrTarget: 'UnknownPlayer' });
      expect(p1._messages).toContain('§cPlayer not found.');
    });

    it('rejects mass selector @a', async () => {
      await coinFlipCommand.execute(p1, { sideOrTarget: '@a' });
      expect(p1._messages).toContain('§cSelectors @a and @e are disabled for this command.');
    });

    it('successfully challenges an online opponent', async () => {
      await coinFlipCommand.execute(p1, { sideOrTarget: 'Bob' });
      expect(p1._messages.some((m) => m.includes('invitation to §eBob'))).toBe(true);
    });
  });

  describe('Connect 4 (/connect4)', () => {
    it('rejects self challenge via @s', async () => {
      await connect4Command.execute(p1, { actionOrFriend: '@s' });
      expect(p1._messages).toContain('§cYou cannot challenge yourself.');
    });

    it('rejects self challenge via username', async () => {
      await connect4Command.execute(p1, { actionOrFriend: 'Alice' });
      expect(p1._messages).toContain('§cYou cannot challenge yourself.');
    });

    it('rejects missing or offline player', async () => {
      await connect4Command.execute(p1, { actionOrFriend: 'UnknownPlayer' });
      expect(p1._messages).toContain('§cPlayer not found.');
    });

    it('rejects mass selector @a', async () => {
      await connect4Command.execute(p1, { actionOrFriend: '@a' });
      expect(p1._messages).toContain('§cSelectors @a and @e are disabled for this command.');
    });

    it('successfully challenges an online opponent', async () => {
      await connect4Command.execute(p1, { actionOrFriend: 'Bob' });
      expect(p1._messages.some((m) => m.includes('invitation to §eBob'))).toBe(true);
    });
  });
});
