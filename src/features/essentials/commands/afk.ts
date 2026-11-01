import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { togglePlayerAfk } from '@features/essentials/afk/manager.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const afkCommand: CustomCommand = {
  name: 'afk',
  description: 'Toggle your Away-From-Keyboard (AFK) status.',
  category: 'General',
  permissionNode: 'cmd.afk.member',
  parameters: [{ name: 'reason', type: 'text', optional: true }],
  execute: (executor: CommandExecutor, args: { reason?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getConfig();
    if (!cfg.afk?.enabled) {
      executor.sendMessage('§cThe AFK system is currently disabled.');
      return;
    }

    togglePlayerAfk(executor, isNonEmptyString(args.reason) ? args.reason : undefined);
  },
};

export default afkCommand;
