import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { canBypass } from '@core/events/protectionEvents.js';
import {
  adminUnclaim,
  claimChunk,
  getClaimAt,
  getClaimsByPlayer,
  getMaxClaimsForPlayer,
  showChunkBoundaries,
  toChunkCoord,
  trustPlayer,
  unclaimAll,
  unclaimChunk,
  untrustPlayer,
} from '@features/social/landclaim/manager.js';
import { showLandClaimPanel } from '@features/social/landclaim/ui/panel.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const claimCommand: CustomCommand = {
  name: 'claim',
  aliases: ['landclaim', 'chunkclaim'],
  description: 'Manage, view, and protect your claimed chunks.',
  category: 'Social',
  permissionNode: 'cmd.claim',
  parameters: [
    {
      name: 'action',
      type: 'string',
      optional: true,
      enumOptions: ['here', 'unclaim', 'unclaimall', 'trust', 'untrust', 'list', 'info', 'visual', 'panel', 'admin'],
    },
    { name: 'argument', type: 'string', optional: true, description: 'Player name or admin subcommand' },
  ],
  execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
    if (!(executor instanceof mc.Player)) {
      executor.sendMessage('§cThis command can only be executed by a player in-game.');
      return;
    }

    const action = String(args.action ?? '')
      .trim()
      .toLowerCase();
    const argument = typeof args.argument === 'string' ? args.argument.trim() : '';

    if (!action || action === 'panel' || action === 'menu') {
      void showLandClaimPanel(executor);
      return;
    }

    switch (action) {
      case 'here':
      case 'chunk': {
        const res = claimChunk(executor);
        executor.sendMessage(res.message);
        break;
      }
      case 'unclaim': {
        const res = unclaimChunk(executor);
        executor.sendMessage(res.message);
        break;
      }
      case 'unclaimall': {
        const res = unclaimAll(executor);
        executor.sendMessage(res.message);
        break;
      }
      case 'trust': {
        if (!isNonEmptyString(argument)) {
          executor.sendMessage('§cUsage: /claim trust <player>');
          return;
        }
        const res = trustPlayer(executor, argument);
        executor.sendMessage(res.message);
        break;
      }
      case 'untrust': {
        if (!isNonEmptyString(argument)) {
          executor.sendMessage('§cUsage: /claim untrust <player>');
          return;
        }
        const res = untrustPlayer(executor, argument);
        executor.sendMessage(res.message);
        break;
      }
      case 'list': {
        const claims = getClaimsByPlayer(executor.id);
        const max = getMaxClaimsForPlayer(executor);
        if (claims.length === 0) {
          executor.sendMessage('§eYou do not own any claims.');
          return;
        }
        executor.sendMessage(`§aYour Claimed Chunks (${claims.length}/${max}):`);
        for (const c of claims) {
          const dimShort = c.dimension.replace('minecraft:', '');
          executor.sendMessage(`§7- §e[${c.chunkX}, ${c.chunkZ}] §7in §f${dimShort}`);
        }
        break;
      }
      case 'info': {
        const cx = toChunkCoord(executor.location.x);
        const cz = toChunkCoord(executor.location.z);
        const claim = getClaimAt(executor.location, executor.dimension.id);
        if (!isDefined(claim)) {
          executor.sendMessage(`§7Chunk [${cx}, ${cz}] is wilderness (unclaimed).`);
          return;
        }
        executor.sendMessage(
          `§a--- Chunk [${cx}, ${cz}] Claim Info ---\n` +
            `§7Owner: §e${claim.ownerName}\n` +
            `§7Claimed: §f${new Date(claim.claimedAt).toLocaleString()}\n` +
            `§7Trusted: §f${claim.trusted.length > 0 ? claim.trusted.join(', ') : 'None'}\n` +
            `§7PvP: §f${claim.flags.allowPvP ? 'Allowed' : 'Prohibited'}\n` +
            `§7Explosions: §f${claim.flags.allowExplosions ? 'Allowed' : 'Prohibited'}`,
        );
        break;
      }
      case 'visual':
      case 'show': {
        showChunkBoundaries(executor);
        break;
      }
      case 'admin': {
        if (!canBypass(executor)) {
          executor.sendMessage('§cYou lack administrative permission for land claim management.');
          return;
        }
        const sub = argument.toLowerCase();
        if (sub === 'unclaim') {
          const cx = toChunkCoord(executor.location.x);
          const cz = toChunkCoord(executor.location.z);
          const dimId = executor.dimension.id;
          const res = adminUnclaim(`${dimId}:${cx},${cz}`);
          executor.sendMessage(res.message);
        } else {
          executor.sendMessage('§cUsage: /claim admin <unclaim>');
        }
        break;
      }
      default:
        executor.sendMessage(
          '§cUnknown claim action. Use /claim or /claim <here|unclaim|unclaimall|trust|untrust|list|info|visual>',
        );
        break;
    }
  },
};

export default claimCommand;
