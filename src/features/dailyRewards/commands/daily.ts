import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { sendMessage } from '@core/messaging.js';

import { claimDailyReward } from '../dailyRewardsManager.js';

const dailyCommand: CustomCommand = {
    name: 'daily',
    aliases: ['reward'],
    description: 'Claim your daily reward.',
    category: 'Economy',
    permissionLevel: 1024,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) return;

        const result = claimDailyReward(executor);
        sendMessage(result.message, executor);

        if (!result.success && result.message.includes('already claimed')) {
             // Optional: Show status?
        }
    }
};

export default [dailyCommand];
