import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getPlayerIdByName } from '@core/playerDataManager.js';
import { showPanel } from '@core/uiManager.js';
import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions } from '@ui/panelRegistry.js';
import { IPanelHandler, PanelItem, UIContext } from '@ui/types.js';
import { getPaginatedItems, itemsPerPage } from '@ui/uiUtils.js';
import * as punishmentManager from '../punishmentManager.js';
import * as reportManager from '../reportManager.js';

export class ModerationPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'moderationPanel' || panelId === 'reportListPanel' || panelId === 'reportActionsPanel';
    }

    async getItems(_player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        await Promise.resolve();
        const items: PanelItem[] = [];

        const addBack = (target: string) => {
            items.push({
                id: '__back__',
                text: '§l§8< Back',
                icon: 'textures/gui/controls/left.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: target
            });
        };

        const addPagination = (totalItems: number) => {
            const page = (context.page as number) || 1;
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            if (page > 1) {
                items.push({
                    id: '__prev__',
                    text: '§6< Previous Page',
                    icon: 'textures/ui/arrow_left.png',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'prevPage'
                });
            }
            if (page < totalPages) {
                items.push({
                    id: '__next__',
                    text: '§6Next Page >',
                    icon: 'textures/ui/arrow_right.png',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'nextPage'
                });
            }
        };

        if (panelId === 'moderationPanel') {
            const staticItems = getStaticMenuItems(panelDefinitions[panelId], 1); // Admin only
            items.push(...staticItems);
            return items;
        }

        if (panelId === 'reportListPanel') {
            addBack('adminPanel');
            const reports = reportManager
                .getAllReports()
                .filter((r) => r.status === 'open' || r.status === 'assigned')
                .sort((a, b) => a.timestamp - b.timestamp);
            const paginated = getPaginatedItems(reports, (context.page as number) || 1);
            paginated.forEach((report) => {
                const statusColor = report.status === 'assigned' ? '§6' : '§4';
                items.push({
                    id: report.id,
                    text: `[${statusColor}${report.status.toUpperCase()}§r] ${report.reportedPlayerName}\n§8Reported by: ${report.reporterName}`,
                    permissionLevel: 2,
                    actionType: 'openPanel',
                    actionValue: 'reportActionsPanel'
                });
            });
            addPagination(reports.length);
            return items;
        }

        if (panelId === 'reportActionsPanel') {
            addBack('reportListPanel');
            // Static items from registry
            const staticItems = getStaticMenuItems(panelDefinitions[panelId], 2);
            items.push(...staticItems.filter((i) => i.id !== '__back__')); // AddBack handled manually
            return items;
        }

        return items;
    }

    async getBody(_player: mc.Player, panelId: string, context: UIContext): Promise<string | null> {
        await Promise.resolve();
        if (panelId === 'reportActionsPanel') {
            const reportId = context.selectedItemId as string;
            const targetReport = reportManager.getAllReports().find((r) => r.id === reportId);
            if (targetReport) {
                return [
                    `§8Report ID: §6${String(targetReport.id)}`,
                    `§8Reported Player: §6${targetReport.reportedPlayerName}`,
                    `§8Reporter: §6${targetReport.reporterName}`,
                    `§8Reason: §6${targetReport.reason}`,
                    `§8Status: §6${targetReport.status}`,
                    `§8Date: §6${new Date(targetReport.timestamp).toLocaleString()}`
                ].join('\n');
            }
            return '§cReport not found.';
        }
        return null;
    }

    async handleResponse(
        player: mc.Player,
        panelId: string,
        response: ActionFormResponse | ModalFormResponse,
        context: UIContext
    ): Promise<void> {
        const selection = (response as ActionFormResponse).selection;

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];

                if (item.actionType === 'openPanel') {
                    return showPanel(player, item.actionValue, {
                        ...context,
                        page: 1,
                        selectedItemId: item.id,
                        id: item.id
                    });
                }

                if (item.actionValue === 'prevPage') {
                    return showPanel(player, panelId, {
                        ...context,
                        page: Math.max(1, (context.page as number) || 1) - 1
                    });
                }
                if (item.actionValue === 'nextPage') {
                    return showPanel(player, panelId, { ...context, page: ((context.page as number) || 1) + 1 });
                }

                // Moderation Actions
                if (item.actionValue === 'showUnbanForm') {
                    const form = new ModalFormData()
                        .title('Unban Player')
                        .textField('Player Name (exact)', 'Enter the name of the banned player');
                    const res = await form.show(player);
                    if (res.canceled) return showPanel(player, panelId, context);
                    const [name] = res.formValues as [string];
                    const targetId = getPlayerIdByName(name);
                    if (!targetId) {
                        player.sendMessage('§4Player not found in database.');
                    } else {
                        punishmentManager.removePunishment(targetId, 'ban');
                        player.sendMessage(`§2Unbanned ${name}.`);
                    }
                    return showPanel(player, panelId, context);
                }

                if (item.actionValue === 'showUnmuteForm') {
                    const form = new ModalFormData()
                        .title('Unmute Player')
                        .textField('Player Name (exact)', 'Enter the name of the muted player');
                    const res = await form.show(player);
                    if (res.canceled) return showPanel(player, panelId, context);
                    const [name] = res.formValues as [string];
                    const targetId = getPlayerIdByName(name);
                    if (!targetId) {
                        player.sendMessage('§4Player not found in database.');
                    } else {
                        punishmentManager.removePunishment(targetId, 'mute');
                        player.sendMessage(`§2Unmuted ${name}.`);
                    }
                    return showPanel(player, panelId, context);
                }

                // Report Actions
                if (item.actionValue === 'assignReport') {
                    const reportId = context.selectedItemId as string;
                    if (reportId) {
                        reportManager.assignReport(reportId, player.id);
                        player.sendMessage('§2Report assigned to you.');
                    }
                    return showPanel(player, panelId, context);
                }
                if (item.actionValue === 'resolveReport') {
                    const reportId = context.selectedItemId as string;
                    if (reportId) {
                        reportManager.resolveReport(reportId);
                        player.sendMessage('§2Report marked as resolved.');
                    }
                    return showPanel(player, 'reportListPanel', context);
                }
                if (item.actionValue === 'clearReport') {
                    const reportId = context.selectedItemId as string;
                    if (reportId) {
                        reportManager.clearReport(reportId);
                        player.sendMessage('§2Report cleared.');
                    }
                    return showPanel(player, 'reportListPanel', context);
                }
            }
        }
    }
}
