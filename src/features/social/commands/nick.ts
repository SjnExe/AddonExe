import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { findPlayerByName } from '@core/data/playerCache.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { resolveTarget } from '@core/utils/index.js';
import { setPlayerNickname } from '@features/social/nick/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const nickCommand: CustomCommand = {
  name: 'nick',
  aliases: ['nickname'],
  description: 'Sets or resets your display nickname (or another player if admin).',
  category: 'Social',
  permissionNode: 'cmd.nick.vip',
  parameters: [
    { name: 'nickname', type: 'string' },
    { name: 'target', type: 'string', optional: true },
  ],
  execute: (executor: CommandExecutor, args: { nickname?: string; target?: string }) => {
    if (!getConfig().nick?.enabled) {
      executor.sendMessage('§cNicknames (/nick) are currently disabled.');
      return;
    }

    let target: mc.Player | undefined;
    if (isNonEmptyString(args.target)) {
      if (executor instanceof mc.Player && !hasPermission(executor, 'group.admin')) {
        executor.sendMessage('§cOnly administrators can change another player nickname.');
        return;
      }
      target = executor instanceof mc.Player ? resolveTarget(args.target, executor)[0] : findPlayerByName(args.target);
    } else if (executor instanceof mc.Player) {
      target = executor;
    }

    if (!isDefined(target)) {
      executor.sendMessage('§cTarget player not found online.');
      return;
    }

    const res = setPlayerNickname(target, args.nickname);
    executor.sendMessage(res.message);
    if (res.success && (!(executor instanceof mc.Player) || executor.id !== target.id)) {
      target.sendMessage(`§eYour nickname was updated by staff.`);
    }
  },
};

export default nickCommand;
