/**
 * This file contains centralized constants for the addon.
 * Using constants helps prevent "magic strings" and makes the code easier to maintain.
 */

export const constants = {
    // --- Entity Identifiers ---
    floatingTextId: 'addonexe:floating_text',

    // --- Common Tags ---
    adminTag: 'admin',
    vanishedTag: 'vanished',
    frozenTag: 'frozen',

    // --- UI Form Titles ---
    mainPanelTitle: '§l§bAddonExe Control Panel',

    // --- Command Prefixes ---
    commandPrefix: '!', // This will be read from config later

    // --- Default Messages ---
    noPermission: '§cYou do not have permission to use this command.',
    homesDisabled: '§cThe homes system is currently disabled.',
    tpaDisabled: '§cThe TPA system is currently disabled.',
    economyDisabled: '§cThe economy system is currently disabled.',
    rtpDisabled: '§cThe Random Teleport system is currently disabled.',
    warpsDisabled: '§cThe warps system is currently disabled.',

    // --- Sound Events ---
    soundTeleport: 'random.orb',
    soundError: 'note.bass'
};
