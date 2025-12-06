import { ActionFormData } from '@minecraft/server-ui';

import { configPanelSchema } from './panelRegistry.js';

import {
    AnticheatConfig,
    getAnticheatConfig,
    saveAnticheatConfig
} from '../../features/anticheat/anticheatConfigLoader.js';
import { economyConfig } from '../../features/economy/economyConfig.js';
import { shopConfig } from '../../features/shop/shopConfig.js';
import { teamConfig } from '../../features/teams/teamConfig.js';
import { Config, getConfig, updateMultipleConfig } from '../configManager.js';
import {
    getEconomyConfig,
    getSidebarConfig,
    getSpawnConfig,
    getTeamConfig,
    getXrayConfig,
    saveEconomyConfig,
    saveSidebarConfig,
    saveSpawnConfig,
    saveTeamConfig,
    saveXrayConfig,
    SidebarConfig
} from '../configurations.js';
import { kitsConfig } from '../kitsConfig.default.js';
import { PlayerData } from '../playerDataManager.js';
import ranksConfig from '../ranksConfig.default.js';
import { spawnConfig } from '../spawnConfig.default.js';
import { xrayConfig } from '../xrayConfig.default.js';

type SpawnConfig = typeof spawnConfig;
type EconomyConfig = typeof economyConfig;
type XrayConfig = typeof xrayConfig;
type TeamConfig = typeof teamConfig;
type RanksConfig = typeof ranksConfig;
type KitsConfig = typeof kitsConfig;
type ShopConfig = typeof shopConfig;

import { SystemDefinition, systemRegistry } from './systemRegistry.js';

export const itemsPerPage = 8;

interface ConfigHandler {
    get: () =>
        | typeof Config
        | SpawnConfig
        | EconomyConfig
        | XrayConfig
        | TeamConfig
        | RanksConfig
        | KitsConfig
        | ShopConfig
        | SidebarConfig
        | AnticheatConfig;
    save: (config: unknown) => void;
}

export const configHandlers: Record<string, ConfigHandler> = {
    main: {
        get: getConfig,
        save: (updates: unknown) => updateMultipleConfig(updates as Record<string, unknown>)
    },
    spawn: {
        get: getSpawnConfig,
        save: (config: unknown) => saveSpawnConfig(config as SpawnConfig)
    },
    economy: {
        get: getEconomyConfig,
        save: (config: unknown) => saveEconomyConfig(config as EconomyConfig)
    },
    xray: {
        get: getXrayConfig,
        save: (config: unknown) => saveXrayConfig(config as XrayConfig)
    },
    team: {
        get: getTeamConfig,
        save: (config: unknown) => saveTeamConfig(config as TeamConfig)
    },
    sidebar: {
        get: getSidebarConfig,
        save: (config: unknown) => saveSidebarConfig(config as SidebarConfig)
    },
    anticheat: {
        get: getAnticheatConfig,
        save: (config: unknown) => saveAnticheatConfig(config as AnticheatConfig)
    }
};

/**
 * Helper to slice items for pagination.
 */
export function getPaginatedItems<T>(items: T[], page: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
}

/**
 * Helper to add pagination buttons to a form.
 */
export function addPaginationButtons(form: ActionFormData, page: number, totalItems: number): void {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (page > 1) {
        form.button('§l§4< §1Previous');
    }
    if (page < totalPages) {
        form.button('§l§1Next §4>');
    }
}

export interface SystemItem {
    id: string;
    title: string;
    icon: string;
}

/**
 * Returns all registered systems.
 */
export function getAllSystems(): SystemDefinition[] {
    return systemRegistry;
}

/**
 * Returns a sorted list of systems that can be reset via the Config Reset Panel.
 * This list is used by both the panel builder (to generate buttons) and the handler (to process clicks).
 */
export function getResettableSystems() {
    const systems = [
        ...configPanelSchema
            .filter((c) => !c.id.startsWith('general_'))
            .map((c) => ({ id: c.id, title: c.title, icon: c.icon })),
        { id: 'kits', title: '§l§5Kit System§r', icon: 'textures/ui/inventory_icon' },
        { id: 'shop', title: '§l§2Shop System§r', icon: 'textures/items/emerald' },
        { id: 'ranks', title: '§l§4Rank System§r', icon: 'textures/ui/permissions_member_star.png' }
    ];
    return systems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));
}

/**
 * Generates a synchronized list of visible configuration systems for a player.
 * This serves as the single source of truth for both building the panel and handling its responses.
 * @param pData The player data object containing permissionLevel.
 * @returns A sorted array of system objects ({ id, title, icon }).
 */
export function getVisibleConfigSystems(pData: PlayerData): SystemItem[] {
    const allSystems: SystemItem[] = [];

    // Filter systems based on permissions and other logic
    systemRegistry.forEach((sys) => {
        // Skip specific systems if needed (e.g. sub-parts handled elsewhere)
        if (sys.id === 'economyGeneralSettings') {
            return;
        }

        // Determine panel ID to use
        const panelId = sys.configPanelId;

        // Permission Check (Default simple configs are visible to admins, specific ones handled below)
        // Actually, let's assume all these are permissionLevel <= 1 (Admin) unless specified
        // The original code pushed explicit items for permissionLevel <= 1
        if (pData.permissionLevel <= 1) {
            allSystems.push({
                id: panelId,
                title: sys.title,
                icon: sys.icon
            });
        }
    });

    if (pData.permissionLevel === 0) {
        allSystems.push({ id: 'configResetPanel', title: '§l§cReset Settings§r', icon: 'textures/ui/wysiwyg_reset' });
    }

    // Custom sorting: Server Info first, Gameplay, System, Reset last, rest alphabetical
    const serverInfo = allSystems.find((s) => s.id === 'config_general_server');
    const gameplay = allSystems.find((s) => s.id === 'config_general_gameplay');
    const system = allSystems.find((s) => s.id === 'config_general_system');
    const resetSystem = allSystems.find((s) => s.id === 'configResetPanel');

    const otherSystems = allSystems.filter(
        (s) =>
            s.id !== 'config_general_server' &&
            s.id !== 'config_general_gameplay' &&
            s.id !== 'config_general_system' &&
            s.id !== 'configResetPanel'
    );
    otherSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));

    const sortedSystems: SystemItem[] = [];
    if (serverInfo) {
        sortedSystems.push(serverInfo);
    }
    if (gameplay) {
        sortedSystems.push(gameplay);
    }
    if (system) {
        sortedSystems.push(system);
    }
    sortedSystems.push(...otherSystems);
    if (resetSystem) {
        sortedSystems.push(resetSystem);
    }

    return sortedSystems;
}
