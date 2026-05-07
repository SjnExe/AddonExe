import { RawMessage } from '@minecraft/server';

/**
 * This file contains centralized constants for the addon.
 * Using constants helps prevent "magic strings" and makes the code easier to maintain.
 */

// --- Entity Identifiers ---
export const floatingTextId = 'exe:floating_text';

// --- Common Tags ---
export const adminTag = 'admin';
export const vanishedTag = 'vanished';
export const frozenTag = 'frozen';

// --- UI Form Titles ---
export const mainPanelTitle = '§l§bAddonExe Control Panel';

// --- Command Prefixes ---
export const commandPrefix = '!'; // This will be read from config later

// --- Default Messages ---
export const noPermission: RawMessage = { translate: 'error.no_permission' };
export const homesDisabled: RawMessage = { translate: 'error.homes_disabled' };
export const tpaDisabled: RawMessage = { translate: 'error.tpa_disabled' };
export const economyDisabled: RawMessage = { translate: 'error.economy_disabled' };
export const rtpDisabled: RawMessage = { translate: 'error.rtp_disabled' };
export const warpsDisabled: RawMessage = { translate: 'error.warps_disabled' };

// --- Sound Events ---
// Note: Migrate to MinecraftSoundTypes when available
export const soundTeleport = 'random.orb';
export const soundError = 'note.bass';
