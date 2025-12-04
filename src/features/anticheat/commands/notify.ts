import * as mc from '@minecraft/server';
import { CustomCommand, CommandExecutor } from '@modules/commands/commandManager.js';
import { getPlayer } from '../../../core/playerDataManager.js';

const notifyCommand: CustomCommand = {
    name: 'notify',
    description: 'Toggle anti-cheat notifications.',
    category: 'Moderation',
    permissionLevel: 2, // Mod
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) return;

        const pData = getPlayer(executor.id);
        if (!pData || pData.permissionLevel > 2) {
            executor.sendMessage('§cYou do not have permission to use this command.');
            return;
        }

        const tag = 'exe:ac_notify_off';
        if (executor.hasTag(tag)) {
            executor.removeTag(tag);
            executor.sendMessage('§aAnti-Cheat notifications enabled.');
        } else {
            executor.addTag(tag);
            executor.sendMessage('§cAnti-Cheat notifications disabled.');
        }
    }
};

export default notifyCommand;
