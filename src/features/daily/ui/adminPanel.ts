import { getConfig, updateMultipleConfig } from '@core/configManager.js';
import { getDailyRewardsConfig, saveDailyRewardsConfig } from '@core/configurations.js';
import { DailyReward } from '@features/daily/dailyRewardsConfig.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/CustomFormBuilder.js';

export async function showDailyRewardsAdminPanel(player: mc.Player): Promise<void> {
    const config = getDailyRewardsConfig();
    const mainConfig = getConfig();
    const isEnabled = config.enabled && mainConfig.dailyRewards.enabled;

    const form = new ActionFormBuilder()
        .title('Daily Rewards Manager')
        .body(`Cooldown: ${config.claimCooldownHours}h | Streak Reset: ${config.streakResetHours}h | Days Configured: ${config.rewards.length}`)
        .button(isEnabled ? '§2Daily Rewards: ENABLED' : '§4Daily Rewards: DISABLED', isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel', async () => {
            const nextState = !isEnabled;
            config.enabled = nextState;
            saveDailyRewardsConfig(config);
            updateMultipleConfig({ 'dailyRewards.enabled': nextState });
            player.sendMessage(`§aDaily rewards ${nextState ? 'enabled' : 'disabled'}.`);
            await showDailyRewardsAdminPanel(player);
        })
        .button('§6Cooldown & Streak Settings', 'textures/ui/icon_setting', async () => {
            const modal = new CustomFormBuilder<{ cooldown: string; streakReset: string }>('Daily Rewards Timing')
                .textField('cooldown', 'Claim Cooldown (Hours)', '24', String(config.claimCooldownHours))
                .textField('streakReset', 'Streak Reset Window (Hours)', '48', String(config.streakResetHours))
                .submitButton('Save');
            const res = await modal.show(player);
            if (res) {
                const cd = Number.parseFloat(res.cooldown);
                const sr = Number.parseFloat(res.streakReset);
                if (!Number.isNaN(cd) && cd > 0) {
                    config.claimCooldownHours = cd;
                }
                if (!Number.isNaN(sr) && sr > 0) {
                    config.streakResetHours = sr;
                }
                saveDailyRewardsConfig(config);
                player.sendMessage('§aDaily rewards timing updated.');
            }
            await showDailyRewardsAdminPanel(player);
        })
        .button('§2+ Add Reward Day', 'textures/ui/color_plus', async () => {
            const nextDay = config.rewards.reduce((max, r) => Math.max(max, r.day), 0) + 1;
            config.rewards.push({
                day: nextDay,
                money: 100 * nextDay,
                message: `Day ${nextDay}: $${100 * nextDay}`
            });
            saveDailyRewardsConfig(config);
            await showEditDailyRewardDayPanel(player, config.rewards.length - 1);
        });

    config.rewards.sort((a, b) => a.day - b.day);
    config.rewards.forEach((reward, idx) => {
        const itemCount = reward.items?.length ?? 0;
        const summary = `Day ${reward.day}: $${reward.money ?? 0}${reward.xp ? ` + ${reward.xp} XP` : ''}${itemCount > 0 ? ` + ${itemCount} item(s)` : ''}\n§7${reward.message}`;
        form.button(summary, 'textures/ui/gift_square', async () => {
            await showEditDailyRewardDayPanel(player, idx);
        });
    });

    form.addBackButton(async () => {
        const { showConfigCategoryDetailPanel } = await import('@core/ui/panels/configPanel.js');
        await showConfigCategoryDetailPanel(player, 'Economy');
    });

    await form.show(player);
}

export async function showEditDailyRewardDayPanel(player: mc.Player, index: number): Promise<void> {
    const config = getDailyRewardsConfig();
    const reward = config.rewards[index];
    if (!isDefined(reward)) {
        await showDailyRewardsAdminPanel(player);
        return;
    }

    const itemCount = reward.items?.length ?? 0;
    const form = new ActionFormBuilder()
        .title(`Manage Day ${reward.day} Reward`)
        .body(
            [
                `§7Day: §f${reward.day}`,
                `§7Money: §a$${reward.money ?? 0} §8| §7XP Levels: §b${reward.xp ?? 0}`,
                `§7Command: §e${reward.command || 'None'}`,
                `§7Message: §r${reward.message}`,
                `§7Items: §f${itemCount}`
            ].join('\n')
        )
        .button('Edit Reward Values', 'textures/ui/book_edit_default', async () => {
            await showEditDailyRewardModal(player, index);
        })
        .button(`Manage Items (${itemCount})`, 'textures/ui/inventory_icon', async () => {
            await showDailyRewardItemsPanel(player, index);
        })
        .button('§4Delete Day Reward', 'textures/ui/trash', async () => {
            config.rewards.splice(index, 1);
            saveDailyRewardsConfig(config);
            player.sendMessage('§aDeleted daily reward tier.');
            await showDailyRewardsAdminPanel(player);
        });

    form.addBackButton(async () => {
        await showDailyRewardsAdminPanel(player);
    });

    await form.show(player);
}

async function showEditDailyRewardModal(player: mc.Player, index: number): Promise<void> {
    const config = getDailyRewardsConfig();
    const reward: DailyReward | undefined = config.rewards[index];
    if (!isDefined(reward)) {
        await showDailyRewardsAdminPanel(player);
        return;
    }

    const modal = new CustomFormBuilder<{
        day: string;
        money: string;
        xp: string;
        command: string;
        message: string;
    }>(`Edit Day ${reward.day} Values`)
        .textField('day', 'Day Number', '1', String(reward.day))
        .textField('money', 'Money Reward (0 for none)', '100', String(reward.money ?? 0))
        .textField('xp', 'XP Levels (0 for none)', '0', String(reward.xp ?? 0))
        .textField('command', 'Console Command (Optional, use {player})', '', reward.command ?? '')
        .textField('message', 'Claim Message', 'Day 1: $100', reward.message)
        .submitButton('Save');

    const res = await modal.show(player);
    if (!res) {
        await showEditDailyRewardDayPanel(player, index);
        return;
    }

    const dayNum = Number.parseInt(res.day, 10);
    const moneyNum = Number.parseFloat(res.money);
    const xpNum = Number.parseInt(res.xp, 10);

    if (!Number.isNaN(dayNum) && dayNum > 0) {
        reward.day = dayNum;
    }
    reward.money = !Number.isNaN(moneyNum) && moneyNum > 0 ? moneyNum : undefined;
    reward.xp = !Number.isNaN(xpNum) && xpNum > 0 ? xpNum : undefined;
    reward.command = isNonEmptyString(res.command.trim()) ? res.command.trim() : undefined;
    if (isNonEmptyString(res.message.trim())) {
        reward.message = res.message.trim();
    }

    saveDailyRewardsConfig(config);
    player.sendMessage('§aUpdated daily reward values.');
    await showEditDailyRewardDayPanel(player, index);
}

async function showDailyRewardItemsPanel(player: mc.Player, index: number): Promise<void> {
    const config = getDailyRewardsConfig();
    const reward = config.rewards[index];
    if (!isDefined(reward)) {
        await showDailyRewardsAdminPanel(player);
        return;
    }

    if (!reward.items) {
        reward.items = [];
    }

    const form = new ActionFormBuilder()
        .title(`Day ${reward.day} Items`)
        .button('§2+ Add Item (Manual)', 'textures/ui/color_plus', async () => {
            const modal = new CustomFormBuilder<{ typeId: string; amount: string; name: string }>('Add Reward Item')
                .textField('typeId', 'Item ID', MinecraftItemTypes.Diamond, MinecraftItemTypes.Diamond)
                .textField('amount', 'Amount', '1', '1')
                .textField('name', 'Custom Display Name (Optional)', '', '')
                .submitButton('Add Item');
            const res = await modal.show(player);
            if (res && isNonEmptyString(res.typeId.trim())) {
                const amt = Number.parseInt(res.amount, 10);
                reward.items!.push({
                    typeId: res.typeId.trim(),
                    amount: Number.isNaN(amt) || amt <= 0 ? 1 : amt,
                    ...(isNonEmptyString(res.name.trim()) ? { name: res.name.trim() } : {})
                });
                saveDailyRewardsConfig(config);
                player.sendMessage('§aAdded item to daily reward.');
            }
            await showDailyRewardItemsPanel(player, index);
        })
        .button('§6+ Add Held Item From Hand', 'textures/ui/inventory_icon', async () => {
            const inv = player.getComponent(EntityComponentTypes.Inventory)?.container;
            const held = inv?.getItem(player.selectedSlotIndex);
            if (!held) {
                player.sendMessage('§cYou are not holding an item in your main hand.');
            } else {
                reward.items!.push({
                    typeId: held.typeId,
                    amount: held.amount,
                    ...(isNonEmptyString(held.nameTag) ? { name: held.nameTag } : {})
                });
                saveDailyRewardsConfig(config);
                player.sendMessage(`§aAdded ${held.typeId} x${held.amount} to Day ${reward.day}.`);
            }
            await showDailyRewardItemsPanel(player, index);
        });

    reward.items.forEach((item, itemIdx) => {
        form.button(`${item.typeId.replace(/^minecraft:/, '')} x${item.amount}${item.name ? ` (${item.name})` : ''}\n§cClick to remove`, 'textures/ui/trash', async () => {
            reward.items!.splice(itemIdx, 1);
            saveDailyRewardsConfig(config);
            player.sendMessage('§aRemoved item.');
            await showDailyRewardItemsPanel(player, index);
        });
    });

    form.addBackButton(async () => {
        await showEditDailyRewardDayPanel(player, index);
    });

    await form.show(player);
}
