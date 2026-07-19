import { showPanel } from '@core/uiManager.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';

export async function showWordleMainPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('Wordle Menu');

    form.button('Single Player', 'textures/ui/icon_recipe_item', async () => {
        await showPanel(player, 'wordleSinglePlayerPanel');
    });

    form.button('Staff Game', 'textures/ui/icon_recipe_item', async () => {
        await showPanel(player, 'wordleStaffGamePanel');
    });

    form.addBackButton(async () => {
        await showPanel(player, 'gamesMainPanel');
    });

    await form.show(player);
}
