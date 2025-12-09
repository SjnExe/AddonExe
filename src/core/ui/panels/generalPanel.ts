import * as mc from '@minecraft/server';

import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions, PanelItem, UIContext } from '@ui/panelRegistry.js';
import { IPanelHandler } from '@ui/types.js';

export class GeneralPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return (
            panelId === 'mainPanel' ||
            panelId === 'gameplayPanel' ||
            panelId === 'bountyActionsPanel' ||
            panelId === 'bountyListPanel'
        );
    }

    getItems(_player: mc.Player, panelId: string, _context: UIContext): Promise<PanelItem[]> {
        const items: PanelItem[] = [];
        const def = panelDefinitions[panelId];
        if (def) {
            const staticItems = getStaticMenuItems(def, 1); // Default perm 1 (checked per item)
            items.push(...staticItems);
        }
        return Promise.resolve(items);
    }
}
