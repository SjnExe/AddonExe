import * as mc from '@minecraft/server';
import { ActionFormResponse } from '@minecraft/server-ui';

import { getConfig } from '@core/configManager.js';
import { getValueFromPath } from '@core/objectUtils.js';
import { showPanel } from '@core/uiManager.js';
import { isDefined } from '@lib/guards.js';
import { ActionFormBuilder } from '@ui/builders/index.js';
import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions, PanelItem, UIContext } from '@ui/panelRegistry.js';
import { IPanelHandler } from '@ui/types.js';

export async function showMainPanel(player: mc.Player, context: UIContext = {}): Promise<void> {
    const config = getConfig();
    const isFeatureEnabled = (path: string) => getValueFromPath(config, path) === true;

    const form = new ActionFormBuilder().title('Main Menu');

    form.button(
        'Shop',
        'textures/ui/trade_icon',
        async () => {
            await showPanel(player, 'shopMainPanel', { ...context, page: 1 });
        },
        'ui.panel.member',
        isFeatureEnabled('shop.enabled')
    );

    form.button(
        'Auction House',
        'textures/items/gold_ingot',
        async () => {
            const { uiActionFunctions } = await import('@core/ui/actionRegistry.js');
            await uiActionFunctions['openAuctionHouse']?.(player, context, 'mainPanel');
        },
        'ui.panel.member'
    );

    form.button(
        'Games',
        'textures/ui/controller_icon.png',
        async () => {
            await showPanel(player, 'gamesMainPanel', { ...context, page: 1 });
        },
        'ui.panel.member',
        isFeatureEnabled('games.enabled')
    );

    form.button(
        'Player List',
        'textures/ui/icon_steve.png',
        async () => {
            await showPanel(player, 'playerListPanel', { ...context, page: 1 });
        },
        'ui.panel.member'
    );

    form.button(
        'Team',
        'textures/ui/icon_multiplayer.png',
        async () => {
            await showPanel(player, 'teamMainPanel', { ...context, page: 1 });
        },
        'ui.panel.member'
    );

    form.button(
        'Friends',
        'textures/ui/icon_steve',
        async () => {
            await showPanel(player, 'friendMainPanel', { ...context, page: 1 });
        },
        'ui.panel.member'
    );

    form.button(
        'Bounty List',
        'textures/items/netherite_sword.png',
        async () => {
            await showPanel(player, 'bountyListPanel', { ...context, page: 1 });
        },
        'ui.panel.member'
    );

    form.button(
        'Profile',
        'textures/ui/profile_glyph_color',
        async () => {
            await showPanel(player, 'profileMainPanel', { ...context, page: 1 });
        },
        'ui.panel.member'
    );

    form.button(
        'Server Info',
        'textures/items/book_enchanted.png',
        async () => {
            await showPanel(player, 'infoPanel', { ...context, page: 1 });
        },
        'ui.panel.member'
    );

    form.button(
        'Staff Dashboard',
        'textures/ui/op',
        async () => {
            await showPanel(player, 'staffDashboardPanel', { ...context, page: 1 });
        },
        'ui.panel.mod'
    );

    await form.show(player);
}

export class GeneralPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        // 'mainPanel' is removed from here since it's now handled functionally.
        return panelId === 'profileMainPanel' || panelId === 'bountyActionsPanel' || panelId === 'bountyListPanel';
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
