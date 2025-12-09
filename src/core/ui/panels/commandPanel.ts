import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { commandManager } from '@modules/commands/commandManager.js';
import { getConfig, updateMultipleConfig } from '../../configManager.js';
import { showPanel } from '../../uiManager.js';
import { IPanelHandler, MainConfig, PanelItem, UIContext } from '../types.js';
import { getPaginatedItems, itemsPerPage } from '../uiUtils.js';

interface CmdSettings {
    enabled?: boolean;
    permissionLevel?: number;
    cooldownSeconds?: number;
}

export class CommandPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'commandSystemPanel' || panelId.startsWith('commandSettingsPanel_');
    }

    async getItems(_player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        await Promise.resolve();
        const items: PanelItem[] = [];

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

        if (panelId === 'commandSystemPanel') {
            items.push({
                id: '__back__',
                text: '§l§8< Back',
                icon: 'textures/gui/controls/left.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'configCategoryPanel'
            });

            const commands = Array.from(commandManager.commands.values()).sort((a, b) => a.name.localeCompare(b.name));

            const config = getConfig() as unknown as MainConfig;
            const settings = (config.commandSettings || {}) as Record<string, CmdSettings>;

            const paginated = getPaginatedItems(commands, (context.page as number) || 1);

            paginated.forEach((cmd) => {
                const cmdSettings = settings[cmd.name] || {};
                const isEnabled = cmdSettings.enabled !== false;
                const color = isEnabled ? '§2' : '§4';
                const perm = cmdSettings.permissionLevel ?? cmd.permissionLevel ?? 0;

                items.push({
                    id: cmd.name,
                    text: `${color}/${cmd.name}§r\nPerm: ${perm}`,
                    icon: 'textures/ui/command_block_icon',
                    permissionLevel: 0,
                    actionType: 'openPanel',
                    actionValue: `commandSettingsPanel_${cmd.name}`
                });
            });
            addPagination(commands.length);
            return items;
        }
        return items;
    }

    async buildModal(_player: mc.Player, panelId: string, _context: UIContext): Promise<ModalFormData | null> {
        await Promise.resolve();
        if (panelId.startsWith('commandSettingsPanel_')) {
            const cmdName = panelId.replace('commandSettingsPanel_', '');
            const config = getConfig() as unknown as MainConfig;
            const settings = (config.commandSettings || {}) as Record<string, CmdSettings>;
            const cmdSettings = settings[cmdName] || {};
            const command = commandManager.commands.get(cmdName);

            const isEnabled = cmdSettings.enabled !== false;
            const perm = cmdSettings.permissionLevel ?? command?.permissionLevel ?? 0;
            const cooldown = cmdSettings.cooldownSeconds ?? command?.defaultCooldown ?? 0;

            return new ModalFormData()
                .title(`Edit /${cmdName}`)
                .toggle('Enabled', { defaultValue: isEnabled })
                .textField('Permission Level', '0=Owner, 1=Admin...', { defaultValue: String(perm) })
                .textField('Cooldown (seconds)', '0 to disable', { defaultValue: String(cooldown) });
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
        const values = (response as ModalFormResponse).formValues;

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];
                if (item.actionType === 'openPanel') {
                    return showPanel(player, item.actionValue, { ...context, page: 1 });
                }
                if (item.actionValue === 'prevPage') {
                    return showPanel(player, panelId, {
                        ...context,
                        page: Math.max(1, ((context.page as number) || 1) - 1)
                    });
                }
                if (item.actionValue === 'nextPage') {
                    return showPanel(player, panelId, { ...context, page: ((context.page as number) || 1) + 1 });
                }
            }
        }

        if (panelId.startsWith('commandSettingsPanel_')) {
            const cmdName = panelId.replace('commandSettingsPanel_', '');
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'commandSystemPanel', context);

            if (values) {
                const [enabled, permStr, cooldownStr] = values as [boolean, string, string];
                const perm = parseInt(permStr) || 0;
                const cooldown = parseInt(cooldownStr) || 0;

                const updates: Record<string, unknown> = {};
                updates[`commandSettings.${cmdName}.enabled`] = enabled;
                updates[`commandSettings.${cmdName}.permissionLevel`] = perm;
                updates[`commandSettings.${cmdName}.cooldownSeconds`] = cooldown;

                updateMultipleConfig(updates);
                player.sendMessage(`§2Updated /${cmdName}.`);
            }
            return showPanel(player, 'commandSystemPanel', context);
        }
    }
}
