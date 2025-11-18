import { configPanelSchema } from './panelRegistry.js';

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
        allSystems.push({ id: 'commandSystemPanel', title: '§l§1Command System§r', icon: 'textures/ui/command_block_front' });
        allSystems.push({ id: 'kitManagementPanel', title: '§l§dKit System§r', icon: 'textures/ui/inventory_icon' });
        allSystems.push({ id: 'shopManagementPanel', title: '§l§2Shop System§r', icon: 'textures/items/emerald' });
        allSystems.push({ id: 'rankManagementPanel', title: '§l§4Rank System§r', icon: 'textures/ui/permissions_member_star.png' });
        allSystems.push({ id: 'economyPanel', title: '§l§6Economy System§r', icon: 'textures/items/emerald' });
    }
    if (pData.permissionLevel === 0) {
        allSystems.push({ id: 'configResetPanel', title: '§l§cReset Settings§r', icon: 'textures/ui/wysiwyg_reset' });
    }

    // Custom sorting: General first, Reset last, rest alphabetical
    const generalSystem = allSystems.find(s => s.id === 'config_general');
    const resetSystem = allSystems.find(s => s.id === 'configResetPanel');
    let otherSystems = allSystems.filter(s => s.id !== 'config_general' && s.id !== 'configResetPanel');
    otherSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));

    const sortedSystems = [];
    if (generalSystem) { sortedSystems.push(generalSystem); }
    sortedSystems.push(...otherSystems);
    if (resetSystem) { sortedSystems.push(resetSystem); }

    return sortedSystems;
}
