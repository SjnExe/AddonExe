/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { getConfig } from '@core/configManager.js';
import { getValueFromPath } from '@core/objectUtils.js';
import { hasPermission } from '@core/permissionEngine.js';
import { showPanel } from '@core/uiManager.js';
import { Player } from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';

export async function showMainPanel(player: Player): Promise<void> {
    const config = getConfig();
    const form = new ActionFormBuilder().title('Main Menu');

    if (getValueFromPath(config, 'shop.enabled') !== false) {
        form.button('Shop', 'textures/ui/trade_icon', async () => {
            await showPanel(player, 'shopMainPanel');
        });
    }

    form.button('Auction House', 'textures/items/gold_ingot', async () => {
        const { openAuctionHouse } = (await import('@core/ui/actionRegistry.js').then((m) => m.uiActionFunctions)) as never;
        await openAuctionHouse(player, {}, 'mainPanel');
    });

    if (getValueFromPath(config, 'games.enabled') !== false) {
        form.button('Games', 'textures/ui/controller_icon.png', async () => {
            await showPanel(player, 'gamesMainPanel');
        });
    }

    form.button('Player List', 'textures/ui/icon_steve.png', async () => {
        const { showPlayerListPanel } = await import('@core/ui/panels/playerPanel.js');
        await showPlayerListPanel(player);
    });

    form.button('Team', 'textures/ui/icon_multiplayer.png', async () => {
        await showPanel(player, 'teamMainPanel');
    });

    form.button('Friends', 'textures/ui/icon_steve', async () => {
        await showPanel(player, 'friendMainPanel');
    });

    form.button('Bounty List', 'textures/items/netherite_sword.png', async () => {
        await showPanel(player, 'bountyListPanel');
    });

    form.button('Profile', 'textures/ui/profile_glyph_color', async () => {
        await showPanel(player, 'profileMainPanel');
    });

    form.button('Server Info', 'textures/items/book_enchanted.png', async () => {
        await showPanel(player, 'infoPanel');
    });

    form.button('Rules', 'textures/items/book_enchanted.png', async () => {
        const { showRules } = (await import('@core/ui/actionRegistry.js').then((m) => m.uiActionFunctions)) as never;
        if (showRules) await showRules(player, {}, 'mainPanel');
    });

    form.button('Helpful Links', 'textures/items/chain', async () => {
        const { showHelpfulLinks } = (await import('@core/ui/actionRegistry.js').then((m) => m.uiActionFunctions)) as never;
        if (showHelpfulLinks) await showHelpfulLinks(player, {}, 'mainPanel');
    });

    if (hasPermission(player, 'ui.panel.mod')) {
        form.button('Staff Dashboard', 'textures/ui/op', async () => {
            const { showStaffDashboardPanel } = await import('@core/ui/panels/adminPanel.js');
            await showStaffDashboardPanel(player);
        });
    }

    form.addCloseButton();
    await form.show(player);
}
