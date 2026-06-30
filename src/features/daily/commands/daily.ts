import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getDailyRewardsConfig } from '@core/configurations.js';
import { sendMessage } from '@core/messaging.js';

import { claimDailyReward } from '@features/daily/manager.js';

const dailyCommand: CustomCommand = {
    name: 'daily',
    aliases: ['reward'],
    description: 'Claim your daily reward.',
    category: 'Economy',
    permissionNode: 'cmd.daily.member',
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) return;

        const config = getDailyRewardsConfig();
        if (!config.enabled) {
            sendMessage('§cThe Daily Rewards system is currently disabled globally.', executor);
            return;
        }

        const result = claimDailyReward(executor);
        sendMessage(result.message, executor);

        if (!result.success && result.message.includes('already claimed')) {
            // Optional: Show status?
        }
    }
};

export default [dailyCommand];
