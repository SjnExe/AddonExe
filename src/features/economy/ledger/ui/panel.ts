import { getPlayerNameById } from '@core/data/playerDataManager.js';
import { formatCurrency } from '@core/utils/index.js';
import { getEconomyTelemetry, getPlayerLedger } from '@features/economy/ledger/manager.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

/**
 * Displays a player's recent economy ledger or global admin telemetry.
 *
 * @param viewer Player viewing the panel.
 * @param targetPlayerId Target player ID for ledger inspection.
 * @param includeTelemetry Whether to include global server telemetry button (admin only).
 */
export async function showLedgerPanel(
  viewer: mc.Player,
  targetPlayerId = viewer.id,
  includeTelemetry = false,
): Promise<void> {
  if (!viewer.isValid) {
    return;
  }

  const targetName = getPlayerNameById(targetPlayerId) ?? viewer.name;
  const entries = getPlayerLedger(targetPlayerId, 20);

  const lines: string[] = [`§7Showing last ${entries.length} transactions for §f${targetName}§7:\n`];
  if (entries.length === 0) {
    lines.push('§8No recorded transactions yet.');
  } else {
    for (const entry of entries) {
      const sign = entry.type === 'faucet' ? '§a+' : entry.type === 'sink' || entry.type === 'tax' ? '§c-' : '§e•';
      const ageMinutes = Math.max(0, Math.floor((Date.now() - entry.timestamp) / 60_000));
      const ageLabel = ageMinutes < 60 ? `${ageMinutes}m ago` : `${Math.floor(ageMinutes / 60)}h ago`;
      lines.push(`${sign}${formatCurrency(entry.amount)} §7[${entry.category}] §f${entry.description} §8(${ageLabel})`);
    }
  }

  const form = new ActionFormBuilder().title(`Economy Ledger: ${targetName}`).body(lines.join('\n'));

  if (includeTelemetry) {
    form.button(
      '§l§6Server Economy Telemetry\n§r§7Faucets, sinks, taxes & net flow',
      'textures/items/gold_ingot',
      async () => {
        await showEconomyTelemetryPanel(viewer);
      },
    );
  }

  form.button('Close', undefined, () => {});
  await form.show(viewer);
}

/**
 * Displays server-wide economy health telemetry for administrators.
 *
 * @param viewer Admin player viewing telemetry.
 */
export async function showEconomyTelemetryPanel(viewer: mc.Player): Promise<void> {
  if (!viewer.isValid) {
    return;
  }

  const stats = getEconomyTelemetry();
  const netColor = stats.netFlow >= 0 ? '§a' : '§c';
  const topCategories = Object.entries(stats.categoryTotals)
    .sort((a, b) => b[1].volume - a[1].volume)
    .slice(0, 8);

  const lines: string[] = [
    `§aTotal Faucets (Created): §f${formatCurrency(stats.totalFaucets)}`,
    `§cTotal Sinks (Drained): §f${formatCurrency(stats.totalSinks)}`,
    `§6Total Taxes Collected: §f${formatCurrency(stats.totalTaxes)}`,
    `§bPlayer Transfers Volume: §f${formatCurrency(stats.totalTransfers)}`,
    `§eNet Supply Flow: ${netColor}${formatCurrency(stats.netFlow)}`,
    '',
    '§l§7Top Categories by Volume:',
  ];

  if (topCategories.length === 0) {
    lines.push('§8No category data recorded yet.');
  } else {
    for (const [category, stat] of topCategories) {
      lines.push(`§7- §f${category}§7: ${formatCurrency(stat.volume)} §8(${stat.count} tx)`);
    }
  }

  const form = new ActionFormBuilder()
    .title('Economy Health Telemetry')
    .body(lines.join('\n'))
    .button('Back to My Ledger', 'textures/items/book_writable', async () => {
      await showLedgerPanel(viewer, viewer.id, true);
    })
    .button('Close', undefined, () => {});

  await form.show(viewer);
}
