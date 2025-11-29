import * as mc from '@minecraft/server';
import { ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import * as bountyManager from '../bountyManager.js';
import * as configManager from '../configManager.js';
import { getPlayerFromCache } from '../playerCache.js';
import { getPlayer, updatePlayerData } from '../playerDataManager.js';
import * as punishmentManager from '../punishmentManager.js';
import * as reportManager from '../reportManager.js';
import * as tpaManager from '../tpaManager.js';
import { showPanel } from '../uiManager.js';
import * as utils from '../utils.js';

import { UIContext } from './panelRegistry.js';

/**
 * Handles the logic for various UI actions triggered by buttons.
 */
export async function handleUIAction(player: mc.Player, actionName: string, context: UIContext = {}): Promise<void> {
    switch (actionName) {
        case 'showRules':
            return showPanel(player, 'rulesManagementPanel', context);
        case 'showHelpfulLinks':
            return showPanel(player, 'helpfulLinksManagementPanel', context);
        case 'kickPlayer':
            return kickPlayer(player, context);
        case 'mutePlayer':
            return mutePlayer(player, context);
        case 'unmutePlayer':
            return unmutePlayer(player, context);
        case 'banPlayer':
            return banPlayer(player, context);
        case 'freezePlayer':
            return freezePlayer(player, context);
        case 'unfreezePlayer':
            return unfreezePlayer(player, context);
        case 'tpaPlayer':
            return tpaPlayer(player, context);
        case 'tpaherePlayer':
            return tpaherePlayer(player, context);
        case 'reportPlayer':
            return reportPlayer(player, context);
        case 'bountyPlayer':
            return bountyPlayer(player, context);
        case 'removePlayerBounty':
            return removePlayerBounty(player, context);
        case 'assignReport':
            return assignReport(player, context);
        case 'resolveReport':
            return resolveReport(player, context);
        case 'clearReport':
            return clearReport(player, context);
        case 'showUnbanForm':
            return showUnbanForm(player, context);
        case 'showUnmuteForm':
            return showUnmuteForm(player, context);
        default:
            player.sendMessage(`§4Action '${actionName}' is not implemented yet.`);
    }
}

async function kickPlayer(player: mc.Player, context: UIContext) {
    const targetId = context.targetPlayerId;
    if (!targetId) return;
    const target = getPlayerFromCache(targetId);

    // We can't kick offline players easily via command unless we use their name,
    // but the API requires an online player reference or a name selector.
    // If offline, we can't really kick them (they are already gone).
    if (!target) {
        player.sendMessage('§4Player is offline or not found.');
        return showPanel(player, 'playerActionsPanel', context);
    }

    const form = new ModalFormData()
        .title(`Kick ${target.name}`)
        .textField('Reason', 'Enter reason for kick', { defaultValue: 'Kicked by admin' });

    const res = await utils.uiWait(player, form);
    if (res.canceled) return showPanel(player, 'playerActionsPanel', context);

    const values = (res as ModalFormResponse).formValues;
    if (!values) return showPanel(player, 'playerActionsPanel', context);
    const [reason] = values as [string];

    // Use dimension.runCommand to bypass permissions
    try {
        // Enclose name in quotes to handle spaces
        await player.dimension.runCommand(`kick "${target.name}" ${reason}`);
        player.sendMessage(`§2Kicked ${target.name}.`);
    } catch (e) {
        player.sendMessage(`§4Failed to kick player: ${e}`);
    }
    return showPanel(player, 'playerActionsPanel', context);
}

async function mutePlayer(player: mc.Player, context: UIContext) {
    const targetId = context.targetPlayerId;
    if (!targetId) return;
    const targetData = getPlayer(targetId);
    if (!targetData) {
        player.sendMessage('§4Player data not found.');
        return showPanel(player, 'playerActionsPanel', context);
    }

    const form = new ModalFormData()
        .title(`Mute ${targetData.name}`)
        .textField('Duration (minutes)', 'e.g., 60', { defaultValue: '60' })
        .textField('Reason', 'Enter reason', { defaultValue: 'Misconduct' });

    const res = await utils.uiWait(player, form);
    if (res.canceled) return showPanel(player, 'playerActionsPanel', context);

    const values = (res as ModalFormResponse).formValues;
    if (!values) return showPanel(player, 'playerActionsPanel', context);

    const [durationStr, reason] = values as [string, string];
    const durationMins = parseInt(durationStr);

    if (isNaN(durationMins) || durationMins <= 0) {
        player.sendMessage('§4Invalid duration.');
        return showPanel(player, 'playerActionsPanel', context);
    }

    const expires = Date.now() + durationMins * 60 * 1000;
    punishmentManager.addPunishment(targetId, {
        type: 'mute',
        expires,
        reason
    });

    player.sendMessage(`§2Muted ${targetData.name} for ${durationMins} minutes.`);
    const target = getPlayerFromCache(targetId);
    if (target) {
        target.sendMessage(`§4You have been muted for ${durationMins} minutes. Reason: ${reason}`);
    }
    return showPanel(player, 'playerActionsPanel', context);
}

async function unmutePlayer(player: mc.Player, context: UIContext) {
    const targetId = context.targetPlayerId;
    if (!targetId) return;

    const punishment = punishmentManager.getPunishment(targetId);
    if (!punishment || punishment.type !== 'mute') {
        player.sendMessage('§4Player is not muted.');
        return showPanel(player, 'playerActionsPanel', context);
    }

    punishmentManager.removePunishment(targetId);
    player.sendMessage(`§2Unmuted player.`);

    const target = getPlayerFromCache(targetId);
    if (target) {
        target.sendMessage('§2You have been unmuted.');
    }
    return showPanel(player, 'playerActionsPanel', context);
}

async function banPlayer(player: mc.Player, context: UIContext) {
    const targetId = context.targetPlayerId;
    if (!targetId) return;
    const targetData = getPlayer(targetId);
    if (!targetData) {
        player.sendMessage('§4Player data not found.');
        return showPanel(player, 'playerActionsPanel', context);
    }

    const form = new ModalFormData()
        .title(`Ban ${targetData.name}`)
        .textField('Duration (hours, 0 = permanent)', 'e.g., 24', { defaultValue: '0' })
        .textField('Reason', 'Enter reason', { defaultValue: 'Violation of rules' });

    const res = await utils.uiWait(player, form);
    if (res.canceled) return showPanel(player, 'playerActionsPanel', context);

    const values = (res as ModalFormResponse).formValues;
    if (!values) return showPanel(player, 'playerActionsPanel', context);

    const [durationStr, reason] = values as [string, string];
    const durationHours = parseInt(durationStr);

    if (isNaN(durationHours) || durationHours < 0) {
        player.sendMessage('§4Invalid duration.');
        return showPanel(player, 'playerActionsPanel', context);
    }

    // If 0, use a very distant future date (e.g., 100 years)
    const expires =
        durationHours === 0
            ? Date.now() + 100 * 365 * 24 * 60 * 60 * 1000
            : Date.now() + durationHours * 60 * 60 * 1000;

    punishmentManager.addPunishment(targetId, {
        type: 'ban',
        expires,
        reason
    });

    const target = getPlayerFromCache(targetId);
    if (target) {
        // Kick immediately
        try {
            await player.dimension.runCommand(
                `kick "${target.name}" §4You have been banned.\nReason: ${reason}\nExpires: ${new Date(expires).toLocaleString()}`
            );
        } catch {
            // Ignore if kick fails (player might have left)
        }
    }
    player.sendMessage(`§2Banned ${targetData.name}.`);
    return showPanel(player, 'playerActionsPanel', context);
}

async function freezePlayer(player: mc.Player, context: UIContext) {
    const targetId = context.targetPlayerId;
    if (!targetId) return;
    const target = getPlayerFromCache(targetId);

    if (!target) {
        player.sendMessage('§4Player is offline.');
        return showPanel(player, 'playerActionsPanel', context);
    }

    // Set a tag or freeze property
    target.addTag('frozen');
    target.sendMessage('§4You have been frozen by a moderator.');
    player.sendMessage(`§2Frozen ${target.name}.`);
    return showPanel(player, 'playerActionsPanel', context);
}

async function unfreezePlayer(player: mc.Player, context: UIContext) {
    const targetId = context.targetPlayerId;
    if (!targetId) return;
    const target = getPlayerFromCache(targetId);

    if (!target) {
        player.sendMessage('§4Player is offline.');
        return showPanel(player, 'playerActionsPanel', context);
    }

    target.removeTag('frozen');
    target.sendMessage('§2You have been unfrozen.');
    player.sendMessage(`§2Unfrozen ${target.name}.`);
    return showPanel(player, 'playerActionsPanel', context);
}

async function tpaPlayer(player: mc.Player, context: UIContext) {
    const targetId = context.targetPlayerId;
    if (!targetId) return;
    const target = getPlayerFromCache(targetId);
    if (!target) {
        player.sendMessage('§4Player is offline.');
        return showPanel(player, 'playerActionsPanel', context);
    }

    const result = tpaManager.createRequest(player, target, 'tpa');
    player.sendMessage(result.message);
    return showPanel(player, 'playerActionsPanel', context);
}

async function tpaherePlayer(player: mc.Player, context: UIContext) {
    const targetId = context.targetPlayerId;
    if (!targetId) return;
    const target = getPlayerFromCache(targetId);
    if (!target) {
        player.sendMessage('§4Player is offline.');
        return showPanel(player, 'playerActionsPanel', context);
    }

    const result = tpaManager.createRequest(player, target, 'tpahere');
    player.sendMessage(result.message);
    return showPanel(player, 'playerActionsPanel', context);
}

async function reportPlayer(player: mc.Player, context: UIContext) {
    const targetId = context.targetPlayerId;
    if (!targetId) return;
    const targetData = getPlayer(targetId);
    if (!targetData) {
        player.sendMessage('§4Player data not found.');
        return showPanel(player, 'playerActionsPanel', context);
    }

    const form = new ModalFormData()
        .title(`Report ${targetData.name}`)
        .textField('Reason', 'Why are you reporting this player?');

    const res = await utils.uiWait(player, form);
    if (res.canceled) return showPanel(player, 'playerActionsPanel', context);

    const values = (res as ModalFormResponse).formValues;
    if (!values) return showPanel(player, 'playerActionsPanel', context);

    const [reason] = values as [string];
    if (!reason) {
        player.sendMessage('§4Reason is required.');
        return showPanel(player, 'playerActionsPanel', context);
    }

    reportManager.createReport(player, targetId, targetData.name, reason);
    player.sendMessage('§2Report sent successfully. Admins have been notified.');
    return showPanel(player, 'playerActionsPanel', context);
}

async function bountyPlayer(player: mc.Player, context: UIContext) {
    const targetId = context.targetPlayerId;
    if (!targetId) return;
    const targetData = getPlayer(targetId);

    // Check if player has enough money
    const myData = getPlayer(player.id);
    if (!myData) return showPanel(player, 'bountyActionsPanel', context);

    const form = new ModalFormData()
        .title(`Set Bounty: ${targetData?.name}`)
        .textField('Amount', 'Enter bounty amount');

    const res = await utils.uiWait(player, form);
    if (res.canceled) return showPanel(player, 'bountyActionsPanel', context);

    const values = (res as ModalFormResponse).formValues;
    if (!values) return showPanel(player, 'bountyActionsPanel', context);

    const [amountStr] = values as [string];
    const amount = parseInt(amountStr);

    if (isNaN(amount) || amount <= 0) {
        player.sendMessage('§4Invalid amount.');
        return showPanel(player, 'bountyActionsPanel', context);
    }

    if (myData.balance < amount) {
        player.sendMessage(`§4Insufficient funds. You have ${utils.formatCurrency(myData.balance)}.`);
        return showPanel(player, 'bountyActionsPanel', context);
    }

    // Deduct money and set bounty
    updatePlayerData(player.id, (d) => {
        d.balance -= amount;
    });
    bountyManager.incrementBounty(targetId, amount);
    player.sendMessage(`§2Added bounty of ${utils.formatCurrency(amount)} to ${targetData?.name}.`);

    // Announce?
    // Using simple boolean check directly as modules type is dynamic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = configManager.getConfig() as any;
    if (config.modules?.bounties?.announce ?? true) {
        mc.world.sendMessage(
            `§6[Bounty] §r${player.name} has placed a ${utils.formatCurrency(amount)} bounty on ${targetData?.name}!`
        );
    }
    return showPanel(player, 'playerActionsPanel', context);
}

async function removePlayerBounty(player: mc.Player, context: UIContext) {
    const targetId = context.targetPlayerId;
    if (!targetId) return;

    bountyManager.removeBounty(targetId);
    player.sendMessage('§2Bounty removed.');
    return showPanel(player, 'bountyActionsPanel', context);
}

async function assignReport(player: mc.Player, context: UIContext) {
    const report = context.targetReport as reportManager.Report;
    if (!report) return;

    reportManager.assignReport(report.id, player.id);
    player.sendMessage('§2Report assigned to you.');
    // Refresh the panel
    showPanel(player, 'reportActionsPanel', context);
}

async function resolveReport(player: mc.Player, context: UIContext) {
    const report = context.targetReport as reportManager.Report;
    if (!report) return;

    reportManager.resolveReport(report.id);
    player.sendMessage('§2Report marked as resolved.');
    // Go back to list
    showPanel(player, 'reportListPanel', context);
}

async function clearReport(player: mc.Player, context: UIContext) {
    const report = context.targetReport as reportManager.Report;
    if (!report) return;

    reportManager.clearReport(report.id);
    player.sendMessage('§2Report cleared.');
    showPanel(player, 'reportListPanel', context);
}

async function showUnbanForm(player: mc.Player, context: UIContext) {
    const form = new ModalFormData()
        .title('Unban Player')
        .textField('Player Name (exact)', 'Enter the name of the banned player');

    const res = await utils.uiWait(player, form);
    if (res.canceled) return showPanel(player, 'moderationPanel', context);

    const values = (res as ModalFormResponse).formValues;
    if (!values) return showPanel(player, 'moderationPanel', context);

    const [name] = values as [string];
    // We need to find ID by name. punishmentManager uses IDs.
    // If we have a name-to-ID map, use it.
    const { getPlayerIdByName } = await import('../playerDataManager.js');
    const targetId = getPlayerIdByName(name);

    if (!targetId) {
        player.sendMessage('§4Player not found in database.');
        return showPanel(player, 'moderationPanel', context);
    }

    punishmentManager.removePunishment(targetId);
    player.sendMessage(`§2Unbanned ${name}.`);
    return showPanel(player, 'moderationPanel', context);
}

async function showUnmuteForm(player: mc.Player, context: UIContext) {
    const form = new ModalFormData()
        .title('Unmute Player')
        .textField('Player Name (exact)', 'Enter the name of the muted player');

    const res = await utils.uiWait(player, form);
    if (res.canceled) return showPanel(player, 'moderationPanel', context);

    const values = (res as ModalFormResponse).formValues;
    if (!values) return showPanel(player, 'moderationPanel', context);

    const [name] = values as [string];
    const { getPlayerIdByName } = await import('../playerDataManager.js');
    const targetId = getPlayerIdByName(name);

    if (!targetId) {
        player.sendMessage('§4Player not found in database.');
        return showPanel(player, 'moderationPanel', context);
    }

    punishmentManager.removePunishment(targetId);
    player.sendMessage(`§2Unmuted ${name}.`);
    return showPanel(player, 'moderationPanel', context);
}
