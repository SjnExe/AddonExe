import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getSidebarConfig, saveSidebarConfig } from '@core/configurations.js';
import { forceUpdate } from '@core/sidebarManager.js';
import { showPanel } from '@core/uiManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions, PanelItem, UIContext } from '@ui/panelRegistry.js';
import { IPanelHandler } from '@ui/types.js';
import { addBackButton } from '@ui/uiUtils.js';

export class SidebarPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return (
            panelId === 'sidebarMainPanel' ||
            panelId.startsWith('sidebarLine') ||
            panelId.startsWith('actionBarLine') ||
            panelId === 'actionBarLinesPanel' ||
            panelId === 'placeholderListPanel'
        );
    }

    getBody(_player: mc.Player, panelId: string, _context: UIContext): Promise<string | undefined | void> {
        if (panelId === 'placeholderListPanel') {
            return Promise.resolve(
                `§l§6Global Placeholders§r (Scoreboard, Floating Text)\n` +
                    `{server_name}, {tps}, {online}, {max_players}, {time}, {date}\n\n` +
                    `§l§dPersonal Placeholders§r (Action Bar Only)\n` +
                    `{name}, {money}, {rank}, {kills}, {deaths}, {streak}, {kdr}, {playtime}, {team}, {ping}, {x}, {y}, {z}, {dimension}`
            );
        }
        return Promise.resolve();
    }

    getItems(_player: mc.Player, panelId: string, _context: UIContext): Promise<PanelItem[]> {
        const items: PanelItem[] = [];

        if (panelId === 'sidebarMainPanel') {
            const def = panelDefinitions[panelId];
            if (isDefined(def)) {
                const staticItems = getStaticMenuItems(def, 1); // Admin
                items.push(...staticItems);
            }
            return Promise.resolve(items);
        }

        if (panelId === 'sidebarLinesPanel' || panelId === 'actionBarLinesPanel') {
            return Promise.resolve(this.getLinesPanelItems(panelId));
        }

        if (panelId === 'sidebarLineActionPanel' || panelId === 'actionBarLineActionPanel') {
            return Promise.resolve(this.getLineActionPanelItems(panelId));
        }

        return Promise.resolve(items);
    }

    private getLinesPanelItems(panelId: string): PanelItem[] {
        const items: PanelItem[] = [];
        addBackButton(items, 'sidebarMainPanel');
        const isSidebar = panelId === 'sidebarLinesPanel';
        items.push({
            id: 'addLine',
            text: '§l§2+ Add Line',
            icon: 'textures/ui/color_plus',
            permissionLevel: 1,
            actionType: 'openPanel',
            actionValue: isSidebar ? 'sidebarLineAddPanel' : 'actionBarLineAddPanel'
        });

        const config = getSidebarConfig();
        const lines = isSidebar ? config.sidebarLines : config.actionBarLines;

        for (const [idx, line] of lines.entries()) {
            if (!isDefined(line)) continue;
            items.push({
                id: String(idx),
                text: `${idx + 1}. ${line}`,
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: isSidebar ? 'sidebarLineActionPanel' : 'actionBarLineActionPanel'
            });
        }
        return items;
    }

    private getLineActionPanelItems(panelId: string): PanelItem[] {
        const items: PanelItem[] = [];
        const isSidebar = panelId === 'sidebarLineActionPanel';
        addBackButton(items, isSidebar ? 'sidebarLinesPanel' : 'actionBarLinesPanel');
        items.push(
            {
                id: 'edit',
                text: 'Edit',
                icon: 'textures/ui/icon_setting',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'editLine'
            },
            {
                id: 'moveUp',
                text: 'Move Up',
                icon: 'textures/gui/controls/up',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'moveUp'
            },
            {
                id: 'moveDown',
                text: 'Move Down',
                icon: 'textures/gui/controls/down',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'moveDown'
            },
            {
                id: 'delete',
                text: 'Delete',
                icon: 'textures/ui/trash',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'deleteLine'
            }
        );
        return items;
    }

    buildModal(_player: mc.Player, panelId: string, context: UIContext): Promise<ModalFormData | undefined | void> {
        if (panelId === 'sidebarLineEditPanel') {
            const config = getSidebarConfig();
            const lines = config.sidebarLines;
            const index = (context.lineIndex as number) || 0;
            const line = lines[index] ?? '';
            return Promise.resolve(
                new ModalFormData()
                    .title(`Edit Line ${index + 1}`)
                    .textField('Content', 'Content', { defaultValue: line })
            );
        }

        if (panelId === 'actionBarLineEditPanel') {
            const config = getSidebarConfig();
            const lines = config.actionBarLines;
            const index = (context.lineIndex as number) || 0;
            const line = lines[index] ?? '';
            return Promise.resolve(
                new ModalFormData()
                    .title(`Edit Line ${index + 1}`)
                    .textField('Content', 'Content', { defaultValue: line })
            );
        }

        if (panelId === 'sidebarLineAddPanel' || panelId === 'actionBarLineAddPanel') {
            return Promise.resolve(
                new ModalFormData().title('Add Line').textField('Content', 'Supports {money}, {name}, etc.')
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
        const selection = (response as ActionFormResponse).selection;

        if (panelId === 'sidebarLineAddPanel' || panelId === 'actionBarLineAddPanel') {
            await this.handleLineAdd(player, panelId, response as ModalFormResponse);
            return;
        }

        if (panelId === 'sidebarLineEditPanel' || panelId === 'actionBarLineEditPanel') {
            await this.handleLineEdit(player, panelId, response as ModalFormResponse, context);
            return;
        }

        if (typeof selection === 'number') {
            await this.handleSelection(player, panelId, selection, context);
        }
    }

    private saveLines(player: mc.Player, lines: string[], isSidebar: boolean, msg: string) {
        const config = getSidebarConfig();
        if (isSidebar) config.sidebarLines = lines;
        else config.actionBarLines = lines;
        saveSidebarConfig(config);
        forceUpdate();
        player.sendMessage(msg);
    }

    private async handleLineAdd(player: mc.Player, panelId: string, response: ModalFormResponse): Promise<void> {
        const isSidebar = panelId.startsWith('sidebar');
        const listPanelId = isSidebar ? 'sidebarLinesPanel' : 'actionBarLinesPanel';

        if (response.canceled) return showPanel(player, listPanelId);

        const values = response.formValues;
        const [newLine] = (isDefined(values) ? values : []) as [string | undefined];

        if (isNonEmptyString(newLine)) {
            const config = getSidebarConfig();
            const lines = isSidebar ? [...config.sidebarLines] : [...config.actionBarLines];
            lines.push(newLine);
            this.saveLines(player, lines, isSidebar, '§aLine added.');
        }
        return showPanel(player, listPanelId);
    }

    private async handleLineEdit(
        player: mc.Player,
        panelId: string,
        response: ModalFormResponse,
        context: UIContext
    ): Promise<void> {
        const isSidebar = panelId.startsWith('sidebar');
        const listPanelId = isSidebar ? 'sidebarLinesPanel' : 'actionBarLinesPanel';

        if (response.canceled) return showPanel(player, listPanelId);

        const values = response.formValues;
        const valuesArray = (isDefined(values) ? values : []) as (string | undefined)[];
        const newLine = valuesArray[0];
        const index = context.lineIndex as number;

        if (isNonEmptyString(newLine)) {
            const config = getSidebarConfig();
            const lines = isSidebar ? [...config.sidebarLines] : [...config.actionBarLines];
            lines[index] = newLine;
            this.saveLines(player, lines, isSidebar, '§aLine updated.');
        }
        return showPanel(player, listPanelId);
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
                let nextContext: UIContext = { ...context, page: 1, selectedItemId: item.id, id: item.id };
                if (item.actionValue === 'sidebarLineActionPanel' || item.actionValue === 'actionBarLineActionPanel') {
                    nextContext = { ...nextContext, lineIndex: Number(item.id) };
                }
                return showPanel(player, item.actionValue, nextContext);
            }

            const index = context.lineIndex as number;
            const isSidebar = panelId.startsWith('sidebar');
            const listPanelId = isSidebar ? 'sidebarLinesPanel' : 'actionBarLinesPanel';
            const config = getSidebarConfig();
            const lines = isSidebar ? [...config.sidebarLines] : [...config.actionBarLines];

            if (item.actionValue === 'editLine') {
                const target = isSidebar ? 'sidebarLineEditPanel' : 'actionBarLineEditPanel';
                return showPanel(player, target, { ...context, lineIndex: index });
            }

            if (item.actionValue === 'deleteLine') {
                lines.splice(index, 1);
                this.saveLines(player, lines, isSidebar, '§cLine deleted.');
                return showPanel(player, listPanelId);
            }

            if (item.actionValue === 'moveUp') {
                if (index > 0) {
                    const temp = lines[index - 1] ?? '';
                    lines[index - 1] = lines[index] ?? '';
                    lines[index] = temp;
                    this.saveLines(player, lines, isSidebar, '§aMoved up.');
                }
                return showPanel(player, listPanelId);
            }

            if (item.actionValue === 'moveDown') {
                if (index < lines.length - 1) {
                    const temp = lines[index + 1] ?? '';
                    lines[index + 1] = lines[index] ?? '';
                    lines[index] = temp;
                    this.saveLines(player, lines, isSidebar, '§aMoved down.');
                }
                return showPanel(player, listPanelId);
            }
        }
    }
}
