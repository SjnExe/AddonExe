import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { commandManager } from '@commands/commandManager.js';
import { getConfig, updateMultipleConfig } from '@core/configManager.js';
import { showPanel } from '@core/uiManager.js';
import { IPanelHandler, MainConfig, PanelItem, UIContext } from '@ui/types.js';
import { addBackButton, addPaginationItems, getPaginatedItems } from '@ui/uiUtils.js';

interface CmdSettings {
    enabled?: boolean;
    permissionLevel?: number;
    cooldownSeconds?: number;
}

export class CommandPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'commandSystemPanel' || panelId.startsWith('commandSettingsPanel_');
    }

    getItems(_player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        const items: PanelItem[] = [];

        if (panelId === 'commandSystemPanel') {
            addBackButton(items, 'configCategoryPanel');

            const commands = [...commandManager.commands.values()].toSorted((a, b) => a.name.localeCompare(b.name));

            const config = getConfig() as unknown as MainConfig;
            const settings = (config.commandSettings || {}) as Record<string, CmdSettings>;

            const paginated = getPaginatedItems(commands, (context.page as number) || 1);

            for (const cmd of paginated) {
                if (!cmd) continue;
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
            }
            addPaginationItems(items, (context.page as number) || 1, commands.length);
            return Promise.resolve(items);
        }
        return Promise.resolve(items);
    }

    buildModal(_player: mc.Player, panelId: string, _context: UIContext): Promise<ModalFormData | null> {
        if (panelId.startsWith('commandSettingsPanel_')) {
            const cmdName = panelId.replace('commandSettingsPanel_', '');
            const config = getConfig() as unknown as MainConfig;
            const settings = (config.commandSettings || {}) as Record<string, CmdSettings>;
            const cmdSettings = settings[cmdName] || {};
            const command = commandManager.commands.get(cmdName);

            const isEnabled = cmdSettings.enabled !== false;
            const perm = cmdSettings.permissionLevel ?? command?.permissionLevel ?? 0;
            const cooldown = cmdSettings.cooldownSeconds ?? command?.defaultCooldown ?? 0;

            return Promise.resolve(
                new ModalFormData()
                    .title(`Edit /${cmdName}`)
                    .toggle('Enabled', { defaultValue: isEnabled })
                    .textField('Permission Level', '0=Owner, 1=Admin...', { defaultValue: String(perm) })
                    .textField('Cooldown (seconds)', '0 to disable', { defaultValue: String(cooldown) })
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

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];
                if (!item) return;
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
                const perm = Number.parseInt(permStr) || 0;
                const cooldown = Number.parseInt(cooldownStr) || 0;

                const updates: Record<string, unknown> = {
                    [`commandSettings.${cmdName}.enabled`]: enabled,
                    [`commandSettings.${cmdName}.permissionLevel`]: perm,
                    [`commandSettings.${cmdName}.cooldownSeconds`]: cooldown
                };

                updateMultipleConfig(updates);
                player.sendMessage(`§2Updated /${cmdName}.`);
            }
            return showPanel(player, 'commandSystemPanel', context);
        }
    }
}
