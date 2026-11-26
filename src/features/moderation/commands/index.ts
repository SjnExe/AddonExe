import type { CommandModule } from '@core/commands/commandManager.js';

import cmdItemblacklist from '../blacklist/commands/itemblacklist.js';
import cmdStaffinv from '../staffInv/commands/staffinv.js';
import cmdAdminUtils from './adminUtils.js';
import cmdBan from './ban.js';
import cmdChatcontrol from './chatcontrol.js';
import cmdChatlog from './chatlog.js';
import cmdClearchat from './clearchat.js';
import cmdFreeze from './freeze.js';
import cmdInventory from './inventory.js';
import cmdKick from './kick.js';
import cmdMaintenance from './maintenance.js';
import cmdMute from './mute.js';
import cmdReport from './report.js';
import cmdStaffchat from './staffchat.js';
import cmdVanish from './vanish.js';
import cmdWarn from './warn.js';
import cmdWatch from './watch.js';

/** Moderation domain slash commands. */
export const moderationCommands: CommandModule[] = [
  cmdAdminUtils,
  cmdBan,
  cmdItemblacklist,
  cmdChatcontrol,
  cmdChatlog,
  cmdClearchat,
  cmdFreeze,
  cmdInventory,
  cmdKick,
  cmdMaintenance,
  cmdMute,
  cmdReport,
  cmdStaffchat,
  cmdStaffinv,
  cmdVanish,
  cmdWarn,
  cmdWatch,
];
