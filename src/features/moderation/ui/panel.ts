import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getPlayerIdByName } from '@core/playerDataManager.js';
import { showPanel } from '@core/uiManager.js';
import { getTimestampFromUUIDv7 } from '@core/utils.js';
import * as punishmentManager from '@features/moderation/punishmentManager.js';
import * as reportManager from '@features/moderation/reportManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions } from '@ui/panelRegistry.js';
import { IPanelHandler, PanelItem, UIContext } from '@ui/types.js';
import { addBackButton, addPaginationItems, getPaginatedItems, handleCommonSelection } from '@ui/uiUtils.js';

export class ModerationPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'moderationPanel' || panelId === 'reportListPanel' || panelId === 'reportActionsPanel';
    }

    async getItems(player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        await Promise.resolve();
        const items: PanelItem[] = [];

        if (panelId === 'moderationPanel') {
            const def = panelDefinitions[panelId];
            if (isDefined(def)) {
                const staticItems = getStaticMenuItems(player, def);
                items.push(...staticItems);
            }
            return items;
        }

        if (panelId === 'reportListPanel') {
            addBackButton(items, 'staffDashboardPanel');
            const reports = reportManager
                .getAllReports()
                .filter((r) => r.status === 'open' || r.status === 'assigned')
                .toSorted((a, b) => getTimestampFromUUIDv7(a.id) - getTimestampFromUUIDv7(b.id));
            const paginated = getPaginatedItems(reports, (context.page as number) || 1);
            for (const report of paginated) {
                const statusColor = report.status === 'assigned' ? '§6' : '§4';
                items.push({
                    id: report.id,
                    text: `[${statusColor}${report.status.toUpperCase()}§r] ${report.reportedPlayerName}\n§8Reported by: ${report.reporterName}`,
                    permission: 'ui.panel.mod',
                    actionType: 'openPanel',
                    actionValue: 'reportActionsPanel'
                });
            }
            addPaginationItems(items, (context.page as number) || 1, reports.length);
            return items;
        }

        if (panelId === 'reportActionsPanel') {
            addBackButton(items, 'reportListPanel');
            // Static items from registry
            const def = panelDefinitions[panelId];
            if (isDefined(def)) {
                const staticItems = getStaticMenuItems(player, def);
                items.push(...staticItems.filter((i) => i.id !== '__back__')); // AddBack handled manually
            }
            return items;
        }

        return items;
    }

    async getBody(_player: mc.Player, panelId: string, context: UIContext): Promise<string | undefined> {
        await Promise.resolve();
        if (panelId === 'reportActionsPanel') {
            const reportId = context.selectedItemId as string;
            const targetReport = reportManager.getAllReports().find((r) => r.id === reportId);
            if (isDefined(targetReport)) {
                return [
                    `§8Report ID: §6${String(targetReport.id)}`,
                    `§8Reported Player: §6${targetReport.reportedPlayerName}`,
                    `§8Reporter: §6${targetReport.reporterName}`,
                    `§8Reason: §6${targetReport.reason}`,
                    `§8Status: §6${targetReport.status}`,
                    `§8Date: §6${new Date(getTimestampFromUUIDv7(targetReport.id)).toLocaleString()}`
                ].join('\n');
            }
            return '§cReport not found.';
        }
        return undefined;
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: UIContext): Promise<void> {
        const selection = (response as ActionFormResponse).selection;

        if (typeof selection === 'number') {
            await this.handleSelection(player, panelId, selection, context);
        }
    }

    private async handleSelection(player: mc.Player, panelId: string, selection: number, context: UIContext): Promise<void> {
        const items = await this.getItems(player, panelId, context);
        if (selection >= 0 && selection < items.length) {
            const item = items[selection];
            if (!isDefined(item)) return;

            if (handleCommonSelection(player, panelId, item, context)) return;

            if (item.actionValue === 'showUnbanForm') {
                await this.handleUnbanForm(player, panelId, context);
                return;
            }

            if (item.actionValue === 'showUnmuteForm') {
                await this.handleUnmuteForm(player, panelId, context);
                return;
            }

            if (item.actionValue === 'assignReport') {
                await this.handleAssignReport(player, panelId, context);
                return;
            }
            if (item.actionValue === 'resolveReport') {
                await this.handleResolveReport(player, context);
                return;
            }
            if (item.actionValue === 'clearReport') {
                await this.handleClearReport(player, context);
                return;
            }

            if (item.actionValue === 'kickPlayer') {
                await this.handleKickPlayer(player, context);
                return;
            }
            if (item.actionValue === 'mutePlayer') {
                await this.handleMutePlayer(player, context);
                return;
            }
            if (item.actionValue === 'unmutePlayer') {
                await this.handleUnmutePlayer(player, context);
                return;
            }
            if (item.actionValue === 'banPlayer') {
                await this.handleBanPlayer(player, context);
                return;
            }
            if (item.actionValue === 'freezePlayer') {
                await this.handleFreezePlayer(player, context);
                return;
            }
            if (item.actionValue === 'unfreezePlayer') {
                await this.handleUnfreezePlayer(player, context);
                return;
            }
            if (item.actionValue === 'reportPlayer') {
                await this.handleReportPlayer(player, context);
                return;
            }
        }
    }

    private async handleKickPlayer(player: mc.Player, context: UIContext): Promise<void> {
        const targetId = context.targetPlayerId as string;
        if (!isNonEmptyString(targetId)) return;

        const { getPlayerFromCache } = await import('@core/playerCache.js');
        const { sanitizeString, uiWait } = await import('@core/utils.js');
        const target = getPlayerFromCache(targetId);

        if (!isDefined(target)) {
            player.sendMessage('§4Player is offline or not found.');
            return showPanel(player, 'playerActionsPanel', context);
        }

        const form = new ModalFormData().title(`Kick ${target.name}`).textField('Reason', 'Enter reason for kick', { defaultValue: 'Kicked by admin' });

        const res = await uiWait(player, form);
        if (isDefined(res) && res.canceled) return showPanel(player, (context.returnPanel as string) || 'playerActionsPanel', context);

        const values = (res as import('@minecraft/server-ui').ModalFormResponse).formValues;
        if (!isDefined(values)) return showPanel(player, (context.returnPanel as string) || 'playerActionsPanel', context);
        const [reason] = values as [string];
        const safeReason = sanitizeString(reason, true).replaceAll('"', "'");

        try {
            const { escapeCommandArg } = await import('@core/utils/sanitization.js');
            const escapedReason = escapeCommandArg(safeReason);
            const escapedTargetName = escapeCommandArg(target.name);
            player.dimension.runCommand(`kick "${escapedTargetName}" "${escapedReason}"`);
            player.sendMessage(`§2Kicked ${target.name}.`);
        } catch (error) {
            player.sendMessage(`§4Failed to kick player: ${String(error)}`);
        }
        return showPanel(player, 'playerActionsPanel', context);
    }

    private async handleMutePlayer(player: mc.Player, context: UIContext): Promise<void> {
        const targetId = context.targetPlayerId as string;
        if (!isNonEmptyString(targetId)) return;

        const { getPlayer } = await import('@core/playerDataManager.js');
        const { sanitizeString, uiWait } = await import('@core/utils.js');
        const { getPlayerFromCache } = await import('@core/playerCache.js');
        const targetData = getPlayer(targetId);
        if (!isDefined(targetData)) {
            player.sendMessage('§4Player data not found.');
            return showPanel(player, (context.returnPanel as string) || 'playerActionsPanel', context);
        }

        const form = new ModalFormData()
            .title(`Mute ${targetData.name}`)
            .textField('Duration (minutes)', 'e.g., 60', { defaultValue: '60' })
            .textField('Reason', 'Enter reason', { defaultValue: 'Misconduct' });

        const res = await uiWait(player, form);
        if (isDefined(res) && res.canceled) return showPanel(player, 'playerActionsPanel', context);

        const values = (res as import('@minecraft/server-ui').ModalFormResponse).formValues;
        if (!isDefined(values)) return showPanel(player, 'playerActionsPanel', context);

        const [durationStr, reasonRaw] = values as [string, string];
        const reason = sanitizeString(reasonRaw, true);
        const durationMins = Number.parseInt(durationStr);

        if (Number.isNaN(durationMins) || durationMins <= 0) {
            player.sendMessage('§4Invalid duration.');
            return showPanel(player, 'playerActionsPanel', context);
        }

        const expires = Date.now() + durationMins * 60 * 1000;
        punishmentManager.addPunishment(
            targetId,
            targetData.name,
            {
                type: 'mute',
                expires,
                reason
            },
            player.name
        );

        player.sendMessage(`§2Muted ${targetData.name} for ${durationMins} minutes.`);
        const target = getPlayerFromCache(targetId);
        if (target) {
            target.sendMessage(`§4You have been muted for ${durationMins} minutes. Reason: ${reason}`);
        }
        return showPanel(player, 'playerActionsPanel', context);
    }

    private async handleUnmutePlayer(player: mc.Player, context: UIContext): Promise<void> {
        const targetId = context.targetPlayerId as string;
        if (!isNonEmptyString(targetId)) return;

        const { getPlayerFromCache } = await import('@core/playerCache.js');

        const punishment = punishmentManager.getPunishment(targetId, 'mute');
        if (!isDefined(punishment)) {
            player.sendMessage('§4Player is not muted.');
            return showPanel(player, 'playerActionsPanel', context);
        }

        punishmentManager.removePunishment(targetId, 'mute');
        player.sendMessage(`§2Unmuted player.`);

        const target = getPlayerFromCache(targetId);
        if (isDefined(target)) {
            target.sendMessage('§2You have been unmuted.');
        }
        return showPanel(player, 'playerActionsPanel', context);
    }

    private async handleBanPlayer(player: mc.Player, context: UIContext): Promise<void> {
        const targetId = context.targetPlayerId as string;
        if (!isNonEmptyString(targetId)) return;

        const { getPlayer } = await import('@core/playerDataManager.js');
        const { getPlayerFromCache } = await import('@core/playerCache.js');
        const { sanitizeString, uiWait } = await import('@core/utils.js');
        const targetData = getPlayer(targetId);

        if (!isDefined(targetData)) {
            player.sendMessage('§4Player data not found.');
            return showPanel(player, 'playerActionsPanel', context);
        }

        const form = new ModalFormData()
            .title(`Ban ${targetData.name}`)
            .textField('Duration (hours, 0 = permanent)', 'e.g., 24', { defaultValue: '0' })
            .textField('Reason', 'Enter reason', { defaultValue: 'Violation of rules' });

        const res = await uiWait(player, form);
        if (isDefined(res) && res.canceled) return showPanel(player, 'playerActionsPanel', context);

        const values = (res as import('@minecraft/server-ui').ModalFormResponse).formValues;
        if (!isDefined(values)) return showPanel(player, 'playerActionsPanel', context);

        const [durationStr, reasonRaw] = values as [string, string];
        const reason = sanitizeString(reasonRaw, true).replaceAll('"', "'");
        const durationHours = Number.parseInt(durationStr);

        if (Number.isNaN(durationHours) || durationHours < 0) {
            player.sendMessage('§4Invalid duration.');
            return showPanel(player, 'playerActionsPanel', context);
        }

        const expires = durationHours === 0 ? Date.now() + 100 * 365 * 24 * 60 * 60 * 1000 : Date.now() + durationHours * 60 * 60 * 1000;

        punishmentManager.addPunishment(
            targetId,
            targetData.name,
            {
                type: 'ban',
                expires,
                reason
            },
            player.name
        );

        const target = getPlayerFromCache(targetId);
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
        return showPanel(player, 'playerActionsPanel', context);
    }

    private async handleFreezePlayer(player: mc.Player, context: UIContext): Promise<void> {
        const targetId = context.targetPlayerId as string;
        if (!isNonEmptyString(targetId)) return;

        const { getPlayerFromCache } = await import('@core/playerCache.js');
        const target = getPlayerFromCache(targetId);

        if (!isDefined(target)) {
            player.sendMessage('§4Player is offline.');
            return showPanel(player, 'playerActionsPanel', context);
        }

        target.addTag('frozen');
        target.sendMessage('§4You have been frozen by a moderator.');
        player.sendMessage(`§2Frozen ${target.name}.`);
        return showPanel(player, 'playerActionsPanel', context);
    }

    private async handleUnfreezePlayer(player: mc.Player, context: UIContext): Promise<void> {
        const targetId = context.targetPlayerId as string;
        if (!isNonEmptyString(targetId)) return;

        const { getPlayerFromCache } = await import('@core/playerCache.js');
        const target = getPlayerFromCache(targetId);

        if (!isDefined(target)) {
            player.sendMessage('§4Player is offline.');
            return showPanel(player, 'playerActionsPanel', context);
        }

        target.removeTag('frozen');
        target.sendMessage('§2You have been unfrozen.');
        player.sendMessage(`§2Unfrozen ${target.name}.`);
        return showPanel(player, 'playerActionsPanel', context);
    }

    private async handleReportPlayer(player: mc.Player, context: UIContext): Promise<void> {
        const targetId = context.targetPlayerId as string;
        if (!isNonEmptyString(targetId)) return;

        const { getPlayer } = await import('@core/playerDataManager.js');
        const { sanitizeString, uiWait } = await import('@core/utils.js');
        const targetData = getPlayer(targetId);
        if (!isDefined(targetData)) {
            player.sendMessage('§4Player data not found.');
            return showPanel(player, 'playerActionsPanel', context);
        }

        const form = new ModalFormData().title(`Report ${targetData.name}`).textField('Reason', 'Why are you reporting this player?');

        const res = await uiWait(player, form);
        if (isDefined(res) && res.canceled) return showPanel(player, (context.returnPanel as string) || 'playerActionsPanel', context);

        const values = (res as import('@minecraft/server-ui').ModalFormResponse).formValues;
        if (!isDefined(values)) return showPanel(player, (context.returnPanel as string) || 'playerActionsPanel', context);

        const [reasonRaw] = values as [string];
        if (!isNonEmptyString(reasonRaw)) {
            player.sendMessage('§4Reason is required.');
            return showPanel(player, (context.returnPanel as string) || 'playerActionsPanel', context);
        }
        const reason = sanitizeString(reasonRaw, true);

        reportManager.createReport(player, targetId, targetData.name, reason);
        player.sendMessage('§2Report sent successfully. Admins have been notified.');
    }

    private async handleUnbanForm(player: mc.Player, panelId: string, context: UIContext): Promise<void> {
        const form = new ModalFormData().title('Unban Player').textField('Player Name (exact)', 'Enter the name of the banned player');
        const res = await form.show(player);
        if (res.canceled) return showPanel(player, panelId, context);
        const [name] = res.formValues as [string];
        const targetId = getPlayerIdByName(name);
        if (isNonEmptyString(targetId)) {
            punishmentManager.removePunishment(targetId, 'ban');
            player.sendMessage(`§2Unbanned ${name}.`);
        } else {
            player.sendMessage('§4Player not found in database.');
        }
        return showPanel(player, panelId, context);
    }

    private async handleUnmuteForm(player: mc.Player, panelId: string, context: UIContext): Promise<void> {
        const form = new ModalFormData().title('Unmute Player').textField('Player Name (exact)', 'Enter the name of the muted player');
        const res = await form.show(player);
        if (res.canceled) return showPanel(player, panelId, context);
        const [name] = res.formValues as [string];
        const targetId = getPlayerIdByName(name);
        if (isNonEmptyString(targetId)) {
            punishmentManager.removePunishment(targetId, 'mute');
            player.sendMessage(`§2Unmuted ${name}.`);
        } else {
            player.sendMessage('§4Player not found in database.');
        }
        return showPanel(player, panelId, context);
    }

    private async handleAssignReport(player: mc.Player, panelId: string, context: UIContext): Promise<void> {
        const reportId = context.selectedItemId as string;
        if (isNonEmptyString(reportId)) {
            reportManager.assignReport(reportId, player.id);
            player.sendMessage('§2Report assigned to you.');
        }
        return showPanel(player, panelId, context);
    }

    private async handleResolveReport(player: mc.Player, context: UIContext): Promise<void> {
        const reportId = context.selectedItemId as string;
        if (isNonEmptyString(reportId)) {
            reportManager.resolveReport(reportId);
            player.sendMessage('§2Report marked as resolved.');
        }
        return showPanel(player, 'reportListPanel', context);
    }

    private async handleClearReport(player: mc.Player, context: UIContext): Promise<void> {
        const reportId = context.selectedItemId as string;
        if (isNonEmptyString(reportId)) {
            reportManager.clearReport(reportId);
            player.sendMessage('§2Report cleared.');
        }
        return showPanel(player, 'reportListPanel', context);
    }
}
