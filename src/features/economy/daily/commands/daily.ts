import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getDailyRewardsConfig } from '@core/config/configurations.js';
import { dailyDisabled } from '@core/utils/constants.js';
import { sendMessage } from '@core/utils/messaging.js';
import { claimDailyReward } from '@features/economy/daily/manager.js';
import * as mc from '@minecraft/server';

const dailyCommand: CustomCommand = {
  name: 'daily',
  aliases: ['reward'],
  description: 'Claim your daily reward.',
  category: 'Economy',
  permissionNode: 'cmd.daily.member',
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const config = getDailyRewardsConfig();
    if (!config.enabled) {
      sendMessage(dailyDisabled, executor);
      return;
    }

    const result = claimDailyReward(executor);
    sendMessage(result.message, executor);

    if (!result.success && result.message.includes('already claimed')) {
      // Optional: Show status?
    }
  },
};

export default [dailyCommand];
