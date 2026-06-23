import { showPanel } from '@core/uiManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormResponse } from '@minecraft/server-ui';
import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions, PanelItem, UIContext } from '@ui/panelRegistry.js';
import { IPanelHandler } from '@ui/types.js';

export class GamesPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'gamesMainPanel' || panelId === 'wordleMainPanel';
    }

    getItems(player: mc.Player, panelId: string, _context: UIContext): Promise<PanelItem[]> {
        const items: PanelItem[] = [];
        const def = panelDefinitions[panelId];
        if (isDefined(def)) {
            const staticItems = getStaticMenuItems(player, def);
            items.push(...staticItems);
        }
        return Promise.resolve(items);
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse, context: UIContext): Promise<void> {
        if (response.canceled || response.selection === undefined) return;

        const items = await this.getItems(player, panelId, context);
        if (response.selection >= 0 && response.selection < items.length) {
            const item = items[response.selection];
            if (!isDefined(item)) return;
            if (item.actionType === 'openPanel') {
                return showPanel(player, item.actionValue, { ...context, page: 1 });
            }
            const { uiActionFunctions } = await import('@core/ui/actionRegistry.js');
            const action = uiActionFunctions[item.actionValue];
            if (isDefined(action)) {
                await action(player, context, panelId);
                return;
            }
            player.sendMessage(`§cAction ${item.actionValue} not mapped.`);
        }
    }
}
