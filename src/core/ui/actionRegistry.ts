/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { banPlayer, offlineBanPlayer, unbanPlayer } from '../../features/moderation/commands/ban.js';
import { freezePlayer, unfreezePlayer } from '../../features/moderation/commands/freeze.js';
import { kickPlayer } from '../../features/moderation/commands/kick.js';
import { mutePlayer, unmutePlayer } from '../../features/moderation/commands/mute.js';
import * as reportManager from '../../features/moderation/reportManager.js';
import * as tpaManager from '../../features/teleportation/tpaManager.js';
import * as bountyManager from '../bountyManager.js';
import { getConfig } from '../configManager.js';
import * as helpfulLinksManager from '../helpfulLinksManager.js';
import * as playerCache from '../playerCache.js';
import { getOrCreatePlayer, incrementPlayerBalance } from '../playerDataManager.js';
import * as rulesManager from '../rulesManager.js';
import { showPanel } from '../uiManager.js';
import * as utils from '../utils.js';
import { formatCurrency } from '../utils.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UIContext = Record<string, any>;

export const uiActionFunctions: Record<
    string,
    (player: mc.Player, context: UIContext, panelId: string) => void | Promise<void | boolean>
> = {
    showRules: async (player: mc.Player) => {
        const rules = rulesManager.getRules();
        const pData = getOrCreatePlayer(player);

        const rulesForm = new ActionFormData().title('§l§6Server Rules').body(rules.join('\n'));

        if (pData && pData.permissionLevel <= 1) {
            rulesForm.button('§l§4Edit Rules', 'textures/ui/icon_setting');
        }

        rulesForm.button('§l§8Close', 'textures/ui/cancel');

        const response = await utils.uiWait(player, rulesForm);

        if (!response || response.canceled) {
            return;
        }

        if (pData && pData.permissionLevel <= 1 && (response as ActionFormResponse).selection === 0) {
            return showPanel(player, 'rulesManagementPanel');
        }
    },

    showHelpfulLinks: async (player: mc.Player) => {
        const links = helpfulLinksManager.getHelpfulLinks();
        const pData = getOrCreatePlayer(player);

        const form = new ActionFormData().title('§l§9Helpful Links');

        if (links.length === 0) {
            form.body('§cNo helpful links have been configured by the admin.');
        } else {
            const bodyText = links.map((link) => `§f${link.title}: §r${link.url}`).join('\n\n');
            form.body(bodyText);
        }

        if (pData && pData.permissionLevel <= 1) {
            form.button('§l§4Edit Links', 'textures/ui/icon_setting');
        }

        form.button('§l§8Close', 'textures/ui/cancel');

        const response = await utils.uiWait(player, form);

        if (!response || response.canceled) {
            return;
        }

        if (pData && pData.permissionLevel <= 1 && (response as ActionFormResponse).selection === 0) {
            return showPanel(player, 'helpfulLinksManagementPanel');
        }
    },

    assignReport: async (player: mc.Player, context: UIContext, panelId: string) => {
        reportManager.assignReport(context.targetReport.id, player.id);
        player.sendMessage(`§2Report ${context.targetReport.id} has been assigned to you.`);
        await showPanel(player, panelId, context);
    },

    resolveReport: async (player: mc.Player, context: UIContext) => {
        reportManager.resolveReport(context.targetReport.id);
        player.sendMessage(`§2Report ${context.targetReport.id} has been marked as resolved.`);
        await showPanel(player, 'reportListPanel');
    },

    clearReport: async (player: mc.Player, context: UIContext) => {
        reportManager.clearReport(context.targetReport.id);
        player.sendMessage(`§2Report ${context.targetReport.id} has been cleared.`);
        await showPanel(player, 'reportListPanel');
    },

    showUnbanForm: async (player: mc.Player) => {
        const form = new ModalFormData().title('Unban Player').textField('Player Name', 'Enter player name');
        const response = await utils.uiWait(player, form);
        if (!response || response.canceled) {
            return true;
        }
        const [targetName] = (response as ModalFormResponse).formValues as [string];
        if (!targetName) {
            player.sendMessage('§cYou must enter a player name.');
            return true;
        }
        unbanPlayer(player, targetName);
        return true;
    },

    showUnmuteForm: async (player: mc.Player) => {
        const form = new ModalFormData().title('Unmute Player').textField('Player Name', 'Enter player name');
        const response = await utils.uiWait(player, form);
        if (!response || response.canceled) {
            return true;
        }
        const [targetName] = (response as ModalFormResponse).formValues as [string];
        if (!targetName) {
            player.sendMessage('§cYou must enter a player name.');
            return true;
        }
        unmutePlayer(player, targetName);
        return true;
    },

    removeBounty: async (player: mc.Player, context: UIContext) => {
        const { targetPlayerId, targetPlayerName } = context;
        const existingBounty = bountyManager.getBounty(targetPlayerId);

        if (!existingBounty) {
            player.sendMessage(`§c${targetPlayerName} does not have an active bounty.`);
            return true;
        }

        bountyManager.removeBounty(targetPlayerId);
        player.sendMessage(`§2Successfully removed the bounty from ${targetPlayerName}.`);
        mc.world.sendMessage(`§2The bounty on ${targetPlayerName} has been removed!`);

        return true;
    },

    kickPlayer: async (player: mc.Player, context: UIContext) => {
        const { targetPlayerId, targetPlayerName } = context;
        if (player.id === targetPlayerId) {
            player.sendMessage('§cYou cannot kick yourself.');
            return true;
        }
        const targetPlayer = playerCache.getPlayerFromCache(targetPlayerId);
        if (!targetPlayer) {
            player.sendMessage(`§c${targetPlayerName} is not online.`);
            return true;
        }
        const form = new ModalFormData()
            .title(`Kick ${targetPlayerName}`)
            .textField('Reason', 'Enter reason for kicking', { defaultValue: 'No reason provided.' });
        const response = await utils.uiWait(player, form);
        if (response && !response.canceled) {
            const [reason] = (response as ModalFormResponse).formValues as [string];
            kickPlayer(player, targetPlayer, reason);
        }
        return true;
    },

    freezePlayer: async (player: mc.Player, context: UIContext) => {
        const { targetPlayerId, targetPlayerName } = context;
        if (player.id === targetPlayerId) {
            player.sendMessage('§cYou cannot freeze yourself.');
            return true;
        }
        const targetPlayer = playerCache.getPlayerFromCache(targetPlayerId);
        if (!targetPlayer) {
            player.sendMessage(`§c${targetPlayerName} is not online.`);
            return true;
        }
        freezePlayer(player, targetPlayer);
        return true;
    },

    unfreezePlayer: async (player: mc.Player, context: UIContext) => {
        const { targetPlayerId, targetPlayerName } = context;
        if (player.id === targetPlayerId) {
            player.sendMessage('§cYou cannot unfreeze yourself.');
            return true;
        }
        const targetPlayer = playerCache.getPlayerFromCache(targetPlayerId);
        if (!targetPlayer) {
            player.sendMessage(`§c${targetPlayerName} is not online.`);
            return true;
        }
        unfreezePlayer(player, targetPlayer);
        return true;
    },

    unmutePlayer: async (player: mc.Player, context: UIContext) => {
        const { targetPlayerName, targetPlayerId } = context;
        if (player.id === targetPlayerId) {
            player.sendMessage('§cYou cannot unmute yourself.');
            return true;
        }
        unmutePlayer(player, targetPlayerName);
        return true;
    },

    mutePlayer: async (player: mc.Player, context: UIContext) => {
        const { targetPlayerId, targetPlayerName } = context;
        if (player.id === targetPlayerId) {
            player.sendMessage('§cYou cannot mute yourself.');
            return true;
        }
        const targetPlayer = playerCache.getPlayerFromCache(targetPlayerId);
        if (!targetPlayer) {
            player.sendMessage(`§c${targetPlayerName} is not online. Use /offlinemute instead.`);
            return true;
        }
        const form = new ModalFormData()
            .title(`Mute ${targetPlayerName}`)
            .textField('Duration', 'e.g., 30m, 2h, 7d. Default: perm', { defaultValue: 'perm' })
            .textField('Reason', 'Enter reason for muting', { defaultValue: 'No reason provided.' });
        const response = await utils.uiWait(player, form);
        if (response && !response.canceled) {
            const [duration, reason] = (response as ModalFormResponse).formValues as [string, string];
            mutePlayer(player, targetPlayer, duration, reason);
        }
        return true;
    },

    banPlayer: async (player: mc.Player, context: UIContext) => {
        const { targetPlayerId, targetPlayerName } = context;
        if (player.id === targetPlayerId) {
            player.sendMessage('§cYou cannot ban yourself.');
            return true;
        }
        const form = new ModalFormData()
            .title(`Ban ${targetPlayerName}`)
            .textField('Duration', 'e.g., 30m, 2h, 7d. Default: perm', { defaultValue: 'perm' })
            .textField('Reason', 'Enter reason for banning', { defaultValue: 'No reason provided.' });
        const response = await utils.uiWait(player, form);
        if (response && !response.canceled) {
            const [duration, reason] = (response as ModalFormResponse).formValues as [string, string];
            const targetPlayer = playerCache.getPlayerFromCache(targetPlayerId);
            if (targetPlayer) {
                banPlayer(player, targetPlayer, duration, reason);
            } else {
                offlineBanPlayer(player, targetPlayerId, targetPlayerName, duration, reason);
            }
        }
        return true;
    },

    tpaPlayer: async (player: mc.Player, context: UIContext) => {
        const { targetPlayerId, targetPlayerName } = context;
        const targetPlayer = playerCache.getPlayerFromCache(targetPlayerId);
        if (!targetPlayer) {
            player.sendMessage(`§c${targetPlayerName} is not online.`);
            return true;
        }
        if (player.id === targetPlayer.id) {
            player.sendMessage('§cYou cannot send a TPA request to yourself.');
            return true;
        }
        const result = tpaManager.createRequest(player, targetPlayer, 'tpa');
        if (result.success) {
            player.sendMessage(`§2TPA request sent to ${targetPlayerName}.`);
            targetPlayer.sendMessage(`§2${player.name} has requested to teleport to you. Use !tpaccept or !tpadeny.`);
        } else {
            player.sendMessage(`§cError: ${result.message}`);
        }
        return true;
    },

    tpaherePlayer: async (player: mc.Player, context: UIContext) => {
        const { targetPlayerId, targetPlayerName } = context;
        const targetPlayer = playerCache.getPlayerFromCache(targetPlayerId);
        if (!targetPlayer) {
            player.sendMessage(`§c${targetPlayerName} is not online.`);
            return true;
        }
        if (player.id === targetPlayer.id) {
            player.sendMessage('§cYou cannot send a TPAHere request to yourself.');
            return true;
        }
        const result = tpaManager.createRequest(player, targetPlayer, 'tpahere');
        if (result.success) {
            player.sendMessage(`§2TPAHere request sent to ${targetPlayerName}.`);
            targetPlayer.sendMessage(
                `§2${player.name} has requested for you to teleport to them. Use !tpaccept or !tpadeny.`
            );
        } else {
            player.sendMessage(`§cError: ${result.message}`);
        }
        return true;
    },

    bountyPlayer: async (player: mc.Player, context: UIContext) => {
        const { targetPlayerId, targetPlayerName } = context;
        const form = new ModalFormData().title(`Set Bounty on ${targetPlayerName}`).textField('Amount', 'Enter amount');
        const response = await utils.uiWait(player, form);
        if (response && !response.canceled) {
            const [amountStr] = (response as ModalFormResponse).formValues as [string];
            const amount = Number(amountStr);
            const config = getConfig();
            if (isNaN(amount) || amount < config.bounties.minimumBounty) {
                player.sendMessage(
                    `§cInvalid amount. The minimum bounty is ${formatCurrency(config.bounties.minimumBounty)}.`
                );
                return true;
            }
            const pData = getOrCreatePlayer(player);
            if (pData.balance < amount) {
                player.sendMessage('§cYou do not have enough money for this bounty.');
                return true;
            }

            incrementPlayerBalance(player.id, -amount);
            bountyManager.incrementBounty(targetPlayerId, amount);
            player.sendMessage(`§2You have placed a bounty of §6${formatCurrency(amount)}§2 on ${targetPlayerName}.`);
            mc.world.sendMessage(
                `§cSomeone has placed a bounty of §6${formatCurrency(amount)}§c on ${targetPlayerName}!`
            );
        }
        return true;
    },

    reportPlayer: async (player: mc.Player, context: UIContext) => {
        const { targetPlayerId, targetPlayerName } = context;
        if (player.id === targetPlayerId) {
            player.sendMessage('§cYou cannot report yourself.');
            return true;
        }
        const form = new ModalFormData()
            .title(`Report ${targetPlayerName}`)
            .textField('Reason for report:', 'Enter the reason here');
        const response = await utils.uiWait(player, form);
        if (!response || response.canceled) {
            player.sendMessage('§cReport canceled.');
            return true;
        }
        const [reason] = (response as ModalFormResponse).formValues as [string];
        if (!reason || reason.trim().length === 0) {
            player.sendMessage('§cYou must provide a reason.');
            return true;
        }
        reportManager.createReport(player, targetPlayerId, targetPlayerName, reason);
        player.sendMessage('§2Report submitted. Thank you for your help.');
        return true;
    },

    removePlayerBounty: async (player: mc.Player, context: UIContext) => {
        const { targetPlayerId, targetPlayerName } = context;
        const targetBounty = bountyManager.getBounty(targetPlayerId);

        if (!targetBounty) {
            player.sendMessage(`§c${targetPlayerName} does not have an active bounty.`);
            return true;
        }

        const form = new ModalFormData()
            .title(`Remove Bounty from ${targetPlayerName}`)
            .textField(
                `Bounty Amount: ${formatCurrency(targetBounty.amount)}\nEnter amount to remove:`,
                'Enter amount'
            );

        const response = await utils.uiWait(player, form);

        if (response && !response.canceled) {
            const [amountStr] = (response as ModalFormResponse).formValues as [string];
            const amount = Number(amountStr);

            if (isNaN(amount) || amount <= 0) {
                player.sendMessage('§cInvalid amount. Please enter a positive number.');
                return true;
            }

            if (amount > targetBounty.amount) {
                player.sendMessage(
                    `§cYou cannot remove more than the bounty amount (${formatCurrency(targetBounty.amount)}).`
                );
                return true;
            }

            const pData = getOrCreatePlayer(player);
            if (pData.balance < amount) {
                player.sendMessage('§cYou dont have enough money for this!');
                return true;
            }

            incrementPlayerBalance(player.id, -amount);
            bountyManager.incrementBounty(targetPlayerId, -amount);
            player.sendMessage(`§2You have removed ${formatCurrency(amount)} from ${targetPlayerName}'s bounty.`);
            mc.world.sendMessage(
                `§2${player.name} has removed ${formatCurrency(amount)} from ${targetPlayerName}'s bounty!`
            );
        }

        return true;
    }
};
