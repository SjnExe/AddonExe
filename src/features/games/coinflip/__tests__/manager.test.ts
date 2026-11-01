import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { initializeConfigManager, updateMultipleConfig } from '@core/config/configManager.js';
import { clearPlayerCache } from '@core/data/playerCache.js';
import {
  cleanupPlayerDataManager,
  getBalance,
  getOrCreatePlayer,
  setPlayerBalance,
} from '@core/data/playerDataManager.js';
import { _clearAfkForTest, isPlayerAfk, togglePlayerAfk } from '@features/essentials/afk/manager.js';
import {
  broadcastRandomCoinFlip,
  initializeCoinFlip,
  playSoloWagerCoinFlip,
  runTwoPlayerCoinFlipMatch,
} from '@features/games/coinflip/manager.js';
import {
  _clearMailForTest,
  getPlayerInbox,
  getUnreadMailCount,
  sendMailToPlayer,
} from '@features/social/mail/manager.js';
import * as mc from '@minecraft/server';

const createMockPlayer = (id: string, name: string) =>
  ({
    id,
    name,
    isValid: true,
    sendMessage: mock(),
    playSound: mock(),
  }) as unknown as mc.Player;

describe('CoinFlip, 2P Wager Tax, AFK & Mail Systems', () => {
  beforeEach(async () => {
    await initializeConfigManager(false);
    clearPlayerCache();
    cleanupPlayerDataManager();
    _clearAfkForTest();
    _clearMailForTest();
    initializeCoinFlip();
  });

  it('broadcasts random coin flip in chat with player name', () => {
    const p1 = createMockPlayer('cf_p1', 'Shajahan');
    getOrCreatePlayer(p1);

    const res = broadcastRandomCoinFlip(p1);
    expect(res.success).toBe(true);
    expect(res.result === 'heads' || res.result === 'tails').toBe(true);
    expect(mc.world.sendMessage).toHaveBeenCalledWith(expect.stringContaining('Shajahan'));
  });

  it('handles solo wager and 2P taxed pot coin flip accurately', () => {
    updateMultipleConfig({ 'economy.enabled': true });
    const p1 = createMockPlayer('cf_solo1', 'Alice');
    const p2 = createMockPlayer('cf_solo2', 'Bob');
    getOrCreatePlayer(p1);
    getOrCreatePlayer(p2);
    setPlayerBalance(p1.id, 200);
    setPlayerBalance(p2.id, 200);

    const soloRes = playSoloWagerCoinFlip(p1, 'heads', 50);
    expect(soloRes.success).toBe(true);
    if (soloRes.won) {
      expect(getBalance(p1.id)).toBe(250);
    } else {
      expect(getBalance(p1.id)).toBe(150);
    }

    setPlayerBalance(p1.id, 100);
    setPlayerBalance(p2.id, 100);
    // 2P wager of 100 each => 200 pot, 5% default tax => winner receives 190 (net balance 190)
    const matchRes = runTwoPlayerCoinFlipMatch(p1, p2, 100);
    expect(matchRes.success).toBe(true);
    expect(matchRes.netPayout).toBe(190);
    const totalAfter = (getBalance(p1.id) ?? 0) + (getBalance(p2.id) ?? 0);
    expect(totalAfter).toBe(190);
  });

  it('toggles AFK state and sends/reads offline mail when enabled', () => {
    updateMultipleConfig({ 'afk.enabled': true, 'mail.enabled': true });
    const p1 = createMockPlayer('mail_p1', 'Sender');
    const p2 = createMockPlayer('mail_p2', 'Receiver');
    getOrCreatePlayer(p1);
    getOrCreatePlayer(p2);

    expect(togglePlayerAfk(p1, 'Lunch')).toBe(true);
    expect(isPlayerAfk(p1.id)).toBe(true);
    expect(togglePlayerAfk(p1)).toBe(false);
    expect(isPlayerAfk(p1.id)).toBe(false);

    const mailRes = sendMailToPlayer(p1, 'Receiver', 'Meet at spawn shop!');
    expect(mailRes.success).toBe(true);
    expect(getUnreadMailCount(p2.id)).toBe(1);
    expect(getPlayerInbox(p2.id)[0]?.message).toBe('Meet at spawn shop!');
  });
});
