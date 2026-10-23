import { commandManager } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import * as configs from '@core/config/configurations.js';
import { getBalance, getOrCreatePlayer, setPlayerBalance, transfer } from '@core/data/playerDataManager.js';
import { getRankById } from '@core/permissions/rankManager.js';
import { featureRegistry } from '@core/services/featureRegistry.js';
import * as mc from '@minecraft/server';

import { addTest, assert } from '../testRunner.js';

const SUITE_NAME = 'runtime';

export function registerCoreTests(): void {
  addTest(SUITE_NAME, 'Live configs, topological feature registry, ranks, and slash commands are active', () => {
    assert.ok(
      getConfig() && configs.getEconomyConfig() && configs.getShopConfig() && configs.getRanksConfig(),
      'Core configs missing',
    );
    assert.ok(
      configs.getXrayConfig() && configs.getTeamConfig() && configs.getFriendConfig() && configs.getSidebarConfig(),
      'Feature configs missing',
    );
    assert.ok(
      configs.getAuctionHouseConfig() && configs.getDailyRewardsConfig() && configs.getWorldProtectionConfig(),
      'World/Eco configs missing',
    );
    assert.ok(
      configs.getGamesConfig() && configs.getWordleConfig() && configs.getAnticheatConfig(),
      'Game/AC configs missing',
    );

    const seen = new Set<string>();
    for (const feat of featureRegistry) {
      for (const dep of feat.dependencies) {
        assert.ok(seen.has(dep), `Feature '${feat.id}' loaded before dependency '${dep}'`);
      }
      seen.add(feat.id);
    }

    const owner = getRankById('owner');
    const member = getRankById('member');
    assert.ok(owner && member && owner.priority < member.priority, 'Core owner/member rank hierarchy invalid');
    assert.ok(commandManager.getAllCommands().length > 20, 'Slash commands failed to register');
  });

  addTest(SUITE_NAME, 'Live player data and economy transfer guard against invalid mutations', () => {
    const player = mc.world.getAllPlayers()[0];
    if (!player) {
      return;
    }

    getOrCreatePlayer(player);
    const pId = player.id;
    const originalBalance = getBalance(pId) ?? 0;

    try {
      setPlayerBalance(pId, 500);
      assert.equal(transfer(pId, 'dummy_offline_target', 0).success, false, 'Should reject 0 transfer');
      assert.equal(transfer(pId, 'dummy_offline_target', -50).success, false, 'Should reject negative transfer');
      assert.equal(
        transfer(pId, 'dummy_offline_target', 10_000).success,
        false,
        'Should reject insufficient balance transfer',
      );
      assert.equal(getBalance(pId), 500, 'Balance mutated on rejected transfer');
    } finally {
      setPlayerBalance(pId, originalBalance);
    }
  });
}
