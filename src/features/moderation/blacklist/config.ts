import { MinecraftItemTypes } from '@minecraft/vanilla-data';

import { ItemBlacklistConfig } from './types.js';

/** Default configuration values for the item blacklist system. Defaults to disabled per addon feature policy. */
export const defaultItemBlacklistConfig: ItemBlacklistConfig = {
  enabled: false,
  blacklistedItems: [
    MinecraftItemTypes.Bedrock,
    MinecraftItemTypes.Barrier,
    MinecraftItemTypes.StructureVoid,
    MinecraftItemTypes.StructureBlock,
    MinecraftItemTypes.CommandBlock,
    MinecraftItemTypes.RepeatingCommandBlock,
    MinecraftItemTypes.ChainCommandBlock,
    MinecraftItemTypes.Jigsaw,
    MinecraftItemTypes.Allow,
    MinecraftItemTypes.Deny,
    MinecraftItemTypes.BorderBlock,
  ],
  action: 'confiscate',
  broadcastToStaff: true,
  persistToLog: true,
  logToConsole: true,
  exemptRanks: ['owner', 'admin'],
};
