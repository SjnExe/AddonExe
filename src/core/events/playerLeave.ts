import { getConfig } from '@core/config/configManager.js';
import * as playerCache from '@core/data/playerCache.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import { clearPlayerChatFilterState } from '@core/events/beforeChatSend.js';
import { clearPlayerUiTimestamp } from '@core/ui/uiManager.js';
import { formatString } from '@core/utils/index.js';
import { debugLog } from '@core/utils/logger.js';
import { cancelActiveTeleportWarmup } from '@core/utils/teleportLogic.js';
import { clearPlayerPlaytimeState } from '@features/economy/playtime/manager.js';
import { handleCombatPlayerLeave } from '@features/essentials/combat/manager.js';
import { clearPlayerSafeBorderPosition } from '@features/essentials/worldBorder/manager.js';
import { clearPlayerWordleConfirmation } from '@features/games/wordle/commands/guess.js';
import { clearPlayerReplyPartner } from '@features/social/pm/manager.js';
import * as mc from '@minecraft/server';

export const eventName = 'playerLeave';

function handlePlayerLeave(event: mc.PlayerLeaveAfterEvent) {
  const pData = playerDataManager.getPlayer(event.playerId);
  const config = getConfig();
  const joinLeaveConfig = config.playerInfo.customJoinLeave;

  if (joinLeaveConfig.enabled === true && pData?.isVanished !== true) {
    const msg = formatString(joinLeaveConfig.leaveMessage, { playerName: event.playerName });
    mc.world.sendMessage(msg);
  }

  cancelActiveTeleportWarmup(event.playerId);
  handleCombatPlayerLeave(event.playerId, event.playerName);
  clearPlayerChatFilterState(event.playerId);
  clearPlayerWordleConfirmation(event.playerId);
  clearPlayerUiTimestamp(event.playerId);
  clearPlayerReplyPartner(event.playerId);
  clearPlayerPlaytimeState(event.playerId);
  clearPlayerSafeBorderPosition(event.playerId);
  playerDataManager.handlePlayerLeave(event.playerId);
  playerCache.removePlayerFromCache(event.playerId);
  debugLog(`[AddonExe] Player ${event.playerName} left.`);
}

export default handlePlayerLeave;
