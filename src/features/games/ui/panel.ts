import { isFeatureActive } from '@core/services/featureManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

export async function showGamesMainPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('Games');

    if (isFeatureActive('game.tictactoe')) {
        form.button('Tic-Tac-Toe (2P)', 'textures/ui/controller_glyph_color', async () => {
            await showPanel(player, 'ticTacToeMainPanel');
        });
    } else {
        form.button('Tic-Tac-Toe\n§0[§cDISABLED§0]', 'textures/ui/controller_glyph_color', async () => {
            await showGamesMainPanel(player);
        });
    }

    if (isFeatureActive('game.rps')) {
        form.button('Rock Paper Scissors', 'textures/items/shears', async () => {
            await showPanel(player, 'rpsMainPanel');
        });
    } else {
        form.button('Rock Paper Scissors\n§0[§cDISABLED§0]', 'textures/items/shears', async () => {
            await showGamesMainPanel(player);
        });
    }

    if (isFeatureActive('game.minesweeper')) {
        form.button('Minesweeper', 'textures/items/iron_pickaxe', async () => {
            await showPanel(player, 'minesweeperMainPanel');
        });
    } else {
        form.button('Minesweeper\n§0[§cDISABLED§0]', 'textures/items/iron_pickaxe', async () => {
            await showGamesMainPanel(player);
        });
    }

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
