import { getOrCreatePlayer } from '@core/data/playerDataManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import { formatCurrency, formatDuration, validateCurrencyAmount } from '@core/utils/index.js';
import { sendMessage } from '@core/utils/messaging.js';
import {
  claimOrBreakFixedDeposit,
  createFixedDeposit,
  depositToSavings,
  ensurePlayerBankState,
  fixedDepositPlans,
  formatPlayerBankOverview,
  withdrawFromSavings,
} from '@features/economy/bank/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';

export async function showBankMainPanel(player: mc.Player): Promise<void> {
  const pData = getOrCreatePlayer(player);
  const { bank } = ensurePlayerBankState(player);

  const form = new ActionFormBuilder()
    .title('Server Bank & Vault')
    .body(formatPlayerBankOverview(player))
    .button(
      `§l§2Deposit to Savings\n§r§7Wallet: ${formatCurrency(pData.balance)}`,
      'textures/items/emerald',
      async () => {
        const modal = new CustomFormBuilder<{ amountStr: string }>('Deposit to Savings')
          .textField(
            'amountStr',
            `Amount to Deposit (or "all" — Wallet: ${formatCurrency(pData.balance)})`,
            '100',
            String(pData.balance),
          )
          .submitButton('Deposit');
        const res = await modal.show(player);
        if (res && isNonEmptyString(res.amountStr.trim())) {
          const raw = res.amountStr.trim().toLowerCase();
          const amt = raw === 'all' ? getOrCreatePlayer(player).balance : validateCurrencyAmount(raw, true);
          if (isDefined(amt)) {
            sendMessage(depositToSavings(player, amt).message, player);
          } else {
            sendMessage('§cInvalid deposit amount.', player);
          }
        }
        await showBankMainPanel(player);
      },
    )
    .button(
      `§l§6Withdraw from Savings\n§r§7Savings: ${formatCurrency(bank.savingsBalance)}`,
      'textures/items/gold_ingot',
      async () => {
        const modal = new CustomFormBuilder<{ amountStr: string }>('Withdraw from Savings')
          .textField(
            'amountStr',
            `Amount to Withdraw (or "all" — Savings: ${formatCurrency(bank.savingsBalance)})`,
            '100',
            String(bank.savingsBalance),
          )
          .submitButton('Withdraw');
        const res = await modal.show(player);
        if (res && isNonEmptyString(res.amountStr.trim())) {
          const raw = res.amountStr.trim().toLowerCase();
          const amt =
            raw === 'all' ? ensurePlayerBankState(player).bank.savingsBalance : validateCurrencyAmount(raw, true);
          if (isDefined(amt)) {
            sendMessage(withdrawFromSavings(player, amt).message, player);
          } else {
            sendMessage('§cInvalid withdrawal amount.', player);
          }
        }
        await showBankMainPanel(player);
      },
    )
    .button('§l§bNew Fixed Deposit (CD)\n§r§7Lock money for higher yield', 'textures/items/diamond', async () => {
      const planKeys: ('1d' | '3d' | '7d')[] = ['1d', '3d', '7d'];
      const planLabels = planKeys.map(
        (k) => `${fixedDepositPlans[k].label} (+${fixedDepositPlans[k].baseRatePercent}% base)`,
      );
      const modal = new CustomFormBuilder<{ amountStr: string; planLabel: string }>('Create Fixed Deposit')
        .dropdown('planLabel', 'Select Term Plan', planLabels, 0)
        .textField('amountStr', `Principal Amount (Wallet: ${formatCurrency(pData.balance)})`, '500', '500')
        .submitButton('Lock Fixed Deposit');
      const res = await modal.show(player);
      if (res && isNonEmptyString(res.amountStr.trim())) {
        const amt = validateCurrencyAmount(res.amountStr.trim(), true);
        const idx = Math.max(0, planLabels.indexOf(res.planLabel));
        const chosenPlan = planKeys[idx] ?? '1d';
        if (isDefined(amt)) {
          sendMessage(createFixedDeposit(player, amt, chosenPlan).message, player);
        } else {
          sendMessage('§cInvalid Fixed Deposit amount.', player);
        }
      }
      await showBankMainPanel(player);
    });

  bank.fixedDeposits.forEach((fd, idx) => {
    const now = Date.now();
    const matured = now >= fd.maturesAt;
    const sub = matured ? '§aMatured • Tap to Claim!' : `§e${formatDuration(fd.maturesAt - now)} left • Tap to Break`;
    form.button(
      `§l§eFD #${idx + 1}: ${formatCurrency(fd.principal)} (+${fd.ratePercent}%)\n§r${sub}`,
      'textures/items/clock_item',
      async () => {
        if (matured) {
          sendMessage(claimOrBreakFixedDeposit(player, String(idx + 1), false).message, player);
          await showBankMainPanel(player);
        } else {
          await showConfirmationDialog(player, {
            title: `Break Fixed Deposit #${idx + 1} Early?`,
            body: `Breaking this Fixed Deposit before maturity will forfeit interest and deduct an early-withdrawal penalty from your ${formatCurrency(fd.principal)} principal.`,
            confirmButtonText: '§cBreak Early',
            onConfirm: async () => {
              sendMessage(claimOrBreakFixedDeposit(player, String(idx + 1), true).message, player);
              await showBankMainPanel(player);
            },
            onCancel: async () => {
              await showBankMainPanel(player);
            },
          });
        }
      },
    );
  });

  form.addBackButton(async () => {
    await showPanel(player, 'economyHub');
  });

  await form.show(player);
}
