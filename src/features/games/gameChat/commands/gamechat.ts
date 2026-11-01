import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import {
  isGameChatTalkingEnabled,
  isPlayerInGameChatChannel,
  joinGameChatChannel,
  leaveGameChatChannel,
  setGameChatTalkingMode,
  toggleGameChatTalking,
} from '@features/games/gameChat/manager.js';
import { setStaffChatState } from '@features/moderation/commands/staffchat.js';
import { setTeamChatState } from '@features/social/team/commands/team.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const gameChatCommand: CustomCommand = {
  name: 'gamechat',
  aliases: ['gc'],
  description: 'Join, leave, or toggle talking in the active Game Chat channel.',
  category: 'Games',
  permissionNode: 'cmd.gamechat.member',
  parameters: [
    {
      name: 'action',
      type: 'string',
      optional: true,
      enumOptions: ['toggle', 'join', 'leave', 'on', 'off', 'status'],
    },
  ],
  execute: (executor: CommandExecutor, args: { action?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const sub = isNonEmptyString(args.action) ? args.action.toLowerCase() : 'toggle';

    if (sub === 'status') {
      const listening = isPlayerInGameChatChannel(executor.id);
      const talking = isGameChatTalkingEnabled(executor.id);
      executor.sendMessage(
        `§d[GameChat] §7Listening: ${listening ? '§aYES' : '§cNO'} §8| §7Chat Routing: ${talking ? '§aGame Chat' : '§fGeneral Chat'}`,
      );
      return;
    }

    if (sub === 'leave' || sub === 'off') {
      leaveGameChatChannel(executor.id);
      executor.sendMessage('§e[GameChat] You left the Game Chat channel and switched back to General Chat.');
      return;
    }

    if (sub === 'join') {
      joinGameChatChannel(executor.id);
      executor.sendMessage(
        '§a[GameChat] Joined Game Chat! Use §e/gc on§a to talk directly in Game Chat or §e/gc leave§a anytime.',
      );
      return;
    }

    if (sub === 'on') {
      setGameChatTalkingMode(executor.id, true);
      setStaffChatState(executor.id, false);
      setTeamChatState(executor.id, false);
      executor.sendMessage(
        '§a[GameChat] Chat channel switched to §dGame Chat§a! Numbers typed in chat will automatically submit to active Number Guess rounds. Use §e/gc leave§a anytime.',
      );
      return;
    }

    const enabled = toggleGameChatTalking(executor.id);
    if (enabled) {
      setStaffChatState(executor.id, false);
      setTeamChatState(executor.id, false);
      executor.sendMessage(
        '§a[GameChat] Switched to §dGame Chat§a! Type §e/gc§a to return to General Chat or §e/gc leave§a to mute Game Chat.',
      );
    } else {
      executor.sendMessage(
        '§a[GameChat] Switched chat input back to §fGeneral Chat§a (still listening to Game Chat; use §e/gc leave§a to mute).',
      );
    }
  },
};

export default gameChatCommand;
