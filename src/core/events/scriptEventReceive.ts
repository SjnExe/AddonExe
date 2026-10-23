import { CommandExecutor } from '@commands/commandManager.js';
import { getConfig, updateConfig } from '@core/config/configManager.js';
import { getOrCreatePlayer, setPlayerRanks } from '@core/data/playerDataManager.js';
import * as rankManager from '@core/permissions/rankManager.js';
import { errorLog, infoLog, warnLog } from '@core/utils/logger.js';
import { startRestart } from '@features/essentials/restartManager.js';
import * as mc from '@minecraft/server';

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
          isConsole: true,
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
          const pData = getOrCreatePlayer(sourceEntity);
          let newRanks = [...pData.ranks];
          const targetRank = typedPayload.rank;

          if (typedPayload.action === 'add_rank') {
            if (targetRank === 'owner' && !sourceEntity.hasTag('owner')) {
              try {
                sourceEntity.addTag('owner');
              } catch {
                // Ignore if tag already exists
              }
            }
            if (!newRanks.includes(targetRank)) {
              newRanks.push(targetRank);
            }
            sourceEntity.sendMessage(`§a[AddonExe] You have been granted the §e${targetRank}§a rank!`);
          } else {
            newRanks = newRanks.filter((r) => r !== targetRank);
            if (newRanks.length === 0) {
              newRanks.push('member');
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
