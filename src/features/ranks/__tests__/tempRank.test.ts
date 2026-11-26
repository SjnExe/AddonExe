import { afterEach, describe, expect, it, spyOn } from 'bun:test';

import * as configManager from '@core/config/configManager.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import * as rankManager from '@core/permissions/rankManager.js';
import { grantTempRank, parseTempRankDuration, pruneExpiredTempRanks } from '@features/ranks/tempRankManager.js';

describe('TempRank Subsystem', () => {
  const spies: Array<ReturnType<typeof spyOn>> = [];

  afterEach(() => {
    while (spies.length > 0) {
      spies.pop()?.mockRestore();
    }
  });

  it('parseTempRankDuration parses valid units and rejects invalid strings', () => {
    expect(parseTempRankDuration('30s')).toBe(30_000);
    expect(parseTempRankDuration('15m')).toBe(15 * 60_000);
    expect(parseTempRankDuration('2h')).toBe(2 * 3_600_000);
    expect(parseTempRankDuration('3d')).toBe(3 * 86_400_000);
    expect(parseTempRankDuration('0m')).toBeUndefined();
    expect(parseTempRankDuration('-5h')).toBeUndefined();
    expect(parseTempRankDuration('abc')).toBeUndefined();
  });

  it('grantTempRank adds temporary rank and pruneExpiredTempRanks revokes it on expiration', () => {
    let storedRanks = ['member'];
    const setRanksSpy = spyOn(playerDataManager, 'setPlayerRanks').mockImplementation((_id: string, next: string[]) => {
      storedRanks = next;
      return true;
    });
    spies.push(
      spyOn(configManager, 'getConfig').mockReturnValue({
        playerDefaults: { rankId: 'member' },
      } as any),
      spyOn(playerDataManager, 'getPlayer').mockImplementation(() => ({ ranks: storedRanks }) as any),
      setRanksSpy,
      spyOn(rankManager, 'updatePlayerNameTag').mockImplementation(() => {}),
    );

    const nowSpy = spyOn(Date, 'now').mockReturnValue(1_000_000);
    spies.push(nowSpy);

    expect(grantTempRank('tr-p1', 'vip', 60_000)).toBe(true);
    expect(storedRanks).toEqual(['member', 'vip']);
    expect(setRanksSpy).toHaveBeenCalledTimes(1);
    expect(setRanksSpy).toHaveBeenNthCalledWith(1, 'tr-p1', ['member', 'vip']);

    // Should not overwrite a pre-existing permanent rank
    expect(grantTempRank('tr-p1', 'member', 60_000)).toBe(false);

    // Not expired yet
    nowSpy.mockReturnValue(1_030_000);
    pruneExpiredTempRanks();
    expect(storedRanks).toEqual(['member', 'vip']);
    expect(setRanksSpy).toHaveBeenCalledTimes(1);

    // Expired
    nowSpy.mockReturnValue(1_060_001);
    pruneExpiredTempRanks();
    expect(storedRanks).toEqual(['member']);
    expect(setRanksSpy).toHaveBeenCalledTimes(2);
    expect(setRanksSpy).toHaveBeenNthCalledWith(2, 'tr-p1', ['member']);
  });
});
