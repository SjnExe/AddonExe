import * as mc from '@minecraft/server';

import { CommandExecutor } from '@commands/commandManager.js';

import { getConfig, updateConfig } from '@core/configManager.js';
import { errorLog, infoLog, warnLog } from '@core/logger.js';
import { updateAllPlayerRanks } from '@core/main.js';
import * as rankManager from '@core/rankManager.js';
import { startRestart } from '@features/essentials/restartManager.js';
import { isNonEmptyString } from '@lib/guards.js';

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

    switch (id) {
        case 'exe:restart': {
            if (sourceEntity instanceof mc.Player) {
                startRestart(sourceEntity);
            } else if (!sourceEntity) {
                // If no source entity, assume console/server
                const executor: CommandExecutor = {
                    sendMessage: (msg: string | mc.RawMessage) => warnLog(typeof msg === 'string' ? msg : 'RawMessage'),
                    name: 'Console',
                    isConsole: true
                };
                startRestart(executor);
            }
            break;
        }

        case 'exe:toggle_chat_log': {
            const chatConfig = config.chat;
            const newValue = !chatConfig.logToConsole;
            chatConfig.logToConsole = newValue;
            updateConfig('chat', chatConfig);

            const feedbackMessage = `§aChat-to-console has been ${newValue ? '§aenabled' : '§cdisabled'}§a.`;
            if (sourceEntity instanceof mc.Player) {
                sourceEntity.sendMessage(feedbackMessage);
            }
            infoLog(`[AddonExe] ${feedbackMessage}`);
            break;
        }

        case 'exe:grant_admin_self': {
            if (sourceEntity instanceof mc.Player) {
                const adminRank = rankManager.getRankById('admin');
                if (!adminRank) {
                    errorLog('[AddonExe] Could not grant admin rank because the "admin" rank definition was not found.');
                    sourceEntity.sendMessage('§cError: The admin rank is not configured.');
                    return;
                }

                const adminTagCondition = adminRank.conditions.find((c) => c.type === 'hasTag');
                if (!adminTagCondition || !isNonEmptyString(adminTagCondition.value)) {
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
