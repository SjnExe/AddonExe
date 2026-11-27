import { getOrCreatePlayer } from '@core/data/playerDataManager.js';
import { formatCurrency, parseCurrency } from '@core/utils/index.js';
import { sendMessage } from '@core/utils/messaging.js';
import {
  type BuyOrder,
  cancelBuyOrder,
  createBuyOrder,
  fulfillBuyOrder,
  getBuyOrders,
} from '@features/economy/orders/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

/**
 * Displays the main Buy Orders Request Board panel.
 *
 * @param player Viewing player.
 * @param query Optional search filter.
 */
export async function showBuyOrdersPanel(player: mc.Player, query?: string): Promise<void> {
  if (!player.isValid) {
    return;
  }

  const pData = getOrCreatePlayer(player);
  const orders = getBuyOrders(isNonEmptyString(query) ? { query } : undefined);

  const form = new ActionFormBuilder()
    .title(isNonEmptyString(query) ? `Buy Orders: "${query}"` : 'Buy Orders Board')
    .body(
      `§7Wallet: §a${formatCurrency(pData.balance)}\n§7Active Orders: §f${orders.length}\n§7Fulfill orders with clean items from your inventory.`,
    )
    .button('§l§2Post Buy Order\n§r§7Escrow cash to request items', 'textures/items/emerald', async () => {
      await showCreateBuyOrderModal(player);
    })
    .button('§l§eMy Buy Orders\n§r§7View or cancel your active requests', 'textures/items/book_writable', async () => {
      await showMyBuyOrdersPanel(player);
    })
    .button('§l§bSearch Orders\n§r§7Filter by item or buyer', 'textures/items/compass_item', async () => {
      const modal = new CustomFormBuilder<{ search: string }>('Search Buy Orders')
        .textField('search', 'Item or Buyer Name (leave blank to clear)', 'diamond', query ?? '')
        .submitButton('Search');
      const res = await modal.show(player);
      if (!player.isValid || !isDefined(res)) {
        return;
      }
      await showBuyOrdersPanel(player, res.search.trim() || undefined);
    });

  for (const order of orders.slice(0, 25)) {
    const remainingTotal = Math.round(order.remainingQuantity * order.unitPrice * 100) / 100;
    form.button(
      `§l§f${order.itemDisplayName} §7(${order.remainingQuantity} left)\n§r§a${formatCurrency(order.unitPrice)} ea §8| §eTotal: ${formatCurrency(remainingTotal)} §8(${order.buyerName})`,
      'textures/items/paper',
      async () => {
        await showOrderDetailPanel(player, order);
      },
    );
  }

  await form.show(player);
}

async function showOrderDetailPanel(player: mc.Player, order: BuyOrder): Promise<void> {
  if (!player.isValid) {
    return;
  }

  const isOwner = order.buyerId === player.id;
  const remainingTotal = Math.round(order.remainingQuantity * order.unitPrice * 100) / 100;
  const body = [
    `§7Item: §f${order.itemDisplayName} §8(${order.itemTypeId})`,
    `§7Buyer: §f${order.buyerName}`,
    `§7Unit Price: §a${formatCurrency(order.unitPrice)}`,
    `§7Remaining: §e${order.remainingQuantity} §8/ ${order.originalQuantity}`,
    `§7Remaining Escrow: §a${formatCurrency(remainingTotal)}`,
    '',
    '§8Only undamaged, unrenamed, unenchanted items are accepted.',
  ].join('\n');

  const form = new ActionFormBuilder().title(`Order: ${order.itemDisplayName}`).body(body);

  if (!isOwner) {
    form.button('§l§2Sell All Available\n§r§7Fulfill using clean items in inventory', 'textures/items/emerald', () => {
      if (!player.isValid) {
        return;
      }
      const res = fulfillBuyOrder(player, order.id);
      sendMessage(res.message, player);
    });

    form.button(
      '§l§eSell Custom Amount\n§r§7Choose how many items to deliver',
      'textures/items/gold_ingot',
      async () => {
        const modal = new CustomFormBuilder<{ qtyStr: string }>(`Sell ${order.itemDisplayName}`)
          .textField(
            'qtyStr',
            `Quantity to Sell (1 - ${order.remainingQuantity})`,
            '16',
            String(order.remainingQuantity),
          )
          .submitButton('Sell Items');
        const res = await modal.show(player);
        if (!player.isValid || !isDefined(res)) {
          return;
        }
        const qty = Number(res.qtyStr.trim());
        if (!Number.isInteger(qty) || qty < 1) {
          sendMessage('§cPlease enter a valid positive whole number.', player);
          return;
        }
        const fillRes = fulfillBuyOrder(player, order.id, qty);
        sendMessage(fillRes.message, player);
      },
    );
  } else {
    form.button('§l§cCancel & Refund\n§r§7Return remaining escrow to wallet', 'textures/blocks/barrier', () => {
      if (!player.isValid) {
        return;
      }
      const res = cancelBuyOrder(player.id, order.id);
      sendMessage(res.message, player);
    });
  }

  form.button('Back', undefined, async () => {
    await showBuyOrdersPanel(player);
  });

  await form.show(player);
}

async function showMyBuyOrdersPanel(player: mc.Player): Promise<void> {
  if (!player.isValid) {
    return;
  }

  const orders = getBuyOrders({ buyerId: player.id });
  const form = new ActionFormBuilder()
    .title('My Buy Orders')
    .body(orders.length === 0 ? '§7You have no active buy orders.' : `§7Active orders: §f${orders.length}`);

  for (const order of orders) {
    const remainingTotal = Math.round(order.remainingQuantity * order.unitPrice * 100) / 100;
    form.button(
      `§l§f${order.itemDisplayName} §7(${order.remainingQuantity}/${order.originalQuantity})\n§r§eEscrow: ${formatCurrency(remainingTotal)} §8| §cClick to manage`,
      'textures/items/paper',
      async () => {
        await showOrderDetailPanel(player, order);
      },
    );
  }

  form.button('Back', undefined, async () => {
    await showBuyOrdersPanel(player);
  });

  await form.show(player);
}

async function showCreateBuyOrderModal(player: mc.Player): Promise<void> {
  if (!player.isValid) {
    return;
  }

  let heldTypeId: string = MinecraftItemTypes.Diamond;
  try {
    const inv = (player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)
      ?.container;
    const held = inv?.getItem(player.selectedSlotIndex);
    if (isDefined(held)) {
      heldTypeId = held.typeId;
    }
  } catch {
    // Fallback to default placeholder
  }

  const modal = new CustomFormBuilder<{ itemTypeId: string; quantityStr: string; unitPriceStr: string }>(
    'Post Buy Order',
  )
    .textField('itemTypeId', 'Minecraft Item ID (defaults to held item)', MinecraftItemTypes.Diamond, heldTypeId)
    .textField('quantityStr', 'Quantity to Buy', '64', '64')
    .textField('unitPriceStr', 'Price Per Item (e.g. 100 or 1.5k)', '100', '100')
    .submitButton('Escrow & Post Order');

  const res = await modal.show(player);
  if (!player.isValid || !isDefined(res)) {
    return;
  }

  const qty = Number(res.quantityStr.trim());
  const unitPrice = parseCurrency(res.unitPriceStr.trim());
  if (!Number.isInteger(qty) || qty < 1) {
    sendMessage('§cQuantity must be a positive whole number.', player);
    return;
  }
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    sendMessage('§cInvalid unit price.', player);
    return;
  }

  const createRes = createBuyOrder(player, res.itemTypeId, qty, unitPrice);
  sendMessage(createRes.message, player);
}
