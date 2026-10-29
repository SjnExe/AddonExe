import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { errorLog } from '@core/utils/logger.js';
import { sendMessage } from '@core/utils/messaging.js';
import * as mc from '@minecraft/server';

const clearchatCommand: CustomCommand = {
  name: 'clearchat',
  aliases: ['cc'],
  description: 'Clears the chat for all players.',
  category: 'Moderation',
  permissionNode: 'cmd.clearchat.admin',
  allowConsole: true,
  execute: (executor: CommandExecutor) => {
    try {
      const announcer = executor instanceof mc.Player ? executor.name : 'the Console';
      mc.world.sendMessage(`${'\n'.repeat(100)}§aChat has been cleared by ${announcer}.`);
    } catch (error: unknown) {
      if (executor instanceof mc.Player) {
        sendMessage('§cFailed to clear chat.', executor);
      } else {
        executor.sendMessage('§cFailed to clear chat.');
      }
      const stack = error instanceof Error ? error.stack : String(error);
      errorLog(`[/x:clearchat] ${stack}`);
    }
  },
};

export default clearchatCommand;
