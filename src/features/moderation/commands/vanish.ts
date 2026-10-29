import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { updatePlayerData } from '@core/data/playerDataManager.js';
import { vanishedTag } from '@core/utils/constants.js';
import { formatString } from '@core/utils/index.js';
import { sendMessage } from '@core/utils/messaging.js';
import * as mc from '@minecraft/server';
import { MinecraftEffectTypes } from '@minecraft/vanilla-data';

const vanishCommand: CustomCommand = {
  name: 'vanish',
  aliases: ['v'],
  description: 'Makes you invisible to other players.',
  category: 'Moderation',
  permissionNode: 'cmd.vanish.mod',
  allowConsole: false,
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const isVanished = executor.hasTag(vanishedTag);
    const config = getConfig();
    const joinLeaveConfig = config.playerInfo.customJoinLeave;

    if (isVanished) {
      executor.removeTag(vanishedTag);
      executor.removeEffect(MinecraftEffectTypes.Invisibility);
      updatePlayerData(executor.id, (d) => {
        d.isVanished = false;
      });
      sendMessage('§aYou are no longer vanished. You are now visible to other players.', executor);

      const joinTemplate = joinLeaveConfig?.joinMessage || '§e{playerName} joined the game';
      mc.world.sendMessage(formatString(joinTemplate, { playerName: executor.name }));
    } else {
      executor.addTag(vanishedTag);
      executor.addEffect(MinecraftEffectTypes.Invisibility, 2_000_000, { amplifier: 1, showParticles: false });
      updatePlayerData(executor.id, (d) => {
        d.isVanished = true;
      });
      sendMessage('§aYou are now vanished. You are hidden from other players.', executor);

      const leaveTemplate = joinLeaveConfig?.leaveMessage || '§e{playerName} left the game';
      mc.world.sendMessage(formatString(leaveTemplate, { playerName: executor.name }));
    }
  },
};

export default vanishCommand;
