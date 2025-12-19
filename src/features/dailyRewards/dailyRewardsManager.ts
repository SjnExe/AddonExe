import * as mc from '@minecraft/server';

import { getDailyRewardsConfig } from '@core/configurations.js';
import { errorLog } from '@core/logger.js';
import { getOrCreatePlayer, incrementPlayerBalance, updatePlayerData } from '@core/playerDataManager.js';
import { formatDuration } from '@core/utils.js';

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
    // 1-based index in config, so map appropriately
    // Logic: If rewards go up to Day 7, Day 8 loops to Day 1? Or we check if explicit day exists?
    // Let's cycle based on the number of defined rewards.
    // If we have rewards for Day 1, 2, 7.
    // Length is not sufficient if days are sparse.
    // Assuming config.rewards is sorted or we find by .day

    const rewardCount = config.rewards.length;
    if (rewardCount === 0) {
        return { success: false, message: '§cNo rewards configured.' };
    }

    // Effective day for reward lookup (1-based cycle)
    // (streak - 1) % count + 1
    const cycleDay = ((streak - 1) % rewardCount) + 1;

    // Find matching reward definition (allowing for sparse arrays or explicit days if user configured oddly)
    // We try to find match for cycleDay. If not found, find match for streak (one-time rewards?).
    // Simplest: Find reward where r.day == cycleDay.
    const reward = config.rewards.find((r) => r.day === cycleDay) || config.rewards[0]; // Fallback to first

    if (!reward) {
        return { success: false, message: '§cConfiguration error: No reward found.' };
    }

    // Grant Reward
    try {
        if (reward.money && reward.money > 0) {
            incrementPlayerBalance(player.id, reward.money);
        }

        if (reward.xp && reward.xp > 0) {
            player.addLevels(reward.xp);
        }

        if (reward.command) {
            // Execute as server
            const cmd = reward.command.replaceAll('{player}', `"${player.name}"`);
            player.dimension.runCommand(cmd);
        }

        if (reward.items && reward.items.length > 0) {
            const inventory = player.getComponent('inventory') as mc.EntityInventoryComponent;
            if (inventory && inventory.container) {
                for (const itemDef of reward.items) {
                    try {
                        const itemStack = new mc.ItemStack(itemDef.typeId, itemDef.amount);
                        if (itemDef.name) itemStack.nameTag = itemDef.name;
                        const leftovers = inventory.container.addItem(itemStack);
                        if (leftovers) {
                            player.dimension.spawnItem(leftovers, player.location);
                            player.sendMessage('§eInventory full. Item dropped on ground.');
                        }
                    } catch (e) {
                        errorLog(`[DailyRewards] Failed to give item ${itemDef.typeId}: ${String(e)}`);
                    }
                }
            }
        }

        // Update Data
        updatePlayerData(player.id, (d) => {
            d.lastDailyClaim = now;
            d.dailyStreak = streak;
        });

        return {
            success: true,
            message: `§aDaily Reward Claimed! (Streak: ${streak})\n§r${reward.message}`
        };
    } catch (e) {
        errorLog(`[DailyRewards] Error granting reward: ${String(e)}`);
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
