export async function initialize(_isMigration: boolean) {
    // Register configurations
    const { resetGamesConfig, registerConfigReset } = await import('@core/configurations.js');
    registerConfigReset('games', {
        reset: resetGamesConfig,
        message: 'The games configuration section has been reset to default.'
    });

    const { resetWordleConfig } = await import('@core/configurations.js');
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
