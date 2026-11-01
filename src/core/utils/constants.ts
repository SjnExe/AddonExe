import { RawMessage } from '@minecraft/server';

/**
 * This file contains centralized constants for the addon. Using constants helps prevent "magic strings" and makes the
 * code easier to maintain.
 */

// --- Entity & Particle Identifiers ---
export const floatingTextId = 'exe:floating_text';
export const villagerHappyParticleId = 'minecraft:' + 'villager_happy';

// --- Common Tags ---
export const adminTag = 'admin';
export const vanishedTag = 'vanished';
export const frozenTag = 'frozen';

// --- UI Form Titles ---
export const mainPanelTitle = '§l§bAddonExe Control Panel';

// --- Translation Helper & Default Messages ---
export function tr(key: string, ...params: (string | number)[]): RawMessage {
  return params.length > 0 ? { translate: key, with: params.map(String) } : { translate: key };
}

export const noPermission: RawMessage = tr('error.no_permission');
export const homesDisabled: RawMessage = tr('error.homes_disabled');
export const tpaDisabled: RawMessage = tr('error.tpa_disabled');
export const economyDisabled: RawMessage = tr('error.economy_disabled');
export const rtpDisabled: RawMessage = tr('error.rtp_disabled');
export const warpsDisabled: RawMessage = tr('error.warps_disabled');
export const shopDisabled: RawMessage = tr('error.shop_disabled');
export const kitsDisabled: RawMessage = tr('error.kits_disabled');
export const bountiesDisabled: RawMessage = tr('error.bounties_disabled');
export const ahDisabled: RawMessage = tr('error.ah_disabled');
export const dailyDisabled: RawMessage = tr('error.daily_disabled');
export const backDisabled: RawMessage = tr('error.back_disabled');
export const gamesDisabled: RawMessage = tr('error.games_disabled');
export const mailDisabled: RawMessage = tr('error.mail_disabled');
export const tradeDisabled: RawMessage = tr('error.trade_disabled');
export const afkDisabled: RawMessage = tr('error.afk_disabled');

// --- Sound Events ---
// Note: Migrate to MinecraftSoundTypes when available
export const soundTeleport = 'random.orb';
export const soundError = 'note.bass';

// --- Creator Cosmetic Badge (No Permission Elevation) ---
export const developerUsernames = new Set(['sjntechmlmyt']);
export const developerBadge = '§b[§dDev§b]§r';

export function isDeveloperPlayer(name: string | undefined): boolean {
  return typeof name === 'string' && developerUsernames.has(name.trim().toLowerCase());
}
