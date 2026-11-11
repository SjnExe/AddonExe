import type { CommandModule } from '@core/commands/commandManager.js';

import cmdHome from '../home/commands/home.js';
import cmdTpa from '../tpa/commands/tpa.js';
import cmdWarp from '../warp/commands/warp.js';
import cmdBack from './back.js';
import cmdBed from './bed.js';
import cmdDeathcoords from './deathcoords.js';
import cmdRtp from './rtp.js';
import cmdTop from './top.js';
import cmdTp from './tp.js';

/** Teleport domain slash commands. */
export const teleportCommands: CommandModule[] = [
  cmdBack,
  cmdBed,
  cmdDeathcoords,
  cmdHome,
  cmdRtp,
  cmdTop,
  cmdTp,
  cmdTpa,
  cmdWarp,
];
