import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import * as helpfulLinksManager from '@core/helpfulLinksManager.js';
import { getOrCreatePlayer } from '@core/playerDataManager.js';
import * as rulesManager from '@core/rulesManager.js';
import { showPanel } from '@core/uiManager.js';
import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions, PanelItem, UIContext } from '@ui/panelRegistry.js';
import { IPanelHandler } from '@ui/types.js';
import { getPaginatedItems, itemsPerPage } from '@ui/uiUtils.js';

export class InfoPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return (
            panelId === 'infoPanel' ||
            panelId.startsWith('rules') ||
            panelId.startsWith('addRule') ||
            panelId.startsWith('ruleAction') ||
            panelId.startsWith('helpfulLinks') ||
            panelId.startsWith('addHelpfulLink') ||
            panelId.startsWith('helpfulLinkAction')
        );
    }

    getItems(player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        const items: PanelItem[] = [];
        const pData = getOrCreatePlayer(player);
        const permissionLevel = pData.permissionLevel;
        const page = (context.page as number) || 1;

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

        if (panelId === 'infoPanel') {
            const staticItems = getStaticMenuItems(panelDefinitions[panelId], permissionLevel);
            items.push(...staticItems);
            return Promise.resolve(items);
        }

        if (panelId === 'rulesManagementPanel') {
            addBack('infoPanel');
            if (permissionLevel <= 1) {
                items.push({
                    id: 'addRule',
                    text: '§l§2+ Add Rule',
                    icon: 'textures/ui/color_plus',
                    permissionLevel: 1,
                    actionType: 'openPanel',
                    actionValue: 'addRulePanel'
                });
            }
            const rules = rulesManager.getRules();
            const paginated = getPaginatedItems(rules, page);
            paginated.forEach((rule, idx) => {
                const realIndex = (page - 1) * itemsPerPage + idx;
                items.push({
                    id: String(realIndex),
                    text: rule,
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'ruleActionPanel'
                });
            });
            addPagination(rules.length);
            return Promise.resolve(items);
        }

        if (panelId === 'ruleActionPanel') {
            addBack('rulesManagementPanel');
            if (permissionLevel <= 1) {
                items.push({
                    id: 'delete',
                    text: 'Delete Rule',
                    icon: 'textures/ui/trash',
                    permissionLevel: 1,
                    actionType: 'functionCall',
                    actionValue: 'deleteRule'
                });
                // Add Move Up/Down if needed
            }
            return Promise.resolve(items);
        }

        if (panelId === 'helpfulLinksManagementPanel') {
            addBack('infoPanel');
            if (permissionLevel <= 1) {
                items.push({
                    id: 'addLink',
                    text: '§l§2+ Add Link',
                    icon: 'textures/ui/color_plus',
                    permissionLevel: 1,
                    actionType: 'openPanel',
                    actionValue: 'addHelpfulLinkPanel'
                });
            }
            const links = helpfulLinksManager.getHelpfulLinks();
            const paginated = getPaginatedItems(links, page);
            paginated.forEach((link, idx) => {
                const realIndex = (page - 1) * itemsPerPage + idx;
                items.push({
                    id: String(realIndex),
                    text: `§l§6${link.title}§r\n§9${link.url}`,
                    icon: 'textures/items/chain',
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'helpfulLinkActionPanel'
                });
            });
            addPagination(links.length);
            return Promise.resolve(items);
        }

        return Promise.resolve(items);
    }

    buildModal(_player: mc.Player, panelId: string, _context: UIContext): Promise<ModalFormData | null> {
        if (panelId === 'addRulePanel') {
            return Promise.resolve(new ModalFormData().title('Add Rule').textField('Rule Content', 'Enter rule text'));
        }
        if (panelId === 'addHelpfulLinkPanel') {
            return Promise.resolve(
                new ModalFormData().title('Add Link').textField('Title', 'Link Title').textField('URL', 'https://...')
            );
        }
        return Promise.resolve(null);
    }

    async handleResponse(
        player: mc.Player,
        panelId: string,
        response: ActionFormResponse | ModalFormResponse,
        context: UIContext
    ): Promise<void> {
        const selection = (response as ActionFormResponse).selection;
        const values = (response as ModalFormResponse).formValues;

        if (panelId === 'addRulePanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'rulesManagementPanel');
            const [rule] = values as [string];
            if (rule) {
                rulesManager.addRule(rule);
                player.sendMessage('§2Rule added.');
            }
            return showPanel(player, 'rulesManagementPanel');
        }

        if (panelId === 'addHelpfulLinkPanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'helpfulLinksManagementPanel');
            const [title, url] = values as [string, string];
            if (title && url) {
                helpfulLinksManager.addHelpfulLink(title, url);
                player.sendMessage('§2Link added.');
            }
            return showPanel(player, 'helpfulLinksManagementPanel');
        }

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

                if (item.actionValue === 'deleteRule') {
                    const ruleIndex = Number(context.selectedItemId); // ID passed from list
                    if (!isNaN(ruleIndex)) {
                        rulesManager.deleteRule(ruleIndex);
                        player.sendMessage('§2Rule deleted.');
                    }
                    return showPanel(player, 'rulesManagementPanel', context);
                }

                if (item.actionValue === 'deleteHelpfulLink') {
                    const linkIndex = Number(context.selectedItemId);
                    if (!isNaN(linkIndex)) {
                        helpfulLinksManager.deleteHelpfulLink(linkIndex);
                        player.sendMessage('§2Link deleted.');
                    }
                    return showPanel(player, 'helpfulLinksManagementPanel', context);
                }
            }
        }
    }
}
