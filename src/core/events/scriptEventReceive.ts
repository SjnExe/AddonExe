import * as mc from '@minecraft/server';

import { CommandExecutor } from '@commands/commandManager.js';

import { getConfig, updateConfig } from '../configManager.js';
import { errorLog, infoLog, warnLog } from '../logger.js';
import { updateAllPlayerRanks } from '../main.js';
import * as rankManager from '../rankManager.js';
import { startRestart } from '../restartManager.js';

export function handleScriptEventReceive(event: mc.ScriptEventCommandMessageAfterEvent) {
    const { id, sourceEntity } = event;

    // Handle script unload event
    if (id === 'minecraft:script_unload') {
        // Script unload is handled by a subscription in main.js for now,
        // as it requires access to cleanupAddon which is local to main.js.
        // We might refactor this later.
        return;
    }

    const config = getConfig(); // Config should be loaded by the time this event fires for custom events.
    if (!config) {
        return;
    }

    switch (id) {
        case 'exe:restart': {
            if (sourceEntity instanceof mc.Player) {
                startRestart(sourceEntity);
            } else if (!sourceEntity) {
                // If no source entity, assume console/server
                startRestart({
                    sendMessage: (msg: string) => warnLog(msg),
                    name: 'Console',
                    isConsole: true
                } as CommandExecutor);
            }
            break;
        }

        case 'exe:toggle_chat_log': {
            if (sourceEntity instanceof mc.Player) {
                const rank = rankManager.getPlayerRank(sourceEntity, config);
                if (rank.permissionLevel > 1 && !sourceEntity.isOp()) {
                    sourceEntity.sendMessage('§cYou do not have permission to toggle chat logs.');
                    break;
                }

                const chatConfig = config.chat || { logToConsole: false };
                const newValue = !chatConfig.logToConsole;
                chatConfig.logToConsole = newValue;
                updateConfig('chat', chatConfig);

                const feedbackMessage = `§aChat-to-console has been ${newValue ? '§aenabled' : '§cdisabled'}§a.`;
                sourceEntity.sendMessage(feedbackMessage);
                infoLog(`[AddonExe] ${feedbackMessage}`);
            }
            break;
        }

        case 'exe:grant_admin_self': {
            if (sourceEntity instanceof mc.Player) {
                if (!sourceEntity.isOp()) {
                    sourceEntity.sendMessage('§cYou must be a server operator to use this command.');
                    break;
                }

                const adminRank = rankManager.getRankById('admin');
                if (!adminRank) {
                    errorLog(
                        '[AddonExe] Could not grant admin rank because the "admin" rank definition was not found.'
                    );
                    sourceEntity.sendMessage('§cError: The admin rank is not configured.');
                    return;
                }

                const adminTagCondition = adminRank.conditions.find((c) => c.type === 'hasTag');
                if (!adminTagCondition || !adminTagCondition.value || typeof adminTagCondition.value !== 'string') {
                    errorLog('[AddonExe] Could not grant admin rank because it lacks a valid "hasTag" condition.');
                    sourceEntity.sendMessage('§cError: The admin rank is not configured with a valid tag.');
                    return;
                }

                sourceEntity.addTag(adminTagCondition.value);
                sourceEntity.sendMessage('§aYou have been promoted to Admin.');
                updateAllPlayerRanks();
            }
            break;
        }
    }
}
