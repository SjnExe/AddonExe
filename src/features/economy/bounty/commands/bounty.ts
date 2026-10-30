import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { getOrCreatePlayer, incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { bountiesDisabled, economyDisabled } from '@core/utils/constants.js';
import { validateCurrencyAmount } from '@core/utils/economy.js';
import { resolvePlayerRecord, resolveSingleOnlineTarget } from '@core/utils/index.js';
import { sendMessage } from '@core/utils/messaging.js';
import * as bountyManager from '@features/economy/bounty/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

function checkBountyEnabled(executor: CommandExecutor): boolean {
  const config = getConfig();
  if (!isFeatureActive('eco') || config.bounties.enabled !== true) {
    if (executor instanceof mc.Player) {
      sendMessage(bountiesDisabled, executor);
    } else {
      executor.sendMessage(bountiesDisabled);
    }
    return false;
  }
  return true;
}

function sendExecutorMessage(executor: CommandExecutor, message: string) {
  if (executor instanceof mc.Player) {
    sendMessage(message, executor);
  } else {
    executor.sendMessage(message);
  }
}

function placeBounty(executor: mc.Player, targetId: string, targetName: string, amount: number) {
  const config = getConfig();

  if (!isFeatureActive('eco')) {
    sendMessage(economyDisabled, executor);
    return;
  }

  if (config.bounties.enabled !== true) {
    sendMessage(bountiesDisabled, executor);
    return;
  }

  const min = config.bounties.minimumBounty;
  if (Number.isNaN(amount) || amount < min) {
    sendMessage(`§cInvalid amount. The minimum bounty is $${min}.`, executor);
    return;
  }

  const result = bountyManager.placeBounty(executor.id, targetId, amount);

  if (result.success) {
    sendMessage(`§aYou have placed a bounty of §e$${amount}§a on ${targetName}.`, executor);
    mc.world.sendMessage(`§cSomeone has placed a bounty of §e$${amount}§c on ${targetName}!`);
  } else {
    sendMessage(`§c${result.message}`, executor);
  }
}

// --- Online Commands ---

const bountyCommand: CustomCommand = {
  name: 'bounty',
  description: 'Place a bounty on a player.',
  category: 'Economy',
  aliases: ['setbounty', 'addbounty', '+bounty', 'abounty'],
  permissionNode: 'cmd.bounty.member',
  parameters: [
    { name: 'target', type: 'string' },
    { name: 'amount', type: 'string' },
  ],
  execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    const targetName = args.target as string | undefined;
    const amountStr = args.amount as string | undefined;

    if (!isNonEmptyString(amountStr)) {
      return sendMessage('§cUsage: /bounty <player> <amount>', executor);
    }

    const resolved = resolveSingleOnlineTarget(targetName, executor, { allowSelf: true });
    if (resolved.error || !resolved.player) {
      return sendMessage(resolved.error ?? '§cPlayer not found.', executor);
    }
    const target = resolved.player;

    const amount = validateCurrencyAmount(amountStr, true);
    if (!isDefined(amount)) {
      return sendMessage('§cInvalid amount. Must be positive with max 2 decimal places.', executor);
    }

    placeBounty(executor, target.id, target.name, amount);
  },
};

const removeBountyCommand: CustomCommand = {
  name: 'removebounty',
  aliases: ['rbounty', 'delbounty', '-bounty'],
  description: 'Removes a bounty from a player using your money.',
  category: 'Economy',
  permissionNode: 'cmd.removebounty.member',
  parameters: [
    { name: 'target', type: 'string' },
    { name: 'amount', type: 'string' },
  ],
  execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    if (!checkBountyEnabled(executor)) {
      return;
    }

    const targetName = args.target as string | undefined;
    const amountStr = args.amount as string | undefined;

    if (!isNonEmptyString(amountStr)) {
      return sendMessage('§cPlease specify an amount.', executor);
    }

    const resolved = resolveSingleOnlineTarget(targetName, executor, { allowSelf: true });
    if (resolved.error || !resolved.player) {
      return sendMessage(resolved.error ?? '§cPlayer not found.', executor);
    }
    const target = resolved.player;

    const amount = validateCurrencyAmount(amountStr, true);
    if (!isDefined(amount)) {
      return sendMessage('§cInvalid amount. Must be positive with max 2 decimal places.', executor);
    }

    const targetBounty = bountyManager.getBounty(target.id);

    if (!isDefined(targetBounty)) {
      return sendMessage('§cThis player has no bounty on them.', executor);
    }

    if (amount > targetBounty.amount) {
      return sendMessage(`§cAmount exceeds bounty (${targetBounty.amount.toFixed(2)}).`, executor);
    }

    const pData = getOrCreatePlayer(executor);
    if (pData.balance < amount) {
      return sendMessage('§cYou dont have enough money.', executor);
    }

    incrementPlayerBalance(executor.id, -amount);
    bountyManager.incrementBounty(target.id, -amount);
    sendMessage(`§aYou have removed ${amount.toFixed(2)} from ${target.name}'s bounty.`, executor);
  },
};

// --- Offline Commands ---

const oBountyCommand: CustomCommand = {
  name: 'obounty',
  aliases: ['offlinebounty'],
  description: 'Place a bounty on an offline player.',
  category: 'Economy',
  permissionNode: 'cmd.obounty.admin',
  hidden: true,
  parameters: [
    { name: 'target', type: 'string' },
    { name: 'amount', type: 'string' },
  ],
  execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    const targetName = args.target as string | undefined;
    const amountStr = args.amount as string | undefined;

    if (!isNonEmptyString(targetName)) {
      return sendMessage('§cPlease specify a player name.', executor);
    }
    if (!isNonEmptyString(amountStr)) {
      return sendMessage('§cUsage: /obounty <player> <amount>', executor);
    }

    const amount = validateCurrencyAmount(amountStr, true);
    if (!isDefined(amount)) {
      return sendMessage('§cInvalid amount. Must be positive with max 2 decimal places.', executor);
    }

    const record = resolvePlayerRecord(targetName);
    if (!isDefined(record)) {
      return sendMessage(`§cPlayer "${targetName}" never joined.`, executor);
    }
    const { playerId: targetId, playerName: displayName } = record;

    placeBounty(executor, targetId, displayName, amount);
  },
};

const oRemoveBountyCommand: CustomCommand = {
  name: 'oremovebounty',
  aliases: ['offlineremovebounty'],
  description: 'Removes a bounty from an offline player.',
  category: 'Economy',
  permissionNode: 'cmd.oremovebounty.admin',
  hidden: true,
  parameters: [
    { name: 'target', type: 'string' },
    { name: 'amount', type: 'string' },
  ],
  execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    if (!checkBountyEnabled(executor)) {
      return;
    }

    const targetName = args.target as string | undefined;
    const amountStr = args.amount as string | undefined;

    if (!isNonEmptyString(targetName)) {
      return sendMessage('§cPlease specify a player name.', executor);
    }
    if (!isNonEmptyString(amountStr)) {
      return sendMessage('§cPlease specify an amount.', executor);
    }

    const amount = validateCurrencyAmount(amountStr, true);
    if (!isDefined(amount)) {
      return sendMessage('§cInvalid amount. Must be positive with max 2 decimal places.', executor);
    }

    const record = resolvePlayerRecord(targetName);
    if (!isDefined(record)) {
      return sendMessage(`§cPlayer "${targetName}" never joined.`, executor);
    }
    const { playerId: targetId, playerName: displayName } = record;

    const targetBounty = bountyManager.getBounty(targetId);
    if (!isDefined(targetBounty)) {
      return sendMessage('§cThis player has no bounty on them.', executor);
    }
    if (amount > targetBounty.amount) {
      return sendMessage(`§cAmount exceeds bounty (${targetBounty.amount.toFixed(2)}).`, executor);
    }

    const pData = getOrCreatePlayer(executor);
    if (pData.balance < amount) {
      return sendMessage('§cYou dont have enough money.', executor);
    }

    incrementPlayerBalance(executor.id, -amount);
    bountyManager.incrementBounty(targetId, -amount);
    sendMessage(`§aYou have removed ${amount.toFixed(2)} from ${displayName}'s bounty.`, executor);
  },
};

// --- List Command (Hybrid) ---

function handleListAllBounties(executor: CommandExecutor) {
  let message = '§a--- All Player Bounties ---\n';
  const allBounties = [...bountyManager.getAllBounties().values()].toSorted((a, b) => b.amount - a.amount);

  if (allBounties.length === 0) {
    message += '§7No active bounties.';
  } else {
    for (const bounty of allBounties) {
      if (isDefined(bounty)) {
        message += `§e${bounty.name}§r: ${bounty.amount.toFixed(2)}\n`;
      }
    }
  }
  sendExecutorMessage(executor, message.trim());
}

function handleSingleBountyCheck(executor: CommandExecutor, targetName: string) {
  const record = resolvePlayerRecord(targetName, executor instanceof mc.Player ? executor : undefined);
  if (!isDefined(record)) {
    sendExecutorMessage(executor, '§cPlayer not found (Online or Offline).');
    return;
  }

  const bounty = bountyManager.getBounty(record.playerId);
  if (!isDefined(bounty)) {
    sendExecutorMessage(executor, `§aThere is no bounty on ${record.playerName}.`);
    return;
  }
  sendExecutorMessage(executor, `§aBounty on ${record.playerName}: §e${bounty.amount.toFixed(2)}`);
}

const listBountyCommand: CustomCommand = {
  name: 'listbounty',
  aliases: ['lbounty', 'bounties', 'bountylist', 'showbounties', 'hitlist'],
  description: "Lists all active bounties or a specific player's bounty.",
  category: 'Economy',
  permissionNode: 'cmd.listbounty.member',
  allowConsole: true,
  parameters: [{ name: 'target', type: 'string', optional: true }],
  execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
    if (!checkBountyEnabled(executor)) {
      return;
    }

    const targetName = args.target as string | undefined;

    if (isNonEmptyString(targetName)) {
      handleSingleBountyCheck(executor, targetName);
    } else {
      handleListAllBounties(executor);
    }
  },
};

const oListBountyCommand: CustomCommand = {
  name: 'olistbounty',
  aliases: ['offlinelistbounty'],
  description: "Checks an offline player's bounty.",
  category: 'Economy',
  permissionNode: 'cmd.olistbounty.admin',
  allowConsole: true,
  hidden: true,
  parameters: [{ name: 'target', type: 'string' }],
  execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
    if (!checkBountyEnabled(executor)) {
      return;
    }

    const targetName = args.target as string | undefined;
    if (!isNonEmptyString(targetName)) {
      sendExecutorMessage(executor, '§cPlease specify a player name.');
      return;
    }

    const record = resolvePlayerRecord(targetName);
    if (!isDefined(record)) {
      sendExecutorMessage(executor, `§cPlayer "${targetName}" never joined.`);
      return;
    }
    const { playerId: targetId, playerName: displayName } = record;

    const bounty = bountyManager.getBounty(targetId);
    if (!isDefined(bounty)) {
      sendExecutorMessage(executor, `§aThere is no bounty on ${displayName}.`);
      return;
    }

    sendExecutorMessage(executor, `§aBounty on ${displayName}: §e$${bounty.amount.toFixed(2)}`);
  },
};

export default [
  bountyCommand,
  removeBountyCommand,
  listBountyCommand,
  oBountyCommand,
  oRemoveBountyCommand,
  oListBountyCommand,
];
