import type { CommandModule } from '@core/commands/commandManager.js';

import cmdPvp from '../combat/commands/pvp.js';
import cmdFloatingtext from '../floatingText/commands/floatingtext.js';
import cmdZonewand from '../protection/commands/zonewand.js';
import cmdClaim from '../protection/landclaim/commands/claim.js';
import cmdWorldborder from '../worldBorder/commands/worldborder.js';
import cmdAfk from './afk.js';
import cmdAnnouncement from './announcement.js';
import cmdChattoconsole from './chattoconsole.js';
import cmdClear from './clear.js';
import cmdClearlag from './clearlag.js';
import cmdCountdown from './countdown.js';
import cmdDimensionLock from './dimensionLock.js';
import cmdGamemode from './gamemode.js';
import cmdHelp from './help.js';
import cmdItemCustomization from './itemCustomization.js';
import cmdLinks from './links.js';
import cmdPanel from './panel.js';
import cmdReload from './reload.js';
import cmdRestart from './restart.js';
import cmdRules from './rules.js';
import cmdSave from './save.js';
import cmdSpawn from './spawn.js';
import cmdStatus from './status.js';
import cmdUtilities from './utilities.js';
import cmdVersion from './version.js';

/** Essentials domain slash commands. */
export const essentialsCommands: CommandModule[] = [
  cmdAfk,
  cmdAnnouncement,
  cmdChattoconsole,
  cmdClear,
  cmdClearlag,
  cmdCountdown,
  cmdDimensionLock,
  cmdFloatingtext,
  cmdGamemode,
  cmdHelp,
  cmdItemCustomization,
  cmdLinks,
  cmdPanel,
  cmdClaim,
  cmdZonewand,
  cmdPvp,
  cmdReload,
  cmdRestart,
  cmdRules,
  cmdSave,
  cmdSpawn,
  cmdStatus,
  cmdUtilities,
  cmdVersion,
  cmdWorldborder,
];
