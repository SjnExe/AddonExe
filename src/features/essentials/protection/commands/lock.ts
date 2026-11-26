import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { getPlayerIdByName } from '@core/data/playerDataManager.js';
import { resolveTarget } from '@core/utils/index.js';
import {
  getContainerLockAt,
  getPlayerLocks,
  lockContainer,
  toggleContainerPublic,
  toggleContainerTrust,
  unlockContainer,
} from '@features/essentials/protection/containerLockManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const lockCommand: CustomCommand = {
  name: 'lock',
  aliases: ['clock'],
  description: 'Locks, unlocks, or manages trusted players on the container you are looking at.',
  category: 'Protection',
  permissionNode: 'cmd.lock.member',
  parameters: [
    { name: 'action', type: 'string', optional: true },
    { name: 'target', type: 'string', optional: true },
  ],
  execute: (executor: CommandExecutor, args: { action?: string; target?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    if (!getConfig().containerLocking?.enabled) {
      executor.sendMessage('§cContainer locking is currently disabled.');
      return;
    }

    const action = (args.action ?? 'lock').toLowerCase();
    if (action === 'list') {
      const owned = getPlayerLocks(executor.id);
      if (owned.length === 0) {
        executor.sendMessage('§7You have no locked containers.');
        return;
      }
      const lines = owned.map(
        (l, i) => `§e#${i + 1} §f(${l.x}, ${l.y}, ${l.z}) §7[${l.isPublic ? 'Public' : 'Private'}]`,
      );
      executor.sendMessage(`§aYour Locked Containers (${owned.length}):\n${lines.join('\n')}`);
      return;
    }

    const hit = executor.getBlockFromViewDirection({ maxDistance: 6 });
    const block = hit?.block;
    if (!isDefined(block)) {
      executor.sendMessage('§cLook directly at a Chest, Barrel, or Shulker Box within 6 blocks.');
      return;
    }

    if (action === 'public') {
      const res = toggleContainerPublic(executor, block.dimension.id, block.location);
      executor.sendMessage(res.message);
      return;
    }
    if (action === 'unlock' || action === 'remove') {
      const res = unlockContainer(executor, block.dimension.id, block.location);
      executor.sendMessage(res.message);
      return;
    }

    if (action === 'info') {
      const lock = getContainerLockAt(block.dimension.id, block.location);
      if (!lock) {
        executor.sendMessage('§7This container is not locked.');
        return;
      }
      executor.sendMessage(
        `§e[Container Lock] §fOwner: §a${lock.ownerName} §8| §fTrusted: §b${lock.trustedIds.length}`,
      );
      return;
    }

    if (action === 'trust' || action === 'untrust') {
      if (!isNonEmptyString(args.target)) {
        executor.sendMessage(`§cUsage: /lock ${action} <player>`);
        return;
      }
      const target = resolveTarget(args.target, executor)[0];
      const targetId = target?.id ?? (action === 'untrust' ? getPlayerIdByName(args.target) : undefined);
      const targetName = target?.name ?? args.target;
      if (!isDefined(targetId)) {
        executor.sendMessage(action === 'untrust' ? '§cPlayer not found.' : '§cPlayer not found online.');
        return;
      }
      const res = toggleContainerTrust(
        executor,
        block.dimension.id,
        block.location,
        targetId,
        targetName,
        action === 'trust',
      );
      executor.sendMessage(res.message);
      return;
    }

    if (action !== 'lock') {
      executor.sendMessage('§cUsage: /lock [lock|unlock|trust|untrust|info] [player]');
      return;
    }

    const res = lockContainer(executor, block);
    executor.sendMessage(res.message);
  },
};

const unlockCommand: CustomCommand = {
  name: 'unlock',
  description: 'Unlocks the container you are looking at.',
  category: 'Protection',
  permissionNode: 'cmd.lock.member',
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    if (!getConfig().containerLocking?.enabled) {
      executor.sendMessage('§cContainer locking is currently disabled.');
      return;
    }
    const hit = executor.getBlockFromViewDirection({ maxDistance: 6 });
    const block = hit?.block;
    if (!isDefined(block)) {
      executor.sendMessage('§cLook directly at a locked container within 6 blocks.');
      return;
    }
    const res = unlockContainer(executor, block.dimension.id, block.location);
    executor.sendMessage(res.message);
  },
};

export default [lockCommand, unlockCommand];
