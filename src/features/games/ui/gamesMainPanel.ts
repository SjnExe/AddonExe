import { isFeatureActive } from '@core/featureManager.js';
import { showPanel } from '@core/uiManager.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';

export async function showGamesMainPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('Games');

    if (isFeatureActive('game.wordle')) {
        form.button('Wordle', 'textures/ui/icon_recipe_item', async () => {
            await showPanel(player, 'wordleMainPanel', { page: 1 });
        });
    } else {
        form.button('Wordle\n§0[§cDISABLED§0]', 'textures/ui/icon_recipe_item', async () => {
            await showGamesMainPanel(player);
        });
    }

    form.addBackButton(async () => {
        await showPanel(player, 'mainPanel');
    });

    await form.show(player);
}
