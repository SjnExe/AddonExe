import { panelRouter } from '@ui/PanelRouter.js';
import { GamesPanelHandler } from './ui/gamesPanel.js';
import { WordlePanelHandler } from './wordle/ui/wordlePanel.js';

export async function initialize(isMigration: boolean) {
    panelRouter.register(new GamesPanelHandler());
    panelRouter.register(new WordlePanelHandler());

    // Register configurations
    const { loadGamesConfig, resetGamesConfig, registerConfigReset } = await import('@core/configurations.js');
    await loadGamesConfig(isMigration);
    registerConfigReset('games', {
        reset: resetGamesConfig,
        message: 'The games configuration section has been reset to default.'
    });

    const { loadWordleConfig, resetWordleConfig } = await import('@core/configurations.js');
    await loadWordleConfig(isMigration);
    registerConfigReset('wordle', {
        reset: resetWordleConfig,
        message: 'The wordle configuration section has been reset to default.'
    });

    // Commands will be registered via the standard `@commands/CommandRegistry.js` mechanism if they are standard commands, or inside here.
    const { registerWordleCommands } = await import('./wordle/commands/wordle.js');
    registerWordleCommands();

    const { registerGuessCommand } = await import('./wordle/commands/guess.js');
    registerGuessCommand();
}
