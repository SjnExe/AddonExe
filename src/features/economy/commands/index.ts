import type { CommandModule } from '@core/commands/commandManager.js';

import cmdAh from '../auction/commands/ah.js';
import cmdBank from '../bank/commands/bank.js';
import cmdBounty from '../bounty/commands/bounty.js';
import cmdDaily from '../daily/commands/daily.js';
import cmdKit from '../kit/commands/kit.js';
import cmdPlaytime from '../playtime/commands/playtime.js';
import cmdShop from '../shop/commands/shop.js';
import cmdTrade from '../trade/commands/trade.js';
import cmdBalance from './balance.js';
import cmdPay from './pay.js';
import cmdSetbalance from './setbalance.js';

/** Economy domain slash commands. */
export const economyCommands: CommandModule[] = [
  cmdAh,
  cmdBalance,
  cmdBank,
  cmdBounty,
  cmdDaily,
  cmdKit,
  cmdPay,
  cmdPlaytime,
  cmdSetbalance,
  cmdShop,
  cmdTrade,
];
