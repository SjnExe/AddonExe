/**
 * This file contains centralized constants for the addon.
 * Using constants helps prevent "magic strings" and makes the code easier to maintain.
 */

export const Constants = {
    // --- Entity Identifiers ---
    FLOATING_TEXT_ID: 'addonexe:floating_text',

    // --- Common Tags ---
    ADMIN_TAG: 'admin',
    VANISHED_TAG: 'vanished',

    // --- UI Form Titles ---
    MAIN_PANEL_TITLE: '§l§bAddonExe Control Panel',
    // ... more titles can be added here ...

    // --- Command Prefixes ---
    COMMAND_PREFIX: '!', // This will be read from config later

    // --- Default Messages ---
    NO_PERMISSION: '§cYou do not have permission to use this command.'
};
