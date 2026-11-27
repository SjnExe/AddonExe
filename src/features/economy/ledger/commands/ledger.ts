import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getEconomyConfig } from '@core/config/configurations.js';
import { getPlayerIdByName } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { sendMessage } from '@core/utils/messaging.js';
import { showEconomyTelemetryPanel, showLedgerPanel } from '@features/economy/ledger/ui/panel.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const ledgerCommand: CustomCommand = {
  name: 'ledger',
  aliases: ['ecolog', 'ecoaudit'],
  description: 'View your recent economy transactions or admin telemetry.',
  category: 'Economy',
  permissionNode: 'cmd.ledger.member',
  parameters: [
    {
      name: 'mode',
      type: 'string',
      optional: true,
      enumOptions: ['telemetry', 'player'],
    },
    { name: 'target', type: 'string', optional: true },
  ],
  execute: async (executor: CommandExecutor, args: { mode?: string; target?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const ecoCfg = getEconomyConfig();
    if (!isFeatureActive('eco') || ecoCfg.ledger?.enabled !== true) {
      sendMessage('§cEconomy ledger is currently disabled.', executor);
      return;
    }

    const isAdmin = hasPermission(executor, 'cmd.ledger.admin');
    const mode = args.mode?.toLowerCase();

    if (mode === 'telemetry') {
      if (!isAdmin) {
        sendMessage('§cYou do not have permission to view server economy telemetry.', executor);
        return;
      }
      await showEconomyTelemetryPanel(executor);
      return;
    }

    if (mode === 'player') {
      if (!isAdmin) {
        sendMessage('§cYou do not have permission to inspect another player’s ledger.', executor);
        return;
      }
      if (!isNonEmptyString(args.target)) {
        sendMessage('§cUsage: /ledger player <playerName>', executor);
        return;
      }
      const targetId = getPlayerIdByName(args.target);
      if (!isNonEmptyString(targetId)) {
        sendMessage(`§cPlayer "${args.target}" not found.`, executor);
        return;
      }
      await showLedgerPanel(executor, targetId, true);
      return;
    }

    await showLedgerPanel(executor, executor.id, isAdmin);
  },
};

export default ledgerCommand;
