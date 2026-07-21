import { isFeatureActive } from '@core/featureManager.js';
import { hasPermission } from '@core/permissionEngine.js';
import { showPanel } from '@core/uiManager.js';
import { Player } from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';

export async function showMainPanel(player: Player): Promise<void> {
    const form = new ActionFormBuilder().title('Main Menu');

    if (isFeatureActive('eco.shop')) {
        form.button('Shop', 'textures/ui/trade_icon', async () => {
            await showPanel(player, 'shopMainPanel');
        });
    } else {
        form.button('Shop\n§0[§cDISABLED§0]', 'textures/ui/trade_icon', async () => {
            await showMainPanel(player);
        });
    }

    if (isFeatureActive('eco.ah')) {
        form.button('Auction House', 'textures/items/gold_ingot', async () => {
            const { showAuctionHouse } = await import('@features/auction/ui/panel.js');
            await showAuctionHouse(player, 1);
        });
    } else {
        form.button('Auction House\n§0[§cDISABLED§0]', 'textures/items/gold_ingot', async () => {
            await showMainPanel(player);
        });
    }

    if (isFeatureActive('game')) {
        form.button('Games', 'textures/ui/controller_glyph_color', async () => {
            await showPanel(player, 'gamesMainPanel');
        });
    } else {
        form.button('Games\n§0[§cDISABLED§0]', 'textures/ui/controller_glyph_color', async () => {
            await showMainPanel(player);
        });
    }

    form.button('Player List', 'textures/ui/icon_steve.png', async () => {
        const { showPlayerListPanel } = await import('@core/ui/panels/playerPanel.js');
        await showPlayerListPanel(player);
    });

    if (isFeatureActive('soc.team')) {
        form.button('Team', 'textures/ui/icon_multiplayer.png', async () => {
            await showPanel(player, 'teamMainPanel');
        });
    } else {
        form.button('Team\n§0[§cDISABLED§0]', 'textures/ui/icon_multiplayer.png', async () => {
            await showMainPanel(player);
        });
    }

    if (isFeatureActive('soc')) {
        form.button('Friends', 'textures/ui/icon_steve', async () => {
            await showPanel(player, 'friendMainPanel');
        });
    } else {
        form.button('Friends\n§0[§cDISABLED§0]', 'textures/ui/icon_steve', async () => {
            await showMainPanel(player);
        });
    }

    // Bounty depends on economy and bounties config, but let's map it roughly to economy for UI
    if (isFeatureActive('eco')) {
        form.button('Bounty List', 'textures/items/netherite_sword.png', async () => {
            await showPanel(player, 'bountyListPanel');
        });
    } else {
        form.button('Bounty List\n§0[§cDISABLED§0]', 'textures/items/netherite_sword.png', async () => {
            await showMainPanel(player);
        });
    }

    form.button('Info', 'textures/items/book_enchanted.png', async () => {
        await showPanel(player, 'infoPanel');
    });

    if (hasPermission(player, 'ui.panel.mod')) {
        form.button('Staff Dashboard', 'textures/ui/op', async () => {
            const { showStaffDashboardPanel } = await import('@core/ui/panels/adminPanel.js');
            await showStaffDashboardPanel(player);
        });
    }

    await form.show(player);
}
