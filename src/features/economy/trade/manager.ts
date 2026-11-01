import { getConfig } from '@core/config/configManager.js';
import { getAuctionHouseConfig } from '@core/config/configurations.js';
import { recordEscrow, releaseEscrow } from '@core/data/escrowManager.js';
import { deserializeItem, type SerializedItem, serializeItem } from '@core/data/itemSerializer.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import { getOrCreatePlayer, incrementPlayerBalance, updatePlayerData } from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { calculateTaxWithPolicy, formatCurrency, playSound } from '@core/utils/index.js';
import { clearTrackedTimeout, setTrackedTimeout } from '@core/utils/timerManager.js';
import { formatSerializedItemSummary } from '@features/economy/tradeUtils.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';

export interface TradeProposal {
  id: string;
  senderId: string;
  senderName: string;
  targetId: string;
  targetName: string;
  offeredMoney: number;
  offeredItem?: SerializedItem;
  requestedMoney: number;
  requireTargetHeldItem: boolean;
  expiryTimerId: number;
}

const pendingTradesByTarget = new Map<string, TradeProposal>();
const outgoingTradeBySender = new Map<string, string>();

function returnSenderEscrow(proposal: TradeProposal): void {
  releaseEscrow(proposal.id);
  if (proposal.offeredMoney > 0) {
    incrementPlayerBalance(proposal.senderId, proposal.offeredMoney);
  }
  if (isDefined(proposal.offeredItem)) {
    const sender = getPlayerFromCache(proposal.senderId);
    const inv = (sender?.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)
      ?.container;
    const stack = deserializeItem(proposal.offeredItem);
    if (isDefined(inv) && isDefined(stack) && inv.emptySlotsCount > 0) {
      const leftover = inv.addItem(stack);
      if (isDefined(leftover)) {
        updatePlayerData(proposal.senderId, (d) => {
          d.mailbox.push(serializeItem(leftover));
        });
      }
    } else {
      updatePlayerData(proposal.senderId, (d) => {
        d.mailbox.push(proposal.offeredItem!);
      });
    }
  }
}

function deliverItemSafely(playerId: string, item: SerializedItem): void {
  const player = getPlayerFromCache(playerId);
  const inv = (player?.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)
    ?.container;
  const stack = deserializeItem(item);
  if (isDefined(inv) && isDefined(stack) && inv.emptySlotsCount > 0) {
    const leftover = inv.addItem(stack);
    if (isDefined(leftover)) {
      updatePlayerData(playerId, (d) => {
        d.mailbox.push(serializeItem(leftover));
      });
      player?.sendMessage('§e[Trade] Inventory full — leftover item sent to your Collection Bin (/ah collect).');
    }
    return;
  }
  updatePlayerData(playerId, (d) => {
    d.mailbox.push(item);
  });
  player?.sendMessage('§e[Trade] Item sent to your Collection Bin (/ah collect).');
}

export function createTradeOffer(
  sender: mc.Player,
  target: mc.Player,
  options: {
    offerMoney: number;
    includeHeldItem: boolean;
    requestMoney: number;
    requireTargetHeldItem: boolean;
  },
): { success: boolean; message: string } {
  const cfg = getConfig();
  if (!cfg.trading?.enabled) {
    return { success: false, message: '§cPlayer trading (/trade) is currently disabled.' };
  }

  if (sender.id === target.id) {
    return { success: false, message: '§cYou cannot trade with yourself.' };
  }

  if (outgoingTradeBySender.has(sender.id)) {
    return { success: false, message: '§cYou already have an outgoing trade offer. Use /trade cancel first.' };
  }

  if (pendingTradesByTarget.has(target.id)) {
    return { success: false, message: `§c${target.name} already has a pending trade offer.` };
  }

  const offerMoney = Math.max(0, Math.floor(options.offerMoney * 100) / 100);
  const requestMoney = Math.max(0, Math.floor(options.requestMoney * 100) / 100);

  if ((offerMoney > 0 || requestMoney > 0) && !isFeatureActive('eco')) {
    return { success: false, message: '§cMoney trades require Economy to be enabled.' };
  }

  const flatFee = isFeatureActive('eco') ? Math.max(0, Number(cfg.trading?.flatFee ?? 0)) : 0;
  const senderData = getOrCreatePlayer(sender);
  if (offerMoney + flatFee > 0 && senderData.balance < offerMoney + flatFee) {
    return {
      success: false,
      message: `§cInsufficient funds (${formatCurrency(offerMoney + flatFee)} required including ${formatCurrency(flatFee)} trade fee).`,
    };
  }

  let offeredItem: SerializedItem | undefined;
  const inv = (sender.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)
    ?.container;

  if (options.includeHeldItem) {
    const held = inv?.getItem(sender.selectedSlotIndex);
    if (!isDefined(held)) {
      return { success: false, message: '§cYou are not holding an item in your main hand to trade.' };
    }
    const ahCfg = getAuctionHouseConfig();
    if (ahCfg.blockedItemIds.includes(held.typeId)) {
      return { success: false, message: '§cShulker Boxes and Bundles cannot be traded.' };
    }
    offeredItem = serializeItem(held);
  }

  if (offerMoney === 0 && !isDefined(offeredItem) && requestMoney === 0 && !options.requireTargetHeldItem) {
    return { success: false, message: '§cCannot send an empty trade offer.' };
  }

  const proposalId = `trade_${Date.now()}_${sender.id}`;
  recordEscrow({
    id: proposalId,
    playerId: sender.id,
    ...(offerMoney > 0 ? { money: offerMoney } : {}),
    ...(isDefined(offeredItem) ? { item: offeredItem } : {}),
    reason: 'trade',
    timestamp: Date.now(),
  });

  // Escrow sender's money & item immediately so they cannot be duped
  if (offerMoney > 0) {
    incrementPlayerBalance(sender.id, -offerMoney);
  }
  if (isDefined(offeredItem) && isDefined(inv)) {
    inv.setItem(sender.selectedSlotIndex, undefined);
  }

  const timeoutSec = Math.max(15, Number(cfg.trading?.requestTimeoutSeconds ?? 60));
  const timerId = setTrackedTimeout(() => {
    const expired = pendingTradesByTarget.get(target.id);
    if (isDefined(expired) && expired.senderId === sender.id) {
      pendingTradesByTarget.delete(target.id);
      outgoingTradeBySender.delete(sender.id);
      returnSenderEscrow(expired);
      getPlayerFromCache(sender.id)?.sendMessage(`§cYour trade offer to ${target.name} expired. Escrow returned.`);
      getPlayerFromCache(target.id)?.sendMessage(`§cTrade offer from ${sender.name} expired.`);
    }
  }, timeoutSec * 20);

  const proposal: TradeProposal = {
    id: proposalId,
    senderId: sender.id,
    senderName: sender.name,
    targetId: target.id,
    targetName: target.name,
    offeredMoney: offerMoney,
    ...(isDefined(offeredItem) ? { offeredItem } : {}),
    requestedMoney: requestMoney,
    requireTargetHeldItem: options.requireTargetHeldItem,
    expiryTimerId: timerId,
  };

  pendingTradesByTarget.set(target.id, proposal);
  outgoingTradeBySender.set(sender.id, target.id);

  const offerParts: string[] = [];
  if (isDefined(offeredItem)) {
    const sum = formatSerializedItemSummary(offeredItem);
    offerParts.push(`§b${sum.title} x${offeredItem.amount}`);
  }
  if (offerMoney > 0) {
    offerParts.push(`§a${formatCurrency(offerMoney)}`);
  }
  const offerDesc = offerParts.length > 0 ? offerParts.join(' + ') : 'Nothing';

  const reqParts: string[] = [];
  if (options.requireTargetHeldItem) {
    reqParts.push('§eYour Held Item');
  }
  if (requestMoney > 0) {
    reqParts.push(`§6${formatCurrency(requestMoney)}`);
  }
  const reqDesc = reqParts.length > 0 ? reqParts.join(' + ') : 'Nothing (Gift)';

  target.sendMessage(
    `§6§l[Trade Offer] §r§e${sender.name} §7offers: ${offerDesc} §8| §7Requests: ${reqDesc}\n§7Type §a/trade accept§7 or §c/trade deny§7 within ${timeoutSec}s.`,
  );
  playSound(target, 'random.orb');

  return {
    success: true,
    message: `§aTrade offer sent to §e${target.name}§a! (Expires in ${timeoutSec}s)`,
  };
}

export function acceptTradeOffer(target: mc.Player): { success: boolean; message: string } {
  const proposal = pendingTradesByTarget.get(target.id);
  if (!isDefined(proposal)) {
    return { success: false, message: '§cYou have no pending trade offers.' };
  }

  const targetData = getOrCreatePlayer(target);
  if (proposal.requestedMoney > 0 && targetData.balance < proposal.requestedMoney) {
    return {
      success: false,
      message: `§cYou need ${formatCurrency(proposal.requestedMoney)} to accept this trade.`,
    };
  }

  let targetHeldSerialized: SerializedItem | undefined;
  const targetInv = (target.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)
    ?.container;

  if (proposal.requireTargetHeldItem) {
    const held = targetInv?.getItem(target.selectedSlotIndex);
    if (!isDefined(held)) {
      return {
        success: false,
        message: '§cThis trade requires you to hold an item in your main hand before accepting.',
      };
    }
    const ahCfg = getAuctionHouseConfig();
    if (ahCfg.blockedItemIds.includes(held.typeId)) {
      return { success: false, message: '§cShulker Boxes and Bundles cannot be traded.' };
    }
    targetHeldSerialized = serializeItem(held);
  }

  clearTrackedTimeout(proposal.expiryTimerId);
  pendingTradesByTarget.delete(target.id);
  outgoingTradeBySender.delete(proposal.senderId);
  releaseEscrow(proposal.id);

  const tradeCfg = getConfig().trading;
  const tradeRate = Number(tradeCfg?.moneyTaxPercentage ?? 0);
  const tradeMaxTax = Number(tradeCfg?.maxTax ?? 0);

  if (proposal.requestedMoney > 0) {
    incrementPlayerBalance(target.id, -proposal.requestedMoney);
    const { netAmount } = calculateTaxWithPolicy(proposal.requestedMoney, {
      ratePercent: tradeRate,
      maxTax: tradeMaxTax,
    });
    incrementPlayerBalance(proposal.senderId, netAmount);
  }
  if (isDefined(targetHeldSerialized) && isDefined(targetInv)) {
    targetInv.setItem(target.selectedSlotIndex, undefined);
    deliverItemSafely(proposal.senderId, targetHeldSerialized);
  }

  if (proposal.offeredMoney > 0) {
    const { netAmount } = calculateTaxWithPolicy(proposal.offeredMoney, {
      ratePercent: tradeRate,
      maxTax: tradeMaxTax,
    });
    incrementPlayerBalance(target.id, netAmount);
  }
  if (isDefined(proposal.offeredItem)) {
    deliverItemSafely(target.id, proposal.offeredItem);
  }

  const sender = getPlayerFromCache(proposal.senderId);
  if (isDefined(sender) && sender.isValid) {
    sender.sendMessage(`§a[Trade] §e${target.name} §aaccepted your trade offer!`);
    playSound(sender, 'random.levelup');
  }
  playSound(target, 'random.levelup');

  return { success: true, message: `§a[Trade] Completed trade with §e${proposal.senderName}§a!` };
}

export function denyTradeOffer(target: mc.Player): { success: boolean; message: string } {
  const proposal = pendingTradesByTarget.get(target.id);
  if (!isDefined(proposal)) {
    return { success: false, message: '§cYou have no pending trade offers.' };
  }

  clearTrackedTimeout(proposal.expiryTimerId);
  pendingTradesByTarget.delete(target.id);
  outgoingTradeBySender.delete(proposal.senderId);
  returnSenderEscrow(proposal);

  const sender = getPlayerFromCache(proposal.senderId);
  if (isDefined(sender)) {
    sender.sendMessage(`§c[Trade] ${target.name} declined your trade offer. Escrow returned.`);
  }

  return { success: true, message: `§eDeclined trade offer from ${proposal.senderName}.` };
}

export function cancelTradeOffer(sender: mc.Player): { success: boolean; message: string } {
  const targetId = outgoingTradeBySender.get(sender.id);
  if (!isDefined(targetId)) {
    return { success: false, message: '§cYou have no outgoing trade offers.' };
  }

  const proposal = pendingTradesByTarget.get(targetId);
  outgoingTradeBySender.delete(sender.id);
  if (isDefined(proposal)) {
    clearTrackedTimeout(proposal.expiryTimerId);
    pendingTradesByTarget.delete(targetId);
    returnSenderEscrow(proposal);
    getPlayerFromCache(targetId)?.sendMessage(`§c[Trade] ${sender.name} cancelled their trade offer.`);
  }

  return { success: true, message: '§aCancelled your outgoing trade offer and returned escrow.' };
}

export function clearPlayerTradeOffers(playerId: string): void {
  const targetId = outgoingTradeBySender.get(playerId);
  if (isDefined(targetId)) {
    const prop = pendingTradesByTarget.get(targetId);
    outgoingTradeBySender.delete(playerId);
    if (isDefined(prop)) {
      clearTrackedTimeout(prop.expiryTimerId);
      pendingTradesByTarget.delete(targetId);
      returnSenderEscrow(prop);
    }
  }

  const incoming = pendingTradesByTarget.get(playerId);
  if (isDefined(incoming)) {
    clearTrackedTimeout(incoming.expiryTimerId);
    pendingTradesByTarget.delete(playerId);
    outgoingTradeBySender.delete(incoming.senderId);
    returnSenderEscrow(incoming);
  }
}

export function _clearTradesForTest(): void {
  pendingTradesByTarget.clear();
  outgoingTradeBySender.clear();
}
