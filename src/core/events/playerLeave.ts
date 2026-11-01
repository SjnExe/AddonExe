import { getConfig } from '@core/config/configManager.js';
import * as playerCache from '@core/data/playerCache.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import { clearPlayerChatFilterState } from '@core/events/beforeChatSend.js';
import { hasPermission, invalidatePlayerPermissionCache } from '@core/permissions/permissionEngine.js';
import { clearPlayerRankCache } from '@core/permissions/rankManager.js';
import { clearPlayerUiTimestamp } from '@core/ui/uiManager.js';
import { formatString } from '@core/utils/index.js';
import { debugLog } from '@core/utils/logger.js';
import { cancelActiveTeleportWarmup, clearTeleportProtection } from '@core/utils/teleportLogic.js';
import { clearPlayerCombatState } from '@features/anticheat/combatCheck.js';
import { clearPlayerMovementState } from '@features/anticheat/movementCheck.js';
import { clearPlayerMiningStats } from '@features/anticheat/xray/manager.js';
import { clearPlayerPlaytimeState } from '@features/economy/playtime/manager.js';
import { clearPlayerTradeOffers } from '@features/economy/trade/manager.js';
import { clearPlayerAfkState } from '@features/essentials/afk/manager.js';
import { handleCombatPlayerLeave } from '@features/essentials/combat/manager.js';
import { clearPlayerSafeBorderPosition } from '@features/essentials/worldBorder/manager.js';
import { leaveGameChatChannel } from '@features/games/gameChat/manager.js';
import { clearPlayerWordleConfirmation } from '@features/games/wordle/commands/guess.js';
import { setStaffChatState } from '@features/moderation/commands/staffchat.js';
import { isWatched } from '@features/moderation/watchManager.js';
import { clearPlayerReplyPartner } from '@features/social/pm/manager.js';
import { setTeamChatState } from '@features/social/team/commands/team.js';
import { clearPlayerTpaRequests } from '@features/teleport/tpa/manager.js';
import * as mc from '@minecraft/server';

export const eventName = 'playerLeave';

function handlePlayerLeave(event: mc.PlayerLeaveAfterEvent) {
  const pData = playerDataManager.getPlayer(event.playerId);
  const config = getConfig();
  const joinLeaveConfig = config.playerInfo.customJoinLeave;

  if (pData?.isVanished !== true && joinLeaveConfig?.leaveMessage) {
    const msg = formatString(joinLeaveConfig.leaveMessage, { playerName: event.playerName });
    mc.world.sendMessage(msg);
  }

  if (isWatched(event.playerId)) {
    for (const staff of playerCache.getAllPlayersFromCache()) {
      if (staff.isValid && hasPermission(staff, 'group.mod')) {
        staff.sendMessage(`§6[Watchlist] §e${event.playerName} §7left the server.`);
      }
    }
  }

  cancelActiveTeleportWarmup(event.playerId);
  clearTeleportProtection(event.playerId);
  clearPlayerTpaRequests(event.playerId);
  setStaffChatState(event.playerId, false);
  setTeamChatState(event.playerId, false);
  leaveGameChatChannel(event.playerId);
  clearPlayerMovementState(event.playerId);
  clearPlayerCombatState(event.playerId);
  clearPlayerMiningStats(event.playerId);
  clearPlayerAfkState(event.playerId);
  clearPlayerTradeOffers(event.playerId);
  handleCombatPlayerLeave(event.playerId, event.playerName);
  clearPlayerChatFilterState(event.playerId);
  clearPlayerWordleConfirmation(event.playerId);
  clearPlayerUiTimestamp(event.playerId);
  clearPlayerReplyPartner(event.playerId);
  clearPlayerPlaytimeState(event.playerId);
  clearPlayerSafeBorderPosition(event.playerId);
  invalidatePlayerPermissionCache(event.playerId);
  clearPlayerRankCache(event.playerId);
  playerDataManager.handlePlayerLeave(event.playerId);
  playerCache.removePlayerFromCache(event.playerId);
  debugLog(`[AddonExe] Player ${event.playerName} left.`);
}

export default handlePlayerLeave;
