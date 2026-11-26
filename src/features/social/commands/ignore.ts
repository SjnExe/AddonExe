import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { getPlayer } from '@core/data/playerDataManager.js';
import { resolveTarget } from '@core/utils/index.js';
import { getIgnoredPlayerIds, toggleIgnorePlayer } from '@features/social/ignore/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const ignoreCommand: CustomCommand = {
  name: 'ignore',
  aliases: ['unignore'],
  description: 'Ignores or unignores chat, PMs, and TPA requests from a player.',
  category: 'Social',
  permissionNode: 'cmd.ignore',
  parameters: [{ name: 'target', type: 'string', optional: true }],
  execute: (executor: CommandExecutor, args: { target?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    if (!getConfig().ignore?.enabled) {
      executor.sendMessage('§cThe /ignore command is currently disabled.');
      return;
    }

    if (!isNonEmptyString(args.target) || args.target.toLowerCase() === 'list') {
      const ids = getIgnoredPlayerIds(executor.id);
      if (ids.length === 0) {
        executor.sendMessage('§7You are not ignoring anyone.');
        return;
      }
      const names = ids.map((id) => getPlayer(id)?.name ?? id);
      executor.sendMessage(`§eIgnored Players (${names.length}): §f${names.join('§7, §f')}`);
      return;
    }

    const target = resolveTarget(args.target, executor)[0];
    if (!isDefined(target)) {
      const query = args.target.toLowerCase();
      const offlineId = getIgnoredPlayerIds(executor.id).find((id) => {
        const name = getPlayer(id)?.name;
        return id.toLowerCase() === query || (name ? name.toLowerCase() === query : false);
      });
      if (offlineId) {
        const offlineName = getPlayer(offlineId)?.name ?? offlineId;
        const res = toggleIgnorePlayer(executor.id, offlineId, offlineName);
        executor.sendMessage(res.message);
        return;
      }
      executor.sendMessage('§cPlayer not found online or in your ignore list.');
      return;
    }
    const res = toggleIgnorePlayer(executor.id, target.id, target.name);
    executor.sendMessage(res.message);
  },
};

export default ignoreCommand;
