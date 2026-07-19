import { getConfig } from '@core/configManager.js';
import { showPanel } from '@core/uiManager.js';
import { getHelpfulLinks } from '@features/essentials/helpfulLinksManager.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';

export async function showInfoPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('Info');

    form.button('My Stats', 'textures/ui/profile_glyph_color', async () => {
        await showPanel(player, 'profileMainPanel');
    });

    form.button('Server Rules', 'textures/items/book_enchanted.png', async () => {
        await showServerRulesPanel(player);
    });

    form.button('Helpful Links', 'textures/items/chain.png', async () => {
        await showHelpfulLinksPanel(player);
    });

    form.addBackButton(async () => {
        await showPanel(player, 'mainPanel');
    });

    await form.show(player);
}

export async function showServerRulesPanel(player: mc.Player): Promise<void> {
    const config = getConfig();
    const rules = config.serverInfo.rules;

    const form = new ActionFormBuilder().title('Server Rules');

    if (rules.length === 0) {
        form.body('No rules have been set by the server administrator.');
    } else {
        const rulesText = rules.join('\n\n');
        form.body(`§l§a--- Server Rules ---\n\n§r${rulesText}`);
    }

    form.addBackButton(async () => {
        await showInfoPanel(player);
    });

    await form.show(player);
}

export async function showHelpfulLinksPanel(player: mc.Player): Promise<void> {
    const links = getHelpfulLinks();

    const form = new ActionFormBuilder().title('Helpful Links');

    if (links.length === 0) {
        form.body('No helpful links have been provided.');
    } else {
        const linksText = links.map((link) => `§l${link.title}§r\n§b${link.url}§r`).join('\n\n');
        form.body(linksText);
    }

    form.addBackButton(async () => {
        await showInfoPanel(player);
    });

    await form.show(player);
}
