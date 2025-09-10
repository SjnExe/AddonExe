import { commandManager } from './commandManager.js';

const FROZEN_TAG = 'frozen';

export function freezePlayer(executor, targetPlayer) {
    if (targetPlayer.hasTag(FROZEN_TAG)) {
        executor.sendMessage(`§ePlayer ${targetPlayer.name} is already frozen.`);
        return;
    }
    targetPlayer.addTag(FROZEN_TAG);
    targetPlayer.addEffect('slowness', 2000000, { amplifier: 255, showParticles: false });
    const announcer = executor.isConsole ? 'the Console' : executor.name;
    executor.sendMessage(`§aSuccessfully froze ${targetPlayer.name}.`);
    targetPlayer.sendMessage(`§cYou have been frozen by ${announcer}.`);
}

export function unfreezePlayer(executor, targetPlayer) {
    if (!targetPlayer.hasTag(FROZEN_TAG)) {
        executor.sendMessage(`§ePlayer ${targetPlayer.name} is not frozen.`);
        return;
    }
    targetPlayer.removeTag(FROZEN_TAG);
    targetPlayer.removeEffect('slowness');
    executor.sendMessage(`§aSuccessfully unfroze ${targetPlayer.name}.`);
    targetPlayer.sendMessage('§aYou have been unfrozen.');
}

commandManager.register({
    name: 'freeze',
    description: 'Freezes a player, preventing them from moving.',
    category: 'Moderation',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to freeze.' }
    ],
    execute: (player, args) => {
        const targetPlayer = args.target[0];
        if (!targetPlayer) {
            player.sendMessage('§cPlayer not found.');
            return;
        }
        if (!player.isConsole && player.id === targetPlayer.id) {
            player.sendMessage('§cYou cannot freeze yourself.');
            return;
        }
        freezePlayer(player, targetPlayer);
    }
});

commandManager.register({
    name: 'unfreeze',
    description: 'Unfreezes a player, allowing them to move again.',
    category: 'Moderation',
    permissionLevel: 1,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to unfreeze.' }
    ],
    execute: (player, args) => {
        const targetPlayer = args.target[0];
        if (!targetPlayer) {
            player.sendMessage('§cPlayer not found.');
            return;
        }
        unfreezePlayer(player, targetPlayer);
    }
});
