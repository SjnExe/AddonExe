import * as mc from '@minecraft/server';

import { CommandExecutor } from '@commands/commandManager.js';

import { getConfig, updateConfig } from '@core/configManager.js';
import { errorLog, infoLog, warnLog } from '@core/logger.js';
import { getPlayer, setPlayerRanks } from '@core/playerDataManager.js';
import * as rankManager from '@core/rankManager.js';
import { startRestart } from '@features/essentials/restartManager.js';

export function handleScriptEventReceive(event: mc.ScriptEventCommandMessageAfterEvent) {
    const { id, sourceEntity } = event;

    // Handle script unload event
    // eslint-disable-next-line no-restricted-syntax
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

        case 'exe:action': {
            let payload: unknown;
            try {
                payload = JSON.parse(event.message);
            } catch {
                errorLog(`[AddonExe] Failed to parse script event action payload: ${event.message}`);
                return;
            }

            if (typeof payload !== 'object' || payload === null || !('action' in payload)) {
                errorLog(`[AddonExe] Invalid script event action payload: ${event.message}`);
                return;
            }

            const typedPayload = payload as { action?: string; rank?: string };

            if (typedPayload.action === 'add_rank' || typedPayload.action === 'remove_rank') {
                if (!typedPayload.rank || typeof typedPayload.rank !== 'string') {
                    errorLog(`[AddonExe] Invalid rank ID in action payload: ${event.message}`);
                    return;
                }

                if (sourceEntity instanceof mc.Player) {
                    const pData = getPlayer(sourceEntity.id);
                    if (!pData) return;

                    let newRanks = [...pData.ranks];
                    const targetRank = typedPayload.rank;

                    if (typedPayload.action === 'add_rank') {
                        if (!newRanks.includes(targetRank)) {
                            newRanks.push(targetRank);
                        }
                    } else {
                        newRanks = newRanks.filter((r) => r !== targetRank);
                        if (newRanks.length === 0) {
                            newRanks.push('member'); // fallback
                        }
                    }

                    setPlayerRanks(sourceEntity.id, newRanks);
                    rankManager.updatePlayerNameTag(sourceEntity, config);
                }
            }
            break;
        }
    }
}
