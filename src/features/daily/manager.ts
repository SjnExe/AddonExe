import * as mc from '@minecraft/server';

import { getDailyRewardsConfig } from '@core/configurations.js';
import { errorLog } from '@core/logger.js';
import { getOrCreatePlayer, incrementPlayerBalance, savePlayerData, updatePlayerData } from '@core/playerDataManager.js';
import { formatDuration } from '@core/utils.js';
import { isDefined, isNonEmptyString, isNumber } from '@lib/guards.js';

export interface ClaimResult {
    success: boolean;
    message: string;
}

export function claimDailyReward(player: mc.Player): ClaimResult {
    const config = getDailyRewardsConfig();

    if (!config.enabled) {
        return { success: false, message: '§cDaily rewards are disabled.' };
    }

    const pData = getOrCreatePlayer(player);
    const now = Date.now();
    const lastClaim = pData.lastDailyClaim || 0;
    const timeSince = now - lastClaim;
    const cooldownMs = config.claimCooldownHours * 3_600_000;
    const resetMs = config.streakResetHours * 3_600_000;

    // Check cooldown
    if (timeSince < cooldownMs) {
        const remaining = cooldownMs - timeSince;
        return {
            success: false,
            message: `§cYou have already claimed your daily reward. Come back in ${formatDuration(remaining)}.`
        };
    }

    let streak = pData.dailyStreak || 0;

    // Check streak reset
    if (timeSince > resetMs && lastClaim > 0) {
        streak = 1; // Reset
        player.sendMessage('§eYou missed a day! Your streak has been reset.');
    } else {
        streak++;
    }

    // Determine Reward
    const rewardCount = config.rewards.length;
    if (rewardCount === 0) {
        return { success: false, message: '§cNo rewards configured.' };
    }

    // Effective day for reward lookup (1-based cycle)
    const cycleDay = ((streak - 1) % rewardCount) + 1;

    // Find matching reward definition
    const reward = config.rewards.find((r) => r.day === cycleDay) || config.rewards[0]; // Fallback to first

    if (!isDefined(reward)) {
        return { success: false, message: '§cConfiguration error: No reward found.' };
    }

    // Grant Reward
    try {
        // Update Data first to prevent claim loop on crash
        updatePlayerData(player.id, (d) => {
            d.lastDailyClaim = now;
            d.dailyStreak = streak;
        });
        savePlayerData(player.id);

        if (isNumber(reward.money) && reward.money > 0) {
            incrementPlayerBalance(player.id, reward.money);
            savePlayerData(player.id);
        }

        if (isNumber(reward.xp) && reward.xp > 0) {
            player.addLevels(reward.xp);
        }

        if (isNonEmptyString(reward.command)) {
            // Execute as server
            const safeName = player.name.replaceAll('\\', '').replaceAll('"', '');
            const cmd = reward.command.replaceAll('{player}', `"${safeName}"`);
            player.dimension.runCommand(cmd);
        }

        if (isDefined(reward.items) && reward.items.length > 0) {
            const inventory = player.getComponent('inventory') as mc.EntityInventoryComponent;
            if (isDefined(inventory) && isDefined(inventory.container)) {
                for (const itemDef of reward.items) {
                    try {
                        const itemStack = new mc.ItemStack(itemDef.typeId, itemDef.amount);
                        if (isNonEmptyString(itemDef.name)) itemStack.nameTag = itemDef.name;
                        const leftovers = inventory.container.addItem(itemStack);
                        if (leftovers) {
                            player.dimension.spawnItem(leftovers, player.location);
                            player.sendMessage('§eInventory full. Item dropped on ground.');
                        }
                    } catch (error) {
                        errorLog(`[DailyRewards] Failed to give item ${itemDef.typeId}: ${String(error)}`);
                    }
                }
            }
        }

        return {
            success: true,
            message: `§aDaily Reward Claimed! (Streak: ${streak})\n§r${reward.message}`
        };
    } catch (error) {
        errorLog(`[DailyRewards] Error granting reward: ${String(error)}`);
        return { success: false, message: '§cAn error occurred while claiming your reward.' };
    }
}

export function getNextRewardInfo(player: mc.Player): string {
    const config = getDailyRewardsConfig();
    const pData = getOrCreatePlayer(player);
    const now = Date.now();
    const lastClaim = pData.lastDailyClaim || 0;
    const timeSince = now - lastClaim;
    const cooldownMs = config.claimCooldownHours * 3_600_000;

    if (timeSince < cooldownMs) {
        return `§7Next reward in: ${formatDuration(cooldownMs - timeSince)}`;
    }
    return `§aReward available now!`;
}
