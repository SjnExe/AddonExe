import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getSidebarConfig, saveSidebarConfig } from '@core/configurations.js';
import { forceUpdate } from '@core/sidebarManager.js';
import { showPanel } from '@core/uiManager.js';
import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions, PanelItem, UIContext } from '@ui/panelRegistry.js';
import { IPanelHandler } from '@ui/types.js';

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

    getBody(_player: mc.Player, panelId: string, _context: UIContext): Promise<string | null> {
        if (panelId === 'placeholderListPanel') {
            return Promise.resolve(
                `§l§6Global Placeholders§r (Scoreboard, Floating Text)\n` +
                    `{server_name}, {tps}, {online}, {max_players}, {time}, {date}\n\n` +
                    `§l§dPersonal Placeholders§r (Action Bar Only)\n` +
                    `{name}, {money}, {rank}, {kills}, {deaths}, {streak}, {kdr}, {playtime}, {team}, {ping}, {x}, {y}, {z}, {dimension}`
            );
        }
        return Promise.resolve(null);
    }

    getItems(_player: mc.Player, panelId: string, _context: UIContext): Promise<PanelItem[]> {
        const items: PanelItem[] = [];

        if (panelId === 'sidebarMainPanel') {
            const staticItems = getStaticMenuItems(panelDefinitions[panelId], 1); // Admin
            items.push(...staticItems);
            return Promise.resolve(items);
        }

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

        if (panelId === 'sidebarLinesPanel' || panelId === 'actionBarLinesPanel') {
            addBack('sidebarMainPanel');
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

            lines.forEach((line, idx) => {
                items.push({
                    id: String(idx),
                    text: `${idx + 1}. ${line}`,
                    permissionLevel: 1,
                    actionType: 'openPanel',
                    actionValue: isSidebar ? 'sidebarLineActionPanel' : 'actionBarLineActionPanel'
                });
            });
            return Promise.resolve(items);
        }

        if (panelId === 'sidebarLineActionPanel' || panelId === 'actionBarLineActionPanel') {
            const isSidebar = panelId === 'sidebarLineActionPanel';
            addBack(isSidebar ? 'sidebarLinesPanel' : 'actionBarLinesPanel');
            items.push({
                id: 'edit',
                text: 'Edit',
                icon: 'textures/ui/icon_setting',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'editLine'
            });
            items.push({
                id: 'moveUp',
                text: 'Move Up',
                icon: 'textures/gui/controls/up',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'moveUp'
            });
            items.push({
                id: 'moveDown',
                text: 'Move Down',
                icon: 'textures/gui/controls/down',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'moveDown'
            });
            items.push({
                id: 'delete',
                text: 'Delete',
                icon: 'textures/ui/trash',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'deleteLine'
            });
            return Promise.resolve(items);
        }

        return Promise.resolve(items);
    }

    buildModal(_player: mc.Player, panelId: string, context: UIContext): Promise<ModalFormData | null> {
        if (panelId === 'sidebarLineEditPanel') {
            const config = getSidebarConfig();
            const lines = config.sidebarLines;
            const index = (context.lineIndex as number) ?? 0;
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
            const index = (context.lineIndex as number) ?? 0;
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

        const isSidebar = panelId.startsWith('sidebar');
        const listPanelId = isSidebar || panelId === 'sidebarLinesPanel' ? 'sidebarLinesPanel' : 'actionBarLinesPanel';
        const config = getSidebarConfig();
        const lines =
            isSidebar || panelId === 'sidebarLinesPanel' ? [...config.sidebarLines] : [...config.actionBarLines];

        // Helper to save
        const save = (msg: string) => {
            if (isSidebar || panelId === 'sidebarLinesPanel') config.sidebarLines = lines;
            else config.actionBarLines = lines;
            saveSidebarConfig(config);
            forceUpdate();
            player.sendMessage(msg);
        };

        if (panelId === 'sidebarLineAddPanel' || panelId === 'actionBarLineAddPanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, listPanelId);
            const [newLine] = values as [string];
            if (newLine) {
                lines.push(newLine);
                save('§aLine added.');
            }
            return showPanel(player, listPanelId);
        }

        if (panelId === 'sidebarLineEditPanel' || panelId === 'actionBarLineEditPanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, listPanelId);
            const [newLine] = values as [string];
            const index = context.lineIndex as number;
            if (newLine !== undefined) {
                lines[index] = newLine;
                save('§aLine updated.');
            }
            return showPanel(player, listPanelId);
        }

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];

                if (item.actionType === 'openPanel') {
                    // Inject lineIndex if needed
                    let nextContext: UIContext = { ...context, page: 1, selectedItemId: item.id, id: item.id };
                    if (
                        item.actionValue === 'sidebarLineActionPanel' ||
                        item.actionValue === 'actionBarLineActionPanel'
                    ) {
                        nextContext = { ...nextContext, lineIndex: Number(item.id) };
                    }
                    return showPanel(player, item.actionValue, nextContext);
                }

                const index = context.lineIndex as number;

                if (item.actionValue === 'editLine') {
                    const target = isSidebar ? 'sidebarLineEditPanel' : 'actionBarLineEditPanel';
                    return showPanel(player, target, { ...context, lineIndex: index });
                }

                if (item.actionValue === 'deleteLine') {
                    lines.splice(index, 1);
                    save('§cLine deleted.');
                    return showPanel(player, listPanelId);
                }

                if (item.actionValue === 'moveUp') {
                    if (index > 0) {
                        [lines[index - 1], lines[index]] = [lines[index], lines[index - 1]];
                        save('§aMoved up.');
                    }
                    return showPanel(player, listPanelId);
                }

                if (item.actionValue === 'moveDown') {
                    if (index < lines.length - 1) {
                        [lines[index + 1], lines[index]] = [lines[index], lines[index + 1]];
                        save('§aMoved down.');
                    }
                    return showPanel(player, listPanelId);
                }
            }
        }
    }
}
