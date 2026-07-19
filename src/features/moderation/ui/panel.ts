import { getPlayerFromCache } from '@core/playerCache.js';
import { getPlayerIdByName } from '@core/playerDataManager.js';
import { getTimestampFromUUIDv7, sanitizeString } from '@core/utils.js';
import * as punishmentManager from '@features/moderation/punishmentManager.js';
import * as reportManager from '@features/moderation/reportManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';

export async function showReportListPanel(player: mc.Player, page: number = 1): Promise<void> {
    const form = new ActionFormBuilder().title('Active Reports');

    const reports = reportManager
        .getAllReports()
        .filter((r) => r.status === 'open' || r.status === 'assigned')
        .toSorted((a, b) => getTimestampFromUUIDv7(a.id) - getTimestampFromUUIDv7(b.id));

    form.addPaginatedButtons(
        reports,
        page,
        (report, formBuilder) => {
            const statusColor = report.status === 'assigned' ? '§6' : '§4';
            formBuilder.button(
                `[${statusColor}${report.status.toUpperCase()}§r] ${report.reportedPlayerName}\n§8Reported by: ${report.reporterName}`,
                undefined, // No icon for now, could use a warning icon
                async () => {
                    await showReportActionsPanel(player, report.id);
                }
            );
        },
        async (newPage) => {
            await showReportListPanel(player, newPage);
        }
    );

    form.addBackButton(async () => {
        const { showStaffDashboardPanel } = await import('@core/ui/panels/adminPanel.js');
        await showStaffDashboardPanel(player);
    });

    await form.show(player);
}

export async function showReportActionsPanel(player: mc.Player, reportId: string): Promise<void> {
    const targetReport = reportManager.getAllReports().find((r) => r.id === reportId);
    if (!isDefined(targetReport)) {
        player.sendMessage('§cReport not found.');
        await showReportListPanel(player, 1);
        return;
    }

    const bodyText = [
        `§8Report ID: §6${String(targetReport.id)}`,
        `§8Reported Player: §6${targetReport.reportedPlayerName}`,
        `§8Reporter: §6${targetReport.reporterName}`,
        `§8Reason: §6${targetReport.reason}`,
        `§8Status: §6${targetReport.status}`,
        `§8Date: §6${new Date(getTimestampFromUUIDv7(targetReport.id)).toLocaleString()}`
    ].join('\n');

    const form = new ActionFormBuilder().title('Report Details').body(bodyText);

    form.button('Assign To Me', 'textures/ui/color_plus', async () => {
        reportManager.assignReport(reportId, player.id);
        player.sendMessage('§2Report assigned to you.');
        await showReportActionsPanel(player, reportId);
    });

    form.button('Manage Player', 'textures/ui/op', async () => {
        const { showPlayerActionsPanel } = await import('@core/ui/panels/playerPanel.js');
        await showPlayerActionsPanel(player, targetReport.reportedPlayerId, targetReport.reportedPlayerName);
    });

    form.button('Resolve', 'textures/ui/realms_green_check', async () => {
        reportManager.resolveReport(reportId);
        player.sendMessage('§2Report marked as resolved.');
        await showReportListPanel(player, 1);
    });

    form.button('Clear', 'textures/ui/trash', async () => {
        reportManager.clearReport(reportId);
        player.sendMessage('§2Report cleared.');
        await showReportListPanel(player, 1);
    });

    form.addBackButton(async () => {
        await showReportListPanel(player, 1);
    });

    await form.show(player);
}

// These functions will replace the action registry entries for moderation actions.

export async function handleKickPlayer(player: mc.Player, targetPlayerId: string): Promise<void> {
    const { getPlayer } = await import('@core/playerDataManager.js');
    const targetData = getPlayer(targetPlayerId);

    if (!isDefined(targetData)) {
        player.sendMessage('§4Player data not found.');
        return;
    }

    const form = new ModalFormBuilder<{ reasonRaw: string }>().title(`Kick ${targetData.name}`).textField('reasonRaw', 'Reason', 'Enter reason', 'Violation of rules');

    const res = await form.show(player);
    if (!res) return;

    const reason = sanitizeString(res.reasonRaw, true).replaceAll('"', "'");
    const target = getPlayerFromCache(targetPlayerId);
    if (isDefined(target)) {
        try {
            const { escapeCommandArg } = await import('@core/utils/sanitization.js');
            const escapedTargetName = escapeCommandArg(target.name);
            const escapedReason = escapeCommandArg(`§4You have been kicked.\nReason: ${reason}`);
            player.dimension.runCommand(`kick "${escapedTargetName}" "${escapedReason}"`);
            player.sendMessage(`§2Kicked ${targetData.name}.`);
        } catch {
            player.sendMessage(`§4Failed to kick ${targetData.name}.`);
        }
    } else {
        player.sendMessage('§4Player is offline.');
    }
}

export async function handleMutePlayer(player: mc.Player, targetPlayerId: string): Promise<void> {
    const { getPlayer } = await import('@core/playerDataManager.js');
    const targetData = getPlayer(targetPlayerId);

    if (!isDefined(targetData)) {
        player.sendMessage('§4Player data not found.');
        return;
    }

    const form = new ModalFormBuilder<{ durationStr: string; reasonRaw: string }>()
        .title(`Mute ${targetData.name}`)
        .textField('durationStr', 'Duration (minutes)', 'e.g., 60', '60')
        .textField('reasonRaw', 'Reason', 'Enter reason', 'Spam/Toxicity');

    const res = await form.show(player);
    if (!res) return;

    const reason = sanitizeString(res.reasonRaw, true).replaceAll('"', "'");
    const durationMins = Number.parseInt(res.durationStr);

    if (Number.isNaN(durationMins) || durationMins <= 0) {
        player.sendMessage('§4Invalid duration.');
        return;
    }

    const expires = Date.now() + durationMins * 60 * 1000;

    punishmentManager.addPunishment(
        targetPlayerId,
        targetData.name,
        {
            type: 'mute',
            expires,
            reason
        },
        player.name
    );

    player.sendMessage(`§2Muted ${targetData.name} for ${durationMins} minutes.`);
    const target = getPlayerFromCache(targetPlayerId);
    if (target) {
        target.sendMessage(`§4You have been muted for ${durationMins} minutes. Reason: ${reason}`);
    }
}

export async function handleUnmutePlayer(player: mc.Player, targetPlayerId: string) {
    const punishment = punishmentManager.getPunishment(targetPlayerId, 'mute');
    if (!isDefined(punishment)) {
        player.sendMessage('§4Player is not muted.');
        return;
    }

    punishmentManager.removePunishment(targetPlayerId, 'mute');
    player.sendMessage(`§2Unmuted player.`);

    const target = getPlayerFromCache(targetPlayerId);
    if (isDefined(target)) {
        target.sendMessage('§2You have been unmuted.');
    }
}

export async function handleBanPlayer(player: mc.Player, targetPlayerId: string): Promise<void> {
    const { getPlayer } = await import('@core/playerDataManager.js');
    const targetData = getPlayer(targetPlayerId);

    if (!isDefined(targetData)) {
        player.sendMessage('§4Player data not found.');
        return;
    }

    const form = new ModalFormBuilder<{ durationStr: string; reasonRaw: string }>()
        .title(`Ban ${targetData.name}`)
        .textField('durationStr', 'Duration (hours, 0 = permanent)', 'e.g., 24', '0')
        .textField('reasonRaw', 'Reason', 'Enter reason', 'Violation of rules');

    const res = await form.show(player);
    if (!res) return;

    const reason = sanitizeString(res.reasonRaw, true).replaceAll('"', "'");
    const durationHours = Number.parseInt(res.durationStr);

    if (Number.isNaN(durationHours) || durationHours < 0) {
        player.sendMessage('§4Invalid duration.');
        return;
    }

    const expires = durationHours === 0 ? Date.now() + 100 * 365 * 24 * 60 * 60 * 1000 : Date.now() + durationHours * 60 * 60 * 1000;

    punishmentManager.addPunishment(
        targetPlayerId,
        targetData.name,
        {
            type: 'ban',
            expires,
            reason
        },
        player.name
    );

    const target = getPlayerFromCache(targetPlayerId);
    if (isDefined(target)) {
        try {
            const { escapeCommandArg } = await import('@core/utils/sanitization.js');
            const escapedTargetName = escapeCommandArg(target.name);
            const escapedReason = escapeCommandArg(`§4You have been banned.\nReason: ${reason}\nExpires: ${new Date(expires).toLocaleString()}`);
            player.dimension.runCommand(`kick "${escapedTargetName}" "${escapedReason}"`);
        } catch {
            // Ignore if kick fails
        }
    }
    player.sendMessage(`§2Banned ${targetData.name}.`);
}

export async function handleReportPlayer(player: mc.Player, targetPlayerId: string): Promise<void> {
    const { getPlayer } = await import('@core/playerDataManager.js');
    const targetData = getPlayer(targetPlayerId);
    if (!isDefined(targetData)) {
        player.sendMessage('§4Player data not found.');
        return;
    }

    const form = new ModalFormBuilder<{ reasonRaw: string }>().title(`Report ${targetData.name}`).textField('reasonRaw', 'Reason', 'Why are you reporting this player?');

    const res = await form.show(player);
    if (!res) return;

    if (!isNonEmptyString(res.reasonRaw)) {
        player.sendMessage('§4Reason is required.');
        return;
    }
    const reason = sanitizeString(res.reasonRaw, true);

    reportManager.createReport(player, targetPlayerId, targetData.name, reason);
    player.sendMessage('§2Report sent successfully. Admins have been notified.');
}

export async function handleUnbanForm(player: mc.Player): Promise<void> {
    const form = new ModalFormBuilder<{ name: string }>().title('Unban Player').textField('name', 'Player Name (exact)', 'Enter the name of the banned player');
    const res = await form.show(player);
    if (!res) return;

    const targetId = getPlayerIdByName(res.name);
    if (isNonEmptyString(targetId)) {
        punishmentManager.removePunishment(targetId, 'ban');
        player.sendMessage(`§2Unbanned ${res.name}.`);
    } else {
        player.sendMessage('§4Player not found in database.');
    }
}

export async function handleUnmuteForm(player: mc.Player): Promise<void> {
    const form = new ModalFormBuilder<{ name: string }>().title('Unmute Player').textField('name', 'Player Name (exact)', 'Enter the name of the muted player');
    const res = await form.show(player);
    if (!res) return;

    const targetId = getPlayerIdByName(res.name);
    if (isNonEmptyString(targetId)) {
        punishmentManager.removePunishment(targetId, 'mute');
        player.sendMessage(`§2Unmuted ${res.name}.`);
    } else {
        player.sendMessage('§4Player not found in database.');
    }
}
