import * as mc from '@minecraft/server';

import { constants } from '../../core/constants.js';
import { errorLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';
import { playSound } from '../../core/utils.js';

import { CustomCommand, CommandExecutor } from './commandManager.js';

const copyinvCommand: CustomCommand = {
    name: 'copyinv',
    description: "Copies a player's inventory, replacing your own.",
    permissionLevel: 2,
    parameters: [{ name: 'target', type: 'player' }],
    execute: (executor: CommandExecutor, args: Record<string, any>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const { target } = args as { target?: mc.Player[] };

        if (!target || target.length === 0) {
            sendMessage('§cPlayer not found.', executor);
            return;
        }

        const targetPlayer = target[0];

        if (executor.id === targetPlayer.id) {
            sendMessage('§cYou cannot copy your own inventory.', executor);
            return;
        }

        try {
            const playerInv = executor.getComponent('inventory')?.container;
            const targetInv = targetPlayer.getComponent('inventory')?.container;

            if (!playerInv || !targetInv) {
                sendMessage('§cCould not access inventories.', executor);
                return;
            }

            playerInv.clearAll();

            for (let i = 0; i < targetInv.size; i++) {
                const item = targetInv.getItem(i);
                if (item) {
                    playerInv.setItem(i, item);
                }
            }
            sendMessage(`§aSuccessfully copied inventory from ${targetPlayer.name}.`, executor);
            playSound(executor, constants.soundTeleport);
        } catch (e: any) {
            sendMessage('§cFailed to copy inventory.', executor);
            errorLog(`[/copyinv] Error: ${e.stack}`);
        }
    }
};

export default copyinvCommand;
