import { commandManager } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import * as configs from '@core/config/configurations.js';

import { addTest, assert } from '../testRunner.js';

const suiteName = 'runtime';

export function registerCoreTests(): void {
  addTest(suiteName, 'Live world configurations and native slash commands are initialized', () => {
    assert.ok(
      getConfig() &&
        configs.getEconomyConfig() &&
        configs.getShopConfig() &&
        configs.getRanksConfig() &&
        configs.getXrayConfig() &&
        configs.getTeamConfig() &&
        configs.getFriendConfig() &&
        configs.getSidebarConfig() &&
        configs.getAuctionHouseConfig() &&
        configs.getDailyRewardsConfig() &&
        configs.getWorldProtectionConfig() &&
        configs.getGamesConfig() &&
        configs.getWordleConfig() &&
        configs.getAnticheatConfig(),
      'One or more live world configurations failed to initialize',
    );
    assert.ok(commandManager.getAllCommands().length > 20, 'Slash commands failed to register');
  });
}
