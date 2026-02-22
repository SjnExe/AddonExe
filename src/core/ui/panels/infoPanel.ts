/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getConfig } from '@core/configManager.js';
import * as helpfulLinksManager from '@core/helpfulLinksManager.js';
import { getOrCreatePlayer, type PlayerData } from '@core/playerDataManager.js';
import * as rulesManager from '@core/rulesManager.js';
import { showPanel } from '@core/uiManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { handleUIAction } from '@ui/actions.js';
import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions, PanelItem, UIContext } from '@ui/panelRegistry.js';
import { IPanelHandler, MainConfig } from '@ui/types.js';
import { addBackButton, addPaginationItems, getPaginatedItems, itemsPerPage } from '@ui/uiUtils.js';

interface ServerInfo {
    helpfulLinks?: { title: string; url: string }[];
    rules?: string[];
}

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
        const pData = getOrCreatePlayer(player);
        const permissionLevel = pData.permissionLevel;
        const page = (context.page as number) || 1;

        if (panelId === 'infoPanel') {
            const items: PanelItem[] = [];
            const def = panelDefinitions[panelId];
            if (isDefined(def)) {
                const staticItems = getStaticMenuItems(def, permissionLevel);
                items.push(...staticItems);
            }
            return Promise.resolve(items);
        }

        if (panelId === 'rulesPanel') {
            const items: PanelItem[] = [];
            addBackButton(items, 'infoPanel');
            return Promise.resolve(items);
        }

        if (panelId === 'helpfulLinksPanel') {
            return Promise.resolve(this.getHelpfulLinksPanelItems(context));
        }

        if (panelId === 'rulesManagementPanel') {
            return Promise.resolve(this.getRulesManagementItems(pData, page));
        }

        if (panelId === 'ruleActionPanel') {
            const items: PanelItem[] = [];
            addBackButton(items, 'rulesManagementPanel');
            if (permissionLevel <= 1) {
                items.push({
                    id: 'delete',
                    text: 'Delete Rule',
                    icon: 'textures/ui/trash',
                    permissionLevel: 1,
                    actionType: 'functionCall',
                    actionValue: 'deleteRule'
                });
            }
            return Promise.resolve(items);
        }

        if (panelId === 'helpfulLinksManagementPanel') {
            return Promise.resolve(this.getHelpfulLinksManagementItems(pData, page));
        }

        if (panelId === 'helpfulLinkActionPanel') {
            const items: PanelItem[] = [];
            addBackButton(items, 'helpfulLinksManagementPanel');
            if (permissionLevel <= 1) {
                items.push({
                    id: 'delete',
                    text: 'Delete Link',
                    icon: 'textures/ui/trash',
                    permissionLevel: 1,
                    actionType: 'functionCall',
                    actionValue: 'deleteHelpfulLink'
                });
            }
            return Promise.resolve(items);
        }

        return Promise.resolve([]);
    }

    private getHelpfulLinksPanelItems(_context: UIContext): PanelItem[] {
        const items: PanelItem[] = [];
        addBackButton(items, 'infoPanel');
        const config = getConfig() as unknown as MainConfig;
        const serverInfo = isDefined(config.serverInfo) ? (config.serverInfo as ServerInfo) : undefined;
        const links = (isDefined(serverInfo) ? serverInfo.helpfulLinks : undefined) ?? [];

        for (const [idx, link] of links.entries()) {
            if (!isDefined(link)) continue;
            items.push({
                id: `link_${idx}`,
                text: link.title,
                icon: 'textures/ui/world_glyph_color_2x_black_outline',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'printLink',
                sortId: idx
            });
        }
        return items;
    }

    private getRulesManagementItems(pData: PlayerData, page: number): PanelItem[] {
        const items: PanelItem[] = [];
        addBackButton(items, 'infoPanel');
        if (pData.permissionLevel <= 1) {
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
        for (const [idx, rule] of paginated.entries()) {
            if (!isNonEmptyString(rule)) continue;
            const realIndex = (page - 1) * itemsPerPage + idx;
            items.push({
                id: String(realIndex),
                text: rule,
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'ruleActionPanel'
            });
        }
        addPaginationItems(items, page, rules.length);
        return items;
    }

    private getHelpfulLinksManagementItems(pData: PlayerData, page: number): PanelItem[] {
        const items: PanelItem[] = [];
        addBackButton(items, 'infoPanel');
        if (pData.permissionLevel <= 1) {
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
        for (const [idx, link] of paginated.entries()) {
            if (!isDefined(link)) continue;
            const realIndex = (page - 1) * itemsPerPage + idx;
            items.push({
                id: String(realIndex),
                text: `§l§6${link.title}§r\n§9${link.url}`,
                icon: 'textures/items/chain',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'helpfulLinkActionPanel'
            });
        }
        addPaginationItems(items, page, links.length);
        return items;
    }

    getBody(_player: mc.Player, panelId: string, _context: UIContext): Promise<string | undefined | void> {
        if (panelId === 'rulesPanel') {
            const config = getConfig() as unknown as MainConfig;
            const serverInfo = isDefined(config.serverInfo) ? (config.serverInfo as ServerInfo) : undefined;
            const rules = (isDefined(serverInfo) ? serverInfo.rules : undefined) ?? [];
            return Promise.resolve(rules.join('\n\n'));
        }
        if (panelId === 'helpfulLinksPanel') {
            return Promise.resolve('Click a button to see the link in chat.');
        }
        return Promise.resolve();
    }

    buildModal(_player: mc.Player, panelId: string, _context: UIContext): Promise<ModalFormData | undefined | void> {
        if (panelId === 'addRulePanel') {
            return Promise.resolve(new ModalFormData().title('Add Rule').textField('Rule Content', 'Enter rule text'));
        }
        if (panelId === 'addHelpfulLinkPanel') {
            return Promise.resolve(
                new ModalFormData().title('Add Link').textField('Title', 'Link Title').textField('URL', 'https://...')
            );
        }
        return Promise.resolve();
    }

    async handleResponse(
        player: mc.Player,
        panelId: string,
        response: ActionFormResponse | ModalFormResponse,
        context: UIContext
    ): Promise<void> {
        if (panelId === 'addRulePanel' || panelId === 'addHelpfulLinkPanel') {
            await this.handleModalResponse(player, panelId, response as ModalFormResponse);
            return;
        }

        const selection = (response as ActionFormResponse).selection;
        if (typeof selection === 'number') {
            await this.handleSelection(player, panelId, selection, context);
        }
    }

    private async handleModalResponse(player: mc.Player, panelId: string, response: ModalFormResponse): Promise<void> {
        const values = response.formValues;

        if (panelId === 'addRulePanel') {
            if (response.canceled) return showPanel(player, 'rulesManagementPanel');
            const [rule] = (values as [string | undefined]) ?? [];
            if (isNonEmptyString(rule)) {
                rulesManager.addRule(rule);
                player.sendMessage('§2Rule added.');
            }
            return showPanel(player, 'rulesManagementPanel');
        }

        if (panelId === 'addHelpfulLinkPanel') {
            if (response.canceled) return showPanel(player, 'helpfulLinksManagementPanel');
            const [title, url] = (values as [string | undefined, string | undefined]) ?? [];
            if (isNonEmptyString(title) && isNonEmptyString(url)) {
                helpfulLinksManager.addHelpfulLink(title, url);
                player.sendMessage('§2Link added.');
            }
            return showPanel(player, 'helpfulLinksManagementPanel');
        }
    }

    private async handleSelection(
        player: mc.Player,
        panelId: string,
        selection: number,
        context: UIContext
    ): Promise<void> {
        const items = await this.getItems(player, panelId, context);
        if (selection >= 0 && selection < items.length) {
            const item = items[selection];
            if (!isDefined(item)) return;

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
                const ruleIndex = Number(context.selectedItemId);
                if (!Number.isNaN(ruleIndex)) {
                    rulesManager.deleteRule(ruleIndex);
                    player.sendMessage('§2Rule deleted.');
                }
                return showPanel(player, 'rulesManagementPanel', context);
            }

            if (item.actionValue === 'deleteHelpfulLink') {
                const linkIndex = Number(context.selectedItemId);
                if (!Number.isNaN(linkIndex)) {
                    helpfulLinksManager.deleteHelpfulLink(linkIndex);
                    player.sendMessage('§2Link deleted.');
                }
                return showPanel(player, 'helpfulLinksManagementPanel', context);
            }

            if (item.actionValue === 'printLink') {
                const config = getConfig() as unknown as MainConfig;
                const serverInfo = isDefined(config.serverInfo) ? (config.serverInfo as ServerInfo) : undefined;
                const links = (isDefined(serverInfo) ? serverInfo.helpfulLinks : undefined) ?? [];
                const index = Number.parseInt(item.id.split('_')[1] ?? '0');
                const link = links[index];

                if (isDefined(link)) {
                    player.sendMessage(`§eLink: §b${link.title}§r\n§a${link.url}`);
                }
                return showPanel(player, panelId, context);
            }

            await handleUIAction(player, item.actionValue, { ...context, selectedItemId: item.id });
        }
    }
}
