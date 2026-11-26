import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { Player } from '@core/__tests__/__mocks__/minecraftMock.js';
import * as configManager from '@core/config/configManager.js';
import {
  _clearIgnoresForTest,
  getIgnoredPlayerIds,
  isPlayerIgnored,
  toggleIgnorePlayer,
} from '@features/social/ignore/manager.js';
import { _clearNicknamesForTest, getDisplayPlayerName, setPlayerNickname } from '@features/social/nick/manager.js';

describe('Social Ignore & Nicknames', () => {
  beforeEach(() => {
    _clearIgnoresForTest();
    _clearNicknamesForTest();
  });

  afterEach(() => {
    _clearIgnoresForTest();
    _clearNicknamesForTest();
  });

  it('toggles ignore state and respects disabled default', () => {
    const cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      ignore: { enabled: false, maxIgnoredPerPlayer: 50 },
      nick: { enabled: false, maxLength: 20, allowColors: false },
    } as any);

    expect(toggleIgnorePlayer('p1', 'p2', 'Bob').ignored).toBe(false);

    cfgSpy.mockReturnValue({
      ignore: { enabled: true, maxIgnoredPerPlayer: 50 },
      nick: { enabled: true, maxLength: 20, allowColors: false },
    } as any);

    const res = toggleIgnorePlayer('p1', 'p2', 'Bob');
    expect(res.ignored).toBe(true);
    expect(isPlayerIgnored('p1', 'p2')).toBe(true);
    expect(getIgnoredPlayerIds('p1')).toEqual(['p2']);

    const unignore = toggleIgnorePlayer('p1', 'p2', 'Bob');
    expect(unignore.ignored).toBe(false);
    expect(isPlayerIgnored('p1', 'p2')).toBe(false);

    cfgSpy.mockRestore();
  });

  it('validates nickname length, strips colors when disallowed, and resets cleanly', () => {
    const cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      ignore: { enabled: false, maxIgnoredPerPlayer: 50 },
      nick: { enabled: true, maxLength: 12, allowColors: false },
    } as any);

    const p = new Player('p1', 'RealName') as any;
    expect(getDisplayPlayerName(p)).toBe('RealName');

    const tooShort = setPlayerNickname(p, 'A');
    expect(tooShort.success).toBe(false);

    const setRes = setPlayerNickname(p, '§cCoolNick');
    expect(setRes.success).toBe(true);
    expect(getDisplayPlayerName(p)).toBe('CoolNick');

    const resetRes = setPlayerNickname(p, 'reset');
    expect(resetRes.success).toBe(true);
    expect(getDisplayPlayerName(p)).toBe('RealName');

    cfgSpy.mockRestore();
  });
});
