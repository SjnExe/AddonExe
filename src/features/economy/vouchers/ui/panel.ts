import { getOrCreatePlayer } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { formatCurrency, parseCurrency } from '@core/utils/index.js';
import { sendMessage } from '@core/utils/messaging.js';
import {
  cancelPlayerVoucher,
  createAdminVoucher,
  createPlayerVoucher,
  getPlayerVouchers,
  redeemVoucher,
} from '@features/economy/vouchers/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

/**
 * Displays the Vouchers & Banknotes panel.
 *
 * @param player Viewing player.
 * @param isAdmin Whether the player has admin voucher permissions.
 */
export async function showVouchersPanel(player: mc.Player, isAdmin = false): Promise<void> {
  if (!player.isValid) {
    return;
  }

  const pData = getOrCreatePlayer(player);
  const myVouchers = getPlayerVouchers(player.id);

  const form = new ActionFormBuilder()
    .title('Banknotes & Vouchers')
    .body(`§7Wallet: §a${formatCurrency(pData.balance)}\n§7Your Active Vouchers: §f${myVouchers.length}`)
    .button('§l§2Redeem Voucher Code\n§r§7Claim a banknote or promo code', 'textures/items/emerald', async () => {
      const modal = new CustomFormBuilder<{ code: string }>('Redeem Voucher')
        .textField('code', 'Voucher Code (e.g. VCH-AB12CD34)', 'VCH-...')
        .submitButton('Redeem');
      const res = await modal.show(player);
      if (!player.isValid || !isDefined(res) || !isNonEmptyString(res.code)) {
        return;
      }
      const redeemRes = redeemVoucher(player, res.code);
      sendMessage(redeemRes.message, player);
    })
    .button('§l§eMint Banknote Voucher\n§r§7Lock funds into a shareable code', 'textures/items/paper', async () => {
      const modal = new CustomFormBuilder<{ amountStr: string }>('Mint Banknote Voucher')
        .textField('amountStr', 'Amount (e.g. 500 or 10k)', '500', '500')
        .submitButton('Create Voucher');
      const res = await modal.show(player);
      if (!player.isValid || !isDefined(res)) {
        return;
      }
      const amount = parseCurrency(res.amountStr.trim());
      if (!Number.isFinite(amount) || amount <= 0) {
        sendMessage('§cInvalid voucher amount.', player);
        return;
      }
      const createRes = createPlayerVoucher(player, amount);
      sendMessage(createRes.message, player);
    });

  if (isAdmin) {
    form.button('§l§6Issue Admin Voucher\n§r§7Create multi-use promo code', 'textures/items/gold_ingot', async () => {
      const modal = new CustomFormBuilder<{ amountStr: string; usesStr: string; hoursStr: string }>(
        'Issue Admin Voucher',
      )
        .textField('amountStr', 'Amount Per Redemption', '1000', '1000')
        .textField('usesStr', 'Max Uses (distinct players)', '10', '10')
        .textField('hoursStr', 'Expiry (hours)', '168', '168')
        .submitButton('Issue Voucher');
      const res = await modal.show(player);
      if (!player.isValid || !isDefined(res)) {
        return;
      }
      if (!hasPermission(player, 'cmd.voucher.admin')) {
        sendMessage('§cYou do not have permission to issue admin vouchers.', player);
        return;
      }
      const amount = parseCurrency(res.amountStr.trim());
      const uses = Number(res.usesStr.trim());
      const hours = Number(res.hoursStr.trim());
      const adminRes = createAdminVoucher(player, amount, uses, hours);
      sendMessage(adminRes.message, player);
    });
  }

  for (const voucher of myVouchers) {
    if (voucher.isAdmin) {
      form.button(
        `§l§6${voucher.code} §7(${formatCurrency(voucher.amount)})\n§r§7Admin Promo • Uses: ${voucher.remainingUses}/${voucher.maxUses}`,
        'textures/items/gold_ingot',
        () => {},
      );
    } else {
      form.button(
        `§l§e${voucher.code} §7(${formatCurrency(voucher.amount)})\n§r§7Uses: ${voucher.remainingUses}/${voucher.maxUses} §8| §cClick to cancel`,
        'textures/items/book_writable',
        () => {
          if (!player.isValid) {
            return;
          }
          const cancelRes = cancelPlayerVoucher(player.id, voucher.code);
          sendMessage(cancelRes.message, player);
        },
      );
    }
  }

  await form.show(player);
}
