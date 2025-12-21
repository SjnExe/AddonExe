import * as mc from '@minecraft/server';
import { ActionFormResponse } from '@minecraft/server-ui';
import { IPanelHandler, PanelItem, UIContext } from '@ui/types.js';
import { showPanel } from '@core/uiManager.js';
import { getGamesConfig } from '@core/configurations.js';
import { gameManager } from '../gameManager.js';
import { addBackButton } from '@ui/uiUtils.js';

export class GamesPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'gamesPanel';
    }

    async getItems(_player: mc.Player, _panelId: string, _context: UIContext): Promise<PanelItem[]> {
        await Promise.resolve();
        const items: PanelItem[] = [];
        addBackButton(items, 'gameplayPanel');

        if (!getGamesConfig().enabled) {
            items.push({
                id: 'games_disabled',
                text: '§cGames Disabled',
                permissionLevel: 1024,
                actionType: 'none',
                actionValue: ''
            });
            return items;
        }

        const defs = gameManager.getAllDefinitions();
        const config = getGamesConfig();

        for (const def of defs) {
            if (def.id === 'wordGuess') continue;

            // Check individual game enabled status safely
            const gameConfig = (config as any)[def.id];
            if (gameConfig && gameConfig.enabled === false) continue;

            items.push({
                id: def.id,
                text: def.name,
                icon: def.icon,
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'playGame'
            });
        }
        return items;
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse, context: UIContext): Promise<void> {
        const selection = response.selection;
        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            const item = items[selection];
            if (!item) return;

            if (item.actionType === 'openPanel') {
                return showPanel(player, item.actionValue, context);
            }

            if (item.actionValue === 'playGame') {
                const gameId = item.id;
                const def = gameManager.getDefinition(gameId);
                if (def) {
                    const game = def.factory();
                    game.start([player]);
                }
            }
        }
    }
}
