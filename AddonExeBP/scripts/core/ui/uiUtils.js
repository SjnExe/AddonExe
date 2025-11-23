import { configPanelSchema } from './configPanelRegistry.js';
import { getConfig, updateMultipleConfig } from '../configManager.js';
import { getSpawnConfig, saveSpawnConfig, getEconomyConfig, saveEconomyConfig, getXrayConfig, saveXrayConfig, getTeamConfig, saveTeamConfig } from '../configurations.js';

export const itemsPerPage = 8;

export const configHandlers = {
    'main': {
        get: getConfig,
        save: (updates) => updateMultipleConfig(updates)
    },
    'spawn': {
        get: getSpawnConfig,
        save: (config) => saveSpawnConfig(config)
    },
    'economy': {
        get: getEconomyConfig,
        save: (config) => saveEconomyConfig(config)
    },
    'xray': {
        get: getXrayConfig,
        save: (config) => saveXrayConfig(config)
    },
    'team': {
        get: getTeamConfig,
        save: (config) => saveTeamConfig(config)
    }
};

/**
 * Helper to slice items for pagination.
 * @param {Array} items
 * @param {number} page
 * @returns {Array}
 */
export function getPaginatedItems(items, page) {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
}

/**
 * Helper to add pagination buttons to a form.
 * @param {ActionFormData} form
 * @param {number} page
 * @param {number} totalItems
 */
export function addPaginationButtons(form, page, totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (page > 1) {
        form.button('§l§4< §1Previous');
    }
    if (page < totalPages) {
        form.button('§l§1Next §4>');
    }
}

/**
 * Generates a synchronized list of visible configuration systems for a player.
 * This serves as the single source of truth for both building the panel and handling its responses.
 * @param {object} pData The player data object containing permissionLevel.
 * @returns {Array<object>} A sorted array of system objects ({ id, title, icon }).
 */
export function getVisibleConfigSystems(pData) {
    let allSystems = [
        ...configPanelSchema.filter(c => c.id !== 'economyGeneralSettings').map(c => ({ id: `config_${c.id}`, title: c.title, icon: c.icon }))
    ];

    if (pData.permissionLevel <= 1) {
        allSystems.push({ id: 'commandSystemPanel', title: '§l§1Command System§r', icon: 'textures/ui/Wrenches1' });
        allSystems.push({ id: 'kitManagementPanel', title: '§l§dKit System§r', icon: 'textures/ui/inventory_icon' });
        allSystems.push({ id: 'shopManagementPanel', title: '§l§2Shop System§r', icon: 'textures/items/emerald' });
        allSystems.push({ id: 'rankManagementPanel', title: '§l§4Rank System§r', icon: 'textures/ui/permissions_member_star.png' });
        allSystems.push({ id: 'economyPanel', title: '§l§6Economy System§r', icon: 'textures/items/emerald' });
    }
    if (pData.permissionLevel === 0) {
        allSystems.push({ id: 'configResetPanel', title: '§l§cReset Settings§r', icon: 'textures/ui/wysiwyg_reset' });
    }

    // Custom sorting: Server Info first, Gameplay, System, Reset last, rest alphabetical
    const serverInfo = allSystems.find(s => s.id === 'config_general_server');
    const gameplay = allSystems.find(s => s.id === 'config_general_gameplay');
    const system = allSystems.find(s => s.id === 'config_general_system');
    const resetSystem = allSystems.find(s => s.id === 'configResetPanel');

    let otherSystems = allSystems.filter(s =>
        s.id !== 'config_general_server' &&
        s.id !== 'config_general_gameplay' &&
        s.id !== 'config_general_system' &&
        s.id !== 'configResetPanel'
    );
    otherSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));

    const sortedSystems = [];
    if (serverInfo) { sortedSystems.push(serverInfo); }
    if (gameplay) { sortedSystems.push(gameplay); }
    if (system) { sortedSystems.push(system); }
    sortedSystems.push(...otherSystems);
    if (resetSystem) { sortedSystems.push(resetSystem); }

    return sortedSystems;
}
