import { getMenuItemsForHub, isMenuItemActive, MenuHubId } from '@core/ui/menuRegistry.js';
import { Player } from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';

/**
 * Renders a standard Ore UI category hub menu for a specific hub ID.
 */
export async function showHubPanel(player: Player, hubId: MenuHubId, titleText: string, bodyText?: string): Promise<void> {
    const items = getMenuItemsForHub(hubId, player);
    const form = new ActionFormBuilder().title(`§l§6${titleText}`);

    if (bodyText) {
        form.body(bodyText);
    }

    for (const item of items) {
        const active = isMenuItemActive(item);
        const buttonText = active ? `§l${item.title}${item.description ? `\n§r§8${item.description}` : ''}` : `§l${item.title}\n§r§0[§cDISABLED§0]`;

        form.button(buttonText, item.icon, async () => {
            if (!active) {
                player.sendMessage(`§cThe '${item.title}' feature is currently disabled.`);
                await showHubPanel(player, hubId, titleText, bodyText);
                return;
            }
            await item.action(player);
        });
    }

    if (hubId !== 'main') {
        form.addBackButton(async () => {
            await showMainPanel(player);
        });
    }

    await form.show(player);
}

export async function showMainPanel(player: Player): Promise<void> {
    await showHubPanel(player, 'main', 'Main Menu', 'Select a category to explore available options:');
}

export async function showEconomyHub(player: Player): Promise<void> {
    await showHubPanel(player, 'economy', 'Economy & Commerce', 'Access shops, auctions, kits, bounties and transfers:');
}

export async function showSocialHub(player: Player): Promise<void> {
    await showHubPanel(player, 'social', 'Social & Community', 'Manage friends, teams, online players and rank perks:');
}

export async function showGamesHub(player: Player): Promise<void> {
    await showHubPanel(player, 'games', 'Mini-Games Hub', 'Select a game to play:');
}

export async function showProfileHub(player: Player): Promise<void> {
    await showHubPanel(player, 'profile', 'Profile & Server Info', 'View your stats and server information:');
}
