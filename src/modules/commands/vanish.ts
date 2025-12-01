import * as mc from '@minecraft/server';

import { constants } from '@core/constants.js';
import { sendMessage } from '@core/messaging.js';

import { CustomCommand, CommandExecutor } from './commandManager.js';

const vanishCommand: CustomCommand = {
    name: 'vanish',
    aliases: ['v'],
    description: 'Makes you invisible to other players.',
    permissionLevel: 2,
    allowConsole: false,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const isVanished = executor.hasTag(constants.vanishedTag);

        if (isVanished) {
            executor.removeTag(constants.vanishedTag);
            executor.removeEffect('invisibility');
            sendMessage('§aYou are no longer vanished. You are now visible to other players.', executor);
            mc.world.sendMessage(`§e${executor.name} joined the game.`);
        } else {
            executor.addTag(constants.vanishedTag);
            executor.addEffect('invisibility', 2000000, { amplifier: 1, showParticles: false });
            sendMessage('§aYou are now vanished. You are hidden from other players.', executor);
            mc.world.sendMessage(`§e${executor.name} left the game.`);
        }
    }
};

export default vanishCommand;
